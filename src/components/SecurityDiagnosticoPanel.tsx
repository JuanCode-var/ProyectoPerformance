import React, { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../shared/ui/card";
import { Button } from "../shared/ui/button";
import SecurityScoreWidget from "./SecurityScoreWidget";
import EmailPdfBar from "./EmailPdfBar";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { Info } from "lucide-react";
import { useAuth } from '../auth/AuthContext';
import { Ban } from 'lucide-react';

// Pequeño separador visual reutilizable mejorado
function SectionDivider({ label, info }: { label: string; info?: React.ReactNode }) {
  const [open, setOpen] = React.useState(false);
  return (
    <div className="w-full my-8" role="region" aria-label={label}>
      <div className="flex items-center gap-4">
        <div className="flex-1 h-px bg-gradient-to-r from-transparent via-slate-300 to-transparent" />
        <div className="flex items-center gap-3 px-4 py-2 rounded-lg bg-gradient-to-r from-slate-50 to-white border border-slate-200 shadow-sm">
          <div className="text-xs sm:text-sm font-semibold uppercase tracking-wider text-slate-700 select-none">
            {label}
          </div>
          {info && (
            <button
              type="button"
              className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-blue-50 border border-blue-200 text-blue-600 hover:bg-blue-100 hover:text-blue-700 hover:scale-105 transition-all duration-200 shadow-sm"
              onClick={() => setOpen((v) => !v)}
              aria-expanded={open}
              aria-controls={`info-${label.replace(/\s+/g, "-").toLowerCase()}`}
              title="¿Qué es esto?"
            >
              <Info size={16} strokeWidth={2.2} />
            </button>
          )}
        </div>
        <div className="flex-1 h-px bg-gradient-to-r from-transparent via-slate-300 to-transparent" />
      </div>
      {info && open && (
        <div
          id={`info-${label.replace(/\s+/g, "-").toLowerCase()}`}
          className="mt-4 text-sm text-slate-700 bg-gradient-to-r from-blue-50 to-slate-50 border border-blue-200 rounded-lg p-4 shadow-sm animate-in slide-in-from-top-2 duration-300"
        >
          {info}
        </div>
      )}
    </div>
  );
}

// Small inline icons
const Caret = ({ open }: { open: boolean }) => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={`transition-transform ${open ? "rotate-180" : "rotate-0"}`}
    aria-hidden
  >
    <path
      d="M6 9l6 6 6-6"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);
const CopyIcon = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden
  >
    <rect
      x="9"
      y="9"
      width="10"
      height="10"
      rx="2"
      stroke="currentColor"
      strokeWidth="2"
    />
    <rect
      x="5"
      y="5"
      width="10"
      height="10"
      rx="2"
      stroke="currentColor"
      strokeWidth="2"
    />
  </svg>
);

// Helper local
async function safeParseJSON(res: Response): Promise<any> {
  const text = await res.text();
  try {
    return JSON.parse(text || "{}");
  } catch {
    return { _raw: text };
  }
}

type HeaderMeta = {
  title?: string;
  description?: string;
  recommendation?: string;
  learnMore?: string;
  why?: string;
  scoreImpact?: number;
  nginx?: string;
  apache?: string;
  express?: string;
  expected?: string;
};

