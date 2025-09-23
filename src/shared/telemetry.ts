// src/shared/telemetry.ts

let sessionId: string | null = null;
let lastRoute: string | null = null;
let lastEnterTime = 0;

function getSessionId() {
  if (sessionId) return sessionId;
  try {
    const key = 'telemetry_session_id';
    const existing = localStorage.getItem(key);
    if (existing) {
      sessionId = existing;
      return sessionId;
    }
    // simple random id
    sessionId = Math.random().toString(36).slice(2) + Date.now().toString(36);
    localStorage.setItem(key, sessionId);
    return sessionId;
  } catch {
    sessionId = null;
    return null;
  }
}

async function postTelemetry(body: any) {
  try {
    await fetch('/api/admin/telemetry', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...body, sessionId: getSessionId() })
    });
  } catch {
    // ignore errors
  }
}

export async function trackRouteVisit(route: string) {
  const now = Date.now();
  // leave previous route
  if (lastRoute) {
    const duration = Math.max(0, now - lastEnterTime);
    void postTelemetry({ route: lastRoute, event: 'route_leave', durationMs: duration });
  }
  // enter new route
  lastRoute = route;
  lastEnterTime = now;
  return postTelemetry({ route, event: 'route_view' });
}

export function trackClientEvent(route: string, name: string, meta?: Record<string, any>) {
  return postTelemetry({ route, event: 'client_event', meta: { name, ...(meta || {}) } });
}

// optional: hook into visibility change to mark leaves
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden' && lastRoute) {
      const now = Date.now();
      const duration = Math.max(0, now - lastEnterTime);
      void postTelemetry({ route: lastRoute, event: 'route_leave', durationMs: duration });
    }
  });
}
