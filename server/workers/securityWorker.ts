self.addEventListener('message', async (ev) => {
  const payload = ev.data || {};
  const url = payload.url;
  try {
    const res = await fetch('/api/security-analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    });
    let data;
    try { data = await res.json(); } catch (e) { data = { error: 'Invalid JSON from security service' }; }
    self.postMessage({ type: 'result', ok: res.ok, data });
  } catch (err) {
    self.postMessage({ type: 'error', error: String(err) });
  }
});