const HEADER_INFO: Record<string, HeaderMeta> = {
  "content-security-policy": {
    title: "Content-Security-Policy (CSP)",
    description: "Controla qué recursos puede cargar la página para mitigar XSS.",
    recommendation: "Defina una política CSP restrictiva (evite 'unsafe-inline').",
    learnMore: "https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP",
    why: "Sin CSP, aplicaciones son más vulnerables a inyección de scripts.",
    expected: "Content-Security-Policy: default-src 'self'; object-src 'none'; frame-ancestors 'none'",
    nginx: "add_header Content-Security-Policy \"default-src 'self'; object-src 'none'; frame-ancestors 'none'\" always;",
    apache: "Header set Content-Security-Policy \"default-src 'self'; object-src 'none'; frame-ancestors 'none'\"",
    express: "res.set('Content-Security-Policy', \"default-src 'self'; object-src 'none'; frame-ancestors 'none'\");",
  },
  "strict-transport-security": {
    title: "Strict-Transport-Security (HSTS)",
    description: "Forza el uso de HTTPS para evitar ataques de downgrade.",
    recommendation: "Habilite HSTS con un max-age elevado e includeSubDomains si aplica.",
    learnMore: "https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Strict-Transport-Security",
    why: "Sin HSTS, usuarios pueden ser forzados a usar HTTP en ciertos ataques.",
    expected: "Strict-Transport-Security: max-age=31536000; includeSubDomains; preload",
    nginx: "add_header Strict-Transport-Security \"max-age=31536000; includeSubDomains; preload\" always;",
    apache: "Header always set Strict-Transport-Security \"max-age=31536000; includeSubDomains; preload\"",
    express: "res.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');",
  },
  "x-frame-options": {
    title: "X-Frame-Options",
    description: "Evita que la página sea embebida en iframes (clickjacking).",
    recommendation: "Use DENY o SAMEORIGIN según el caso.",
    learnMore: "https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/X-Frame-Options",
    why: "Protege contra ataques de clickjacking que pueden engañar a usuarios para hacer clic en elementos ocultos.",
    expected: "X-Frame-Options: DENY",
    nginx: "add_header X-Frame-Options \"DENY\" always;",
    apache: "Header always set X-Frame-Options \"DENY\"",
    express: "res.set('X-Frame-Options', 'DENY');",
  },
  "x-content-type-options": {
    title: "X-Content-Type-Options",
    description: "Evita que el navegador haga MIME sniffing.",
    recommendation: "Use X-Content-Type-Options: nosniff.",
    learnMore: "https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/X-Content-Type-Options",
    why: "Previene ataques basados en MIME confusion donde el navegador interpreta archivos de forma diferente a la especificada.",
    expected: "X-Content-Type-Options: nosniff",
    nginx: "add_header X-Content-Type-Options \"nosniff\" always;",
    apache: "Header always set X-Content-Type-Options \"nosniff\"",
    express: "res.set('X-Content-Type-Options', 'nosniff');",
  },
  "referrer-policy": {
    title: "Referrer-Policy",
    description: "Controla cuánta información de referencia se envía.",
    recommendation: "Use 'strict-origin-when-cross-origin' o más restrictivo.",
    learnMore: "https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Referrer-Policy",
    why: "Protege la privacidad limitando qué información se envía en el encabezado Referer a otros sitios.",
    expected: "Referrer-Policy: strict-origin-when-cross-origin",
    nginx: "add_header Referrer-Policy \"strict-origin-when-cross-origin\" always;",
    apache: "Header always set Referrer-Policy \"strict-origin-when-cross-origin\"",
    express: "res.set('Referrer-Policy', 'strict-origin-when-cross-origin');",
  },
  "permissions-policy": {
    title: "Permissions-Policy",
    description: "Restringe APIs del navegador (geolocación, cámara, etc.).",
    recommendation: "Defina políticas por defecto lo más restrictivas posible.",
    learnMore: "https://developer.mozilla.org/en-US/docs/Web/HTTP/Permissions_Policy",
    why: "Mejora la seguridad y privacidad limitando qué APIs del navegador pueden usar scripts o iframes embebidos.",
    expected: "Permissions-Policy: geolocation=(), camera=(), microphone=()",
    nginx: "add_header Permissions-Policy \"geolocation=(), camera=(), microphone=()\" always;",
    apache: "Header always set Permissions-Policy \"geolocation=(), camera=(), microphone=()\"",
    express: "res.set('Permissions-Policy', 'geolocation=(), camera=(), microphone=()');",
  },
  "cross-origin-opener-policy": {
    title: "Cross-Origin-Opener-Policy",
    description: "Aísla el contexto del documento para mayor seguridad.",
    recommendation: "Use same-origin si es posible.",
    learnMore: "https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Cross-Origin-Opener-Policy",
    why: "Protege contra ataques de cross-origin que podrían acceder a tu ventana a través de window.opener.",
    expected: "Cross-Origin-Opener-Policy: same-origin",
    nginx: "add_header Cross-Origin-Opener-Policy \"same-origin\" always;",
    apache: "Header always set Cross-Origin-Opener-Policy \"same-origin\"",
    express: "res.set('Cross-Origin-Opener-Policy', 'same-origin');",
  },
  "cross-origin-embedder-policy": {
    title: "Cross-Origin-Embedder-Policy",
    description: "Requerido para aislar recursos y habilitar ciertas APIs.",
    recommendation: "Use require-corp si es posible.",
    learnMore: "https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Cross-Origin-Embedder-Policy",
    why: "Habilita características avanzadas del navegador como SharedArrayBuffer y mejora el aislamiento de recursos.",
    expected: "Cross-Origin-Embedder-Policy: require-corp",
    nginx: "add_header Cross-Origin-Embedder-Policy \"require-corp\" always;",
    apache: "Header always set Cross-Origin-Embedder-Policy \"require-corp\"",
    express: "res.set('Cross-Origin-Embedder-Policy', 'require-corp');",
  },
  "cache-control": {
    title: "Cache-Control",
    description: "Controla el cacheo del contenido (útil para información sensible).",
    recommendation: "Para contenido sensible: no-store, no-cache, must-revalidate.",
    learnMore: "https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Cache-Control",
    why: "Previene que información sensible se almacene en cachés de navegadores o proxies intermedios.",
    expected: "Cache-Control: no-store, no-cache, must-revalidate",
    nginx: "add_header Cache-Control \"no-store, no-cache, must-revalidate\" always;",
    apache: "Header always set Cache-Control \"no-store, no-cache, must-revalidate\"",
    express: "res.set('Cache-Control', 'no-store, no-cache, must-revalidate');",
  },
  server: {
    title: "Server",
    description: "Exponer la tecnología del servidor puede ayudar a fingerprinting.",
    recommendation: "Oculte o generalice el valor del header Server.",
    learnMore: "https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Server",
    why: "Evita revelar información sobre la tecnología del servidor que podrían usar atacantes para identificar vulnerabilidades específicas.",
    expected: "Server: (oculto o genérico)",
    nginx: "server_tokens off;",
    apache: "ServerTokens Prod\nServerSignature Off",
    express: "app.disable('x-powered-by'); // Para ocultar Express",
  },
  "x-powered-by": {
    title: "X-Powered-By",
    description: "Divulga la tecnología usada (Express, PHP, etc.).",
    recommendation: "Elimínelo para evitar fuga de información.",
    learnMore: "https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/X-Powered-By",
    why: "Oculta información sobre el framework o tecnología utilizada, reduciendo la superficie de ataque.",
    expected: "(sin encabezado)",
    nginx: "# No se envía por defecto en nginx",
    apache: "# Remover con mod_headers si se agrega",
    express: "app.disable('x-powered-by');",
  },
};

const CRITICAL_HEADERS: string[] = [
  "content-security-policy",
  "strict-transport-security",
  "x-frame-options",
  "x-content-type-options",
  "referrer-policy",
  "permissions-policy",
];

type PlanItem = { id: string; title: string; recommendation: string; severity?: string };

function deriveSecurityPlan(sr: any): { errors: PlanItem[]; improvements: PlanItem[]; plan: PlanItem[] } {
  const out = { errors: [] as PlanItem[], improvements: [] as PlanItem[], plan: [] as PlanItem[] };

  if (Array.isArray(sr?.findings) && sr.findings.length) {
    const errors = sr.findings.filter((f: any) => f?.passed === false || String(f?.severity || '').toLowerCase().includes('high'));
    const improvements = sr.findings.filter((f: any) => f?.passed !== false && !String(f?.severity || '').toLowerCase().includes('high'));
    out.errors = errors.map((f: any, i: number) => ({
      id: f.id || f.rule || `error-${i}`,
      title: f.title || f.id || f.rule || 'Fallo',
      recommendation: f.recommendation || f.message || f.description || '',
      severity: f.severity || 'high',
    }));
    out.improvements = improvements.map((f: any, i: number) => ({
      id: f.id || f.rule || `imp-${i}`,
      title: f.title || f.id || f.rule || 'Mejora',
      recommendation: f.recommendation || f.message || f.description || '',
      severity: f.severity || 'info',
    }));
  } else if (sr?.headers && typeof sr.headers === 'object') {
    const getPresent = (k: string) => {
      const info = (sr.headers as any)[k];
      return info?.present ?? info?.ok ?? info?.passed ?? (info?.value != null);
    };

    for (const h of CRITICAL_HEADERS) {
      if (!getPresent(h)) {
        const meta = HEADER_INFO[h] || ({} as any);
        out.errors.push({
          id: `missing-${h}`,
          title: `${meta.title || h} ausente`,
          recommendation: meta.recommendation || "Agregar y configurar este encabezado siguiendo buenas prácticas.",
          severity: "high",
        });
      }
    }

    const recommended = [
      "cross-origin-opener-policy",
      "cross-origin-embedder-policy",
      "cache-control",
      "server",
      "x-powered-by",
    ];

    for (const h of recommended) {
      if (!getPresent(h)) {
        const meta = HEADER_INFO[h] || ({} as any);
        out.improvements.push({
          id: `missing-${h}`,
          title: `${meta.title || h} no configurado`,
          recommendation: meta.recommendation || 'Valorar su implementación para endurecer seguridad.',
          severity: 'info',
        });
      }
    }
  }

  out.plan = [...out.errors, ...out.improvements];
  return out;
}

const SeverityChart = ({ findings }: { findings: any[] }) => {
  const counts = { high: 0, medium: 0, low: 0 };
  for (const f of findings || []) {
    const s = String(f?.severity || '').toLowerCase();
    if (s.includes('high') || s.includes('critical')) counts.high += 1;
    else if (s.includes('medium')) counts.medium += 1;
    else counts.low += 1;
  }
  const total = counts.high + counts.medium + counts.low || 1;
  const items = [
    { label: 'Crítica', value: Math.round((counts.high / total) * 100), color: '#dc2626', icon: '🔴' },
    { label: 'Media', value: Math.round((counts.medium / total) * 100), color: '#f59e0b', icon: '🟡' },
    { label: 'Baja', value: Math.round((counts.low / total) * 100), color: '#059669', icon: '🟢' },
  ];
  
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
      <h4 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
        📊 Distribución por Severidad
      </h4>
      
      {/* Leyenda */}
      <div className="flex flex-wrap gap-4 mb-4">
        {items.map((item) => (
          <div key={item.label} className="flex items-center gap-2">
            <span className="text-sm">{item.icon}</span>
            <span className="text-xs font-medium text-slate-600">
              {item.label}: {item.value}%
            </span>
          </div>
        ))}
      </div>
      
      {/* Barra de progreso segmentada */}
      <div className="relative h-4 bg-slate-100 rounded-full overflow-hidden shadow-inner">
        <div className="flex h-full">
          {items.map((item, index) => (
            <div
              key={item.label}
              className="transition-all duration-500 ease-out"
              style={{
                width: `${item.value}%`,
                background: `linear-gradient(135deg, ${item.color}, ${item.color}cc)`,
                borderRadius: index === 0 ? '9999px 0 0 9999px' : 
                            index === items.length - 1 ? '0 9999px 9999px 0' : '0'
              }}
            />
          ))}
        </div>
        
        {/* Overlay con efecto de brillo */}
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-pulse opacity-60" />
      </div>
    </div>
  );
};

const HeaderStatusBars = ({ headers }: { headers?: Record<string, any> }) => {
  const total = Object.keys(headers || {}).length;
  const present = Object.values(headers || {}).filter((h: any) => h && (h.present || h.ok || h.passed || h.value != null)).length;
  const missing = total - present;
  const pct = total === 0 ? 0 : Math.round((present / total) * 100);
  
  return (
    <div className="space-y-3">
      {/* Estadísticas compactas */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm text-slate-600">Presentes</span>
          <span className="font-bold text-green-600 text-lg">{present}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-slate-600">Faltantes</span>
          <span className="font-bold text-red-600 text-lg">{missing}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-slate-600">Cobertura</span>
          <span className="font-bold text-blue-600 text-lg">{pct}%</span>
        </div>
      </div>
      
      {/* Barra de progreso */}
      <div className="relative">
        <div className="h-3 bg-gradient-to-r from-red-100 to-green-100 rounded-full overflow-hidden shadow-inner">
          <div 
            className="h-full bg-gradient-to-r from-green-500 to-green-600 rounded-full transition-all duration-1000 ease-out relative"
            style={{ width: `${pct}%` }}
          >
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-pulse" />
          </div>
        </div>
        
        {/* Indicador textual compacto */}
        <div className="text-xs text-slate-600 mt-2 text-center">
          {present} de {total} encabezados
        </div>
      </div>
    </div>
  );
};

function getHeaderPresence(info: any) {
  return Boolean(info?.present || info?.ok || info?.passed || info?.value != null);
}

export default function SecurityDiagnosticoPanel({
  url,
  autoRunOnMount = true,
  initialResult,
  showInlineHistoryLink = false,
}: {
  url: string;
  autoRunOnMount?: boolean;
  initialResult?: any;
  showInlineHistoryLink?: boolean;
}) {
  const [securityLoading, setSecurityLoading] = useState(false);
  const [securityError, setSecurityError] = useState("");
  const [securityResult, setSecurityResult] = useState<any>(null);
  // NEW: history for sparkline in widget inside this panel
  const [securityHistory, setSecurityHistory] = useState<Array<{ fecha: string | number | Date; score: number | null }>>([]);
  // Estado para tooltips informativos
  const [showTestsTooltip, setShowTestsTooltip] = useState(false);
  const [showHeadersTooltip, setShowHeadersTooltip] = useState(false);

  // Cerrar tooltips al hacer clic fuera
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('.tooltip-container')) {
        setShowTestsTooltip(false);
        setShowHeadersTooltip(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const [showSecurityAbout, setShowSecurityAbout] = useState(false);
  const [expandedHeaders, setExpandedHeaders] = useState<Record<string, boolean>>({});
  const [showOnlyMissing, setShowOnlyMissing] = useState(false);
  const hasRunRef = useRef(false);
  // NEW: reference to capture this panel as PDF
  const captureRef = useRef<HTMLDivElement | null>(null);
  const navigate = useNavigate();

  const fetchHistory = async (theUrl: string) => {
    try {
      const ts = Date.now();
      const r = await fetch(`/api/security/history?url=${encodeURIComponent(theUrl)}&_=${ts}`, {
        headers: { "Cache-Control": "no-cache" },
      });
      if (!r.ok) return;
      const data = await safeParseJSON(r);
      if (Array.isArray(data)) {
        setSecurityHistory(
          data.map((d: any) => ({
            fecha: d.fecha,
            score: typeof d.score === "number" ? d.score : null,
          }))
        );
      }
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    if (url) void fetchHistory(url);
  }, [url]);

  // Si recibimos un resultado inicial (persistido), mostrarlo y evitar auto-run
  useEffect(() => {
    if (initialResult) {
      setSecurityResult(initialResult);
      setSecurityError("");
      setSecurityLoading(false);
      hasRunRef.current = true;
    }
  }, [initialResult]);

  const toggleHeaderDetail = (key: string) =>
    setExpandedHeaders((prev) => ({ ...prev, [key]: !prev[key] }));

  const copyText = async (text?: string) => {
    if (!text) return;
    try {
      await navigator.clipboard?.writeText?.(text);
    } catch {
      // ignore
    }
  };

  const handleSecurityDiagnostics = async () => {
    if (!url) return;
    setSecurityLoading(true);
    setSecurityError("");
    setSecurityResult(null);
    try {
      // 1) Intento directo al proxy
      const res = await fetch("/api/security-analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = await safeParseJSON(res);
      if (res.ok && !data?.error) {
        setSecurityResult(data);
        // refrescar historial para sparkline
        void fetchHistory(url);
        return;
      }

      // 2) Fallback: usar pipeline del backend que ya implementa reintentos/timeout y persiste
      const res2 = await fetch("/api/audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, type: "security", nocache: true })
      });
      const data2 = await safeParseJSON(res2);
      if (!res2.ok || data2?.error) throw new Error(data2?.error || "Error en el análisis de seguridad");

      const sec = (data2?.audit?.security ?? null) || data2?.security || null;
      if (sec) {
        setSecurityResult(sec);
        void fetchHistory(url);
        return;
      }
      throw new Error("Sin datos de seguridad en la respuesta");
    } catch (e: any) {
      setSecurityError(e?.message || "Error desconocido");
    } finally {
      setSecurityLoading(false);
    }
  };

  useEffect(() => {
    if (autoRunOnMount && !hasRunRef.current) {
      hasRunRef.current = true;
      handleSecurityDiagnostics();
    }
  }, [autoRunOnMount, url]);

  return (
    <Card className="mt-4 bg-gradient-to-br from-white to-slate-50 border-slate-200 shadow-lg">
      <CardHeader className="bg-gradient-to-r from-slate-50 to-white border-b border-slate-200">
        <CardTitle className="flex items-center gap-3 text-slate-800">
          🛡️ Diagnóstico de Seguridad
          <div className="ml-auto">
            {securityLoading && (
              <div className="flex items-center gap-2 text-sm text-blue-600">
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-600 border-t-transparent"></div>
                Analizando...
              </div>
            )}
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-6">
        {securityLoading && (
          <div className="space-y-6">
            {/* Loading con shimmer effect mejorado */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="relative h-32 rounded-xl bg-gradient-to-r from-slate-100 via-slate-50 to-slate-100 overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/60 to-transparent animate-pulse transform -skew-x-12"></div>
                </div>
              ))}
            </div>
            
            <div className="relative h-48 rounded-xl bg-gradient-to-r from-slate-100 via-slate-50 to-slate-100 overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/60 to-transparent animate-pulse transform -skew-x-12"></div>
            </div>
            
            <div className="text-center py-4">
              <div className="flex items-center justify-center gap-3 text-slate-600">
                <div className="animate-spin rounded-full h-6 w-6 border-3 border-blue-500 border-t-transparent"></div>
                <span className="font-medium">Ejecutando análisis de seguridad...</span>
              </div>
              <p className="text-sm text-slate-500 mt-2">
                Revisando encabezados HTTP, cookies y configuraciones de seguridad
              </p>
            </div>
          </div>
        )}
        
        {securityError && (
          <div className="bg-gradient-to-r from-red-50 to-pink-50 border border-red-200 rounded-xl p-6">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0">
                <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                  <span className="text-red-600 text-lg">⚠️</span>
                </div>
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-red-800 mb-2">Error en el análisis</h3>
                <p className="text-red-700 mb-4">{securityError}</p>
                <Button 
                  variant="outline" 
                  onClick={handleSecurityDiagnostics}
                  className="border-red-300 text-red-700 hover:bg-red-50 hover:border-red-400"
                >
                  🔄 Reintentar análisis
                </Button>
              </div>
            </div>
          </div>
        )}
        
        {!securityLoading && !securityError && !securityResult && (
          <div className="text-center py-12">
            <div className="max-w-md mx-auto">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <span className="text-2xl">🔒</span>
              </div>
              <h3 className="text-lg font-semibold text-slate-800 mb-3">
                Análisis de Seguridad Disponible
              </h3>
              <p className="text-slate-600 mb-6">
                Inicia el análisis para revisar los encabezados de seguridad HTTP, cookies y configuraciones de esta URL.
              </p>
              <Button 
                onClick={handleSecurityDiagnostics}
                className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white px-6 py-3 rounded-lg font-medium shadow-lg hover:shadow-xl transition-all duration-200"
              >
                🚀 Iniciar Análisis de Seguridad
              </Button>
            </div>
          </div>
        )}
        {securityResult && (
          // Wrap all visible result to capture into PDF
          <div ref={captureRef} className="flex flex-col gap-6">
            {/* Acerca del análisis */}
            <div className="rounded-lg border p-4 bg-slate-50">
              <button
                className="text-sm font-medium text-slate-700 cursor-pointer select-none inline-flex items-center gap-2 hover:text-slate-900"
                onClick={() => setShowSecurityAbout((v) => !v)}
                aria-expanded={showSecurityAbout}
                aria-controls="about-panel"
              >
                <Caret open={showSecurityAbout} />
                Acerca del análisis
              </button>
              <div
                id="about-panel"
                className={`text-sm text-slate-600 mt-2 transition-all ${showSecurityAbout ? "opacity-100" : "opacity-0 hidden"}`}
              >
                <div className="space-y-3">
                  <p>
                    El diagnóstico de seguridad se basa exclusivamente en evidencias objetivas de la respuesta HTTP real del sitio 
                    (cabeceras, cookies, redirecciones y un análisis superficial del HTML). No inventa datos, no altera el servidor 
                    y usa mejores prácticas de referencia (OWASP / MDN).
                  </p>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                    <div>✓ Fuente primaria: Cabeceras y cookies reales (verificable)</div>
                    <div>✓ Sin modificación del sistema auditado</div>
                    <div>✓ Reglas alineadas a estándares seguros comunes</div>
                    <div>⚠️ Limitado a superficie de cabeceras (no pentest completo)</div>
                  </div>
                  
                  <p className="text-xs leading-relaxed">
                    <strong>Alcance y limitaciones:</strong> El puntaje constituye un indicador técnico objetivo de la higiene 
                    de configuración observable en la capa HTTP (cabeceras como CSP, HSTS, X-Frame-Options, cookies seguras). 
                    Cada recomendación deriva de elementos verificables en la respuesta del servidor. La mejora del puntaje se 
                    logra aplicando buenas prácticas reconocidas que reducen vectores comunes como clickjacking y XSS reflejado. 
                    <em>Este puntaje no certifica cumplimiento normativo ni cubre vulnerabilidades lógicas, de autenticación o 
                    inyección, por lo que debe complementarse con pruebas adicionales.</em>
                  </p>
                </div>
              </div>
            </div>

            <SectionDivider
              label="Resumen"
              info={
                <>
                  Vista general del estado de seguridad para la URL analizada. El puntaje (0–100) se calcula a partir de
                  reglas y verificaciones de encabezados, cookies y hallazgos. Aquí verás: evolución histórica, top hallazgos,
                  conteo de pruebas OK, avisos y fallos, y un resumen de cuántos encabezados están presentes.
                </>
              }
            />
            {/* Resumen - Layout lado a lado */}
            <div className="flex flex-col lg:flex-row gap-6">
              {/* Panel principal con el gauge */}
              <div className="flex-1">
                <div className="rounded-lg border p-6 bg-gradient-to-br from-white to-slate-50">
                  <SecurityScoreWidget
                    score={securityResult?.score ?? securityResult?.securityScore ?? null}
                    grade={securityResult?.grade}
                    history={securityHistory}
                    topFindings={Array.isArray(securityResult?.findings)
                      ? securityResult.findings
                          .filter((f: any) => f?.severity === 'critical' || f?.severity === 'warning')
                          .slice(0, 3)
                      : []}
                  />
                </div>
              </div>
              
              {/* Panel lateral con métricas */}
              <div className="lg:w-80 flex flex-col gap-4">
                {/* Título del histórico */}
                <div className="text-center">
                  <h3 className="text-sm font-medium text-slate-600 mb-4 flex items-center justify-center gap-2">
                   Datos del Histórico de Seguridad
                  </h3>
                </div>
                
                {/* Estado de pruebas */}
                <div className="rounded-lg border p-4 bg-white">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                      📊 Estado de Pruebas
                    </h4>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-500 bg-slate-100 px-2 py-1 rounded-full">Histórico</span>
                      <div className="relative tooltip-container">
                        <button
                          type="button"
                          className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-blue-50 border border-blue-200 text-blue-600 hover:bg-blue-100 hover:text-blue-700 transition"
                          title="Información sobre el estado de pruebas"
                          onClick={() => setShowTestsTooltip(!showTestsTooltip)}
                        >
                          <Info size={12} strokeWidth={2.4} />
                        </button>
                        {showTestsTooltip && (
                          <div className="absolute right-0 top-6 z-50 w-72 p-3 bg-slate-900 text-white text-xs rounded-lg shadow-lg border">
                            <div className="font-semibold mb-2">Estado de Pruebas de Seguridad</div>
                            <div className="space-y-1 leading-relaxed">
                              <div><strong className="text-green-300">Revisadas:</strong> Pruebas que cumplieron los criterios de seguridad</div>
                              <div><strong className="text-amber-300">Avisos:</strong> Configuraciones que requieren atención</div>
                              <div><strong className="text-red-300">Mejoras por revisar:</strong> Elementos que necesitan corrección</div>
                            </div>
                            <div className="absolute -top-1 right-3 w-0 h-0 border-l-4 border-r-4 border-b-4 border-transparent border-b-slate-900"></div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-slate-600">Revisadas</span>
                      <span className="font-bold text-green-600 text-lg">
                        {securityResult?.summary?.passed ??
                          securityResult?.passCount ??
                          (Array.isArray(securityResult?.findings)
                            ? securityResult.findings.filter((f: any) => f?.passed).length
                            : '-')}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-slate-600">Avisos</span>
                      <span className="font-bold text-amber-600 text-lg">
                        {securityResult?.summary?.warnings ?? securityResult?.warningCount ?? '-'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-slate-600">Mejoras por revisar</span>
                      <span className="font-bold text-red-600 text-lg">
                        {securityResult?.summary?.failed ??
                          securityResult?.failCount ??
                          (Array.isArray(securityResult?.findings)
                            ? securityResult.findings.filter((f: any) => !f?.passed).length
                            : '-')}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Título fuera del cuadro indicando que es del histórico */}
                <h3 className="text-lg font-semibold text-slate-700 mb-2">📊 Datos del histórico</h3>
                
                {/* Estado de encabezados */}
                <div className="rounded-lg border p-4 bg-white">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                      🔒 Estado de Encabezados
                    </h4>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-500 bg-slate-100 px-2 py-1 rounded-full">Histórico</span>
                      <div className="relative tooltip-container">
                        <button
                          type="button"
                          className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-blue-50 border border-blue-200 text-blue-600 hover:bg-blue-100 hover:text-blue-700 transition"
                          title="Información sobre encabezados de seguridad"
                          onClick={() => setShowHeadersTooltip(!showHeadersTooltip)}
                        >
                          <Info size={12} strokeWidth={2.4} />
                        </button>
                        {showHeadersTooltip && (
                          <div className="absolute right-0 top-6 z-50 w-80 p-3 bg-slate-900 text-white text-xs rounded-lg shadow-lg border">
                            <div className="font-semibold mb-2">Estado de Encabezados de Seguridad</div>
                            <div className="space-y-1 leading-relaxed">
                              <div>Analiza la presencia y configuración de encabezados HTTP críticos para la seguridad:</div>
                              <div><strong className="text-blue-300">CSP:</strong> Content Security Policy - Previene XSS</div>
                              <div><strong className="text-emerald-300">HSTS:</strong> Strict Transport Security - Fuerza HTTPS</div>
                              <div><strong className="text-purple-300">X-Frame-Options:</strong> Previene clickjacking</div>
                              <div className="text-slate-300 mt-1">Y otros encabezados de protección importantes</div>
                            </div>
                            <div className="absolute -top-1 right-3 w-0 h-0 border-l-4 border-r-4 border-b-4 border-transparent border-b-slate-900"></div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  <HeaderStatusBars headers={securityResult?.headers} />
                </div>
              </div>
            </div>

            {/* Histórico simple (barras) */}
            {/* Reemplazado: solo mostrar el botón/enlace al histórico completo con el mismo estilo que Diagnóstico */}
            {showInlineHistoryLink && url && (
              <div className="mt-2">
                {(() => {
                  const { user } = useAuth();
                  const isCliente = user?.role === 'cliente';
                  return isCliente ? (
                    <button
                      type="button"
                      className="back-link cursor-not-allowed opacity-60 inline-flex items-center gap-1"
                      title="Acceso restringido para clientes"
                      aria-disabled
                    >
                      <Ban size={16} /> Histórico no disponible
                    </button>
                  ) : (
                    <Link to={`/security-history?url=${encodeURIComponent(url)}`} className="back-link">
                      Ver histórico de esta URL
                    </Link>
                  );
                })()}
              </div>
            )}

            {/* Encabezados */}
            {securityResult?.headers && typeof securityResult.headers === 'object' && (
              <>
                <SectionDivider
                  label="Encabezados"
                  info={
                    <>
                      Analiza la presencia y configuración de los principales encabezados HTTP de seguridad (CSP, HSTS, X-Frame-Options,
                      X-Content-Type-Options, Referrer-Policy, Permissions-Policy, entre otros). Cada tarjeta muestra si el encabezado
                      está presente, por qué es importante, la recomendación, valores sugeridos y ejemplos para Nginx/Apache/Express.
                    </>
                  }
                />
                {(() => {
                  const entries = Object.entries(securityResult.headers as Record<string, any>);
                  const sorted = entries.sort(([aKey, aInfo]: any, [bKey, bInfo]: any) => {
                    const aPres = getHeaderPresence(aInfo);
                    const bPres = getHeaderPresence(bInfo);
                    const aCrit = CRITICAL_HEADERS.includes(String(aKey).toLowerCase());
                    const bCrit = CRITICAL_HEADERS.includes(String(bKey).toLowerCase());
                    if (aPres !== bPres) return aPres ? 1 : -1; // faltantes primero
                    if (aCrit !== bCrit) return aCrit ? -1 : 1; // críticos antes
                    return String(aKey).localeCompare(String(bKey));
                  });
                  const filtered = showOnlyMissing
                    ? sorted.filter(([k, info]) => !getHeaderPresence(info))
                    : sorted;

                  return (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {filtered.map(([key, info]) => {
                        const normKey = String(key).toLowerCase();
                        const present = getHeaderPresence(info);
                        const statusColor = present ? '#16a34a' : '#ef4444';
                        const statusText = present ? 'Presente' : 'Falta';
                        const value: string | undefined = (info as any)?.value ?? (info as any)?.expected ?? undefined;
                        const detail = (info as any)?.message || (info as any)?.note || (info as any)?.expected || '';
                        const meta = (HEADER_INFO as any)[normKey] as any;
                        const isExpanded = !!expandedHeaders[normKey];

                        return (
                          <div key={normKey} className="rounded-lg border p-3 transition-colors hover:bg-slate-50">
                            <div className="flex items-start justify-between gap-3">
                              <div className="font-medium break-words">
                                {meta?.title || normKey}
                                <div className="text-xs text-slate-500">{normKey}</div>
                              </div>
                              <div className="flex items-center gap-2">
                                {CRITICAL_HEADERS.includes(normKey) && (
                                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-50 text-red-700">Crítico</span>
                                )}
                                <span
                                  className="text-xs px-2 py-0.5 rounded-full"
                                  style={{ background: present ? 'rgba(22,163,74,0.06)' : 'rgba(239,68,68,0.06)', color: statusColor }}
                                  title={present ? 'El encabezado está presente' : 'El encabezado falta'}
                                >
                                  {statusText}
                                </span>
                                <button
                                  className="text-xs text-slate-600 underline cursor-pointer hover:text-slate-900"
                                  onClick={() => toggleHeaderDetail(normKey)}
                                  aria-expanded={isExpanded}
                                >
                                  Detalles
                                </button>
                              </div>
                            </div>

                            {value ? (
                              <div className="mt-2 flex items-center gap-2">
                                <code className="text-xs bg-slate-100 px-2 py-1 rounded whitespace-pre-wrap break-all">
                                  {value}
                                </code>
                                <button
                                  className="p-1 rounded hover:bg-slate-200 transition-colors cursor-pointer"
                                  onClick={() => copyText(String(value))}
                                  title="Copiar valor"
                                  aria-label="Copiar valor"
                                >
                                  <CopyIcon />
                                </button>
                              </div>
                            ) : null}

                            {detail ? (
                              <div className="text-xs text-slate-600 mt-1 break-words">{detail}</div>
                            ) : null}

                            <div className={`mt-2 text-xs bg-slate-50 border rounded p-2 transition-all ${isExpanded ? "opacity-100" : "opacity-0 hidden"}`}>
                              <div>
                                <strong>¿Por qué importa?</strong> {
                                  meta?.why ?? 
                                  meta?.description ?? 
                                  'Este encabezado de seguridad ayuda a proteger la aplicación contra vulnerabilidades comunes y mejora la postura de seguridad general.'
                                }
                              </div>
                              <div className="mt-1">
                                <strong>Recomendación:</strong> {
                                  meta?.recommendation ?? 
                                  meta?.suggestion ?? 
                                  'Configure este encabezado siguiendo las mejores prácticas de seguridad para su caso de uso específico.'
                                }
                              </div>
                              {meta?.expected && (
                                <div className="mt-1">
                                  <strong>Valor recomendado:</strong>
                                  <div>
                                    <code className="text-[11px] bg-white border rounded px-2 py-1 inline-block mt-1">{meta.expected}</code>
                                  </div>
                                </div>
                              )}
                              {meta?.learnMore && (
                                <div className="mt-1">
                                  <a href={meta.learnMore} target="_blank" rel="noreferrer" className="text-blue-600 underline" title="Abrir documentación">Más info</a>
                                </div>
                              )}
                              {meta?.nginx && (
                                <div className="mt-2">
                                  <div className="text-[11px] font-medium">nginx</div>
                                  <pre className="text-xs bg-black text-white p-2 rounded mt-1 overflow-auto">{meta.nginx}</pre>
                                </div>
                              )}
                              {meta?.apache && (
                                <div className="mt-2">
                                  <div className="text-[11px] font-medium">Apache</div>
                                  <pre className="text-xs bg-black text-white p-2 rounded mt-1 overflow-auto">{meta.apache}</pre>
                                </div>
                              )}
                              {meta?.express && (
                                <div className="mt-2">
                                  <div className="text-[11px] font-medium">Node / Express</div>
                                  <pre className="text-xs bg-black text-white p-2 rounded mt-1 overflow-auto">{meta.express}</pre>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </>
            )}

            {/* Cookies */}
            {securityResult?.cookies && (
              <>
                <SectionDivider
                  label="Cookies"
                  info={
                    <>
                      Revisa cookies detectadas en la primera respuesta y valida banderas de seguridad como Secure, HttpOnly y SameSite.
                      Estas ayudan a mitigar robo de cookies y ataques CSRF. Se listan atributos clave (dominio, path, expiración) para su auditoría.
                    </>
                  }
                />
                <div>
                  <h3 className="text-lg font-semibold mb-2">Cookies</h3>
                  {Array.isArray(securityResult.cookies) ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {securityResult.cookies.map((ck: any, i: number) => (
                        <div key={i} className="rounded-lg border p-3">
                          <div className="flex items-start justify-between">
                            <div className="font-medium break-words">{ck?.name || '(sin nombre)'}</div>
                            <div className="flex items-center gap-1 text-[10px]">
                              {ck?.secure && <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">Secure</span>}
                              {ck?.httpOnly && <span className="px-2 py-0.5 rounded-full bg-sky-50 text-sky-700">HttpOnly</span>}
                              {ck?.sameSite && <span className="px-2 py-0.5 rounded-full bg-violet-50 text-violet-700">SameSite:{ck.sameSite}</span>}
                            </div>
                          </div>
                          {ck?.value && (
                            <div className="mt-2">
                              <div className="text-[11px] text-slate-500">Valor</div>
                              <code className="text-xs bg-slate-100 px-2 py-1 rounded whitespace-pre-wrap break-all">{ck.value}</code>
                            </div>
                          )}
                          <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-slate-600">
                            {ck?.domain && <div><span className="font-medium">Dominio:</span> {ck.domain}</div>}
                            {ck?.path && <div><span className="font-medium">Path:</span> {ck.path}</div>}
                            {ck?.expires && <div><span className="font-medium">Expira:</span> {ck.expires}</div>}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }} className="text-xs bg-slate-50 border rounded p-3">
                      {JSON.stringify(securityResult.cookies, null, 2)}
                    </pre>
                  )}
                </div>
              </>
            )}

            {/* Hallazgos */}
            {Array.isArray(securityResult?.findings) && securityResult.findings.length > 0 && (
              <>
                <SectionDivider
                  label="Hallazgos"
                  info={
                    <>
                      Resultados adicionales derivados de heurísticas y comprobaciones automatizadas (por ejemplo, políticas demasiado permisivas o
                      redirecciones inseguras). Cada elemento indica si pasó o requiere revisión y su severidad para priorización.
                    </>
                  }
                />
                <div>
                  <h3 className="text-lg font-semibold mb-2">Hallazgos</h3>
                  <div className="flex flex-col gap-2">
                    {securityResult.findings.map((f: any, idx: number) => {
                      const sev = (f?.severity || '').toString().toLowerCase();
                      const color = sev.includes('high') ? '#ef4444' : sev.includes('medium') ? '#f59e0b' : '#2563eb';
                      const passed = f?.passed === true;
                      return (
                        <div key={idx} className="rounded-lg border p-3">
                          <div className="flex items-start justify-between gap-3">
                            <div className="font-medium break-words">{f?.title || f?.id || f?.rule || 'Hallazgo'}</div>
                            <span
                              className="text-xs px-2 py-0.5 rounded-full"
                              style={{ background: passed ? 'rgba(22,163,74,0.1)' : 'rgba(239,68,68,0.1)', color: passed ? '#16a34a' : '#ef4444' }}
                            >
                              {passed ? 'OK' : 'Revisar'}
                            </span>
                          </div>
                          {f?.message || f?.description ? (
                            <div className="text-xs text-slate-600 mt-1 break-words">{f?.message || f?.description}</div>
                          ) : null}
                          {sev ? (
                            <div className="text-[10px] mt-2 inline-block px-2 py-0.5 rounded-full" style={{ background: 'rgba(37,99,235,0.06)', color }}>
                              Severidad: {f?.severity}
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </>
            )}

            {/* Derivados: Errores, Mejoras y Plan de acción */}
            {(() => {
              const d = deriveSecurityPlan(securityResult);
              return (
                <>
                  {(d.errors.length > 0 || d.improvements.length > 0 || d.plan.length > 0) && (
                    <SectionDivider
                      label="Plan de acción"
                      info={
                        <>
                          Lista priorizada generada a partir de fallos y mejoras detectadas. Incluye recomendaciones concretas para implementar
                          los encabezados o ajustes necesarios en tu servidor o aplicación.
                        </>
                      }
                    />
                  )}

                  {d.errors.length > 0 && (
                    <div>
                      <h3 className="text-lg font-semibold mb-2 text-red-700">Errores detectados</h3>
                      <ul className="list-disc pl-5 space-y-1 text-sm">
                        {d.errors.map((e) => (
                          <li key={e.id} dangerouslySetInnerHTML={{ __html: `<strong>${e.title}</strong>: ${e.recommendation}` }} />
                        ))}
                      </ul>
                    </div>
                  )}

                  {d.improvements.length > 0 && (
                    <div>
                      <h3 className="text-lg font-semibold mb-2 text-amber-700">Mejoras recomendadas</h3>
                      <ul className="list-disc pl-5 space-y-1 text-sm">
                        {d.improvements.map((e) => (
                          <li key={e.id} dangerouslySetInnerHTML={{ __html: `<strong>${e.title}</strong>: ${e.recommendation}` }} />
                        ))}
                      </ul>
                    </div>
                  )}

                  {d.plan.length > 0 && (
                    <div>
                      <h3 className="text-lg font-semibold mb-2">Plan de acción</h3>
                      <ol className="list-decimal pl-5 space-y-1 text-sm">
                        {d.plan.map((p) => (
                          <li key={p.id} className="break-words">{p.title} — <span className="text-slate-600">{p.recommendation}</span></li>
                        ))}
                      </ol>
                    </div>
                  )}
                </>
              );
            })()}

            {!securityResult?.headers && !securityResult?.cookies && !Array.isArray(securityResult?.findings) && (
              <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{JSON.stringify(securityResult, null, 2)}</pre>
            )}

            {/* Separator + Email PDF at the bottom */}
            <SectionDivider
              label="Exportación PDF"
              info={
                <>
                  Genera un PDF con todo el diagnóstico de seguridad mostrado en pantalla para compartir con tu equipo o stakeholders.
                  El documento incluye puntajes, encabezados, hallazgos y el plan de acción.
                </>
              }
            />
            <div className="mt-2">
              <EmailPdfBar
                captureRef={captureRef as any}
                url={url}
                subject={`Diagnóstico de Seguridad: ${url}`}
                endpoint="/api/security/send-diagnostic"
                includePdf={true}
                hideEmailInput={true}
              />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}