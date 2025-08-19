// src/components/DiagnosticoView.tsx
import React, { useState, useEffect, useRef, type FormEvent } from 'react';
import { useParams, Link, useLocation } from 'react-router-dom';
import CircularGauge from './CircularGauge';
import ActionPlanPanel from './ActionPlanPanel';
import EmailSendBar from "./EmailPdfBar";
import '../styles/diagnostico.css';

const API_LABELS: Record<string, string> = { pagespeed: 'Lighthouse', unlighthouse: 'Unlighthouse' };

// ---------------- Utils ----------------
async function safeParseJSON(res: Response): Promise<any> {
  const text = await res.text();
  try { return JSON.parse(text || '{}'); }
  catch { return { _raw: text }; }
}

const toSeconds = (ms: number | null | undefined): number | null =>
  (typeof ms === 'number' && !Number.isNaN(ms))
    ? Math.round((ms / 1000) * 10) / 10
    : null;

type MetricId = 'performance' | 'fcp' | 'lcp' | 'tbt' | 'si' | 'ttfb' | string;
function gaugeColor(metricId: MetricId, value: number | null | undefined) {
  const green = '#22c55e', amber = '#f59e0b', red = '#ef4444', gray = '#9ca3af';
  if (value == null) return gray;
  if (metricId === 'performance') return value >= 90 ? green : value >= 50 ? amber : red;
  switch (metricId) {
    case 'fcp':  return value < 1.8 ? green : value <= 3.0 ? amber : red;
    case 'lcp':  return value < 2.5 ? green : value <= 4.0 ? amber : red;
    case 'tbt':  return value < 0.2 ? green : value <= 0.6 ? amber : red;
    case 'si':   return value < 3.4 ? green : value <= 5.8 ? amber : red;
    case 'ttfb': return value < 0.8 ? green : value <= 1.8 ? amber : red;
    default:     return amber;
  }
}
type Trend = 'up' | 'down' | 'flat' | string;
const trendSymbol = (t?: Trend) => t === 'up' ? '↑' : t === 'down' ? '↓' : '→';
const trendColor  = (t?: Trend) => t === 'up' ? '#16a34a' : t === 'down' ? '#ef4444' : '#6b7280';

// ✅ Busca audits en cualquier forma (PSI remoto y Lighthouse local)
function pickAudits(apiData: any): Record<string, any> {
  return (
    apiData?.raw?.lighthouseResult?.audits || // PSI
    apiData?.raw?.audits ||                   // LOCAL (LHR puro)
    apiData?.lighthouseResult?.audits ||
    apiData?.result?.lhr?.audits ||
    apiData?.result?.lighthouseResult?.audits ||
    apiData?.data?.lhr?.audits ||
    apiData?.data?.lighthouseResult?.audits ||
    apiData?.audits ||
    {}
  );
}

//TRADUCCION DE LOS ERRORES DE LA API DE PAGESPEED-LIGHTHOUSE
// ---------- i18n ES (fallback robusto) ----------
const T_EXACT = new Map<string, string>([
  // Títulos / oportunidades
  ['Use video formats for animated content', 'Usar formatos de video para contenido animado'],
  ['Avoid serving legacy JavaScript to modern browsers', 'Evitar servir JavaScript heredado a navegadores modernos'],
  ['Eliminate render-blocking resources', 'Eliminar recursos que bloquean el renderizado'],
  ['Avoid `document.write()`', 'Evitar `document.write()`'],
  ['Reduce unused JavaScript', 'Reducir JavaScript no utilizado'],
  ['Reduce unused CSS', 'Reducir CSS no utilizado'],
  ['Serve images in next-gen formats', 'Servir imágenes en formatos modernos'],
  ['Efficiently encode images', 'Codificar imágenes eficientemente'],
  ['Properly size images', 'Ajustar tamaño de imágenes'],
  ['Defer offscreen images', 'Diferir imágenes fuera de pantalla'],
  ['Preload key requests', 'Precargar solicitudes clave'],
  ['Avoid chaining critical requests', 'Evitar encadenamiento de solicitudes críticas'],
  ['Enable text compression', 'Habilitar compresión de texto'],
  ['Serve static assets with an efficient cache policy', 'Servir recursos estáticos con una política de caché eficiente'],
  ['Avoid enormous network payloads', 'Evitar cargas de red enormes'],
  ['Reduce server response times (TTFB)', 'Reducir el tiempo de respuesta del servidor (TTFB)'],
  ['Largest Contentful Paint element', 'Elemento de la pintura de contenido más grande (LCP)'],
  ['Render blocking requests', 'Solicitudes que bloquean el renderizado'],

  // Métricas/diagnósticos
  ['First Contentful Paint', 'Primera pintura con contenido (FCP)'],
  ['Largest Contentful Paint', 'Pintura de mayor contenido (LCP)'],
  ['Speed Index', 'Índice de velocidad (SI)'],
  ['Time to Interactive', 'Tiempo hasta interactivo (TTI)'],
  ['Total Blocking Time', 'Tiempo total de bloqueo (TBT)'],
  ['Max Potential First Input Delay', 'Retraso potencial máximo de la primera interacción (Max Potential FID)'],
  ['Network dependency tree', 'Árbol de dependencias de red'],
  ['LCP request discovery', 'Descubrimiento de solicitud de LCP'],
  ['Forced reflow', 'Reflujo forzado'],
  ['Image elements do not have explicit `width` and `height`', 'Los elementos de imagen no tienen `width` ni `height` explícitos'],
  ['Document request latency', 'Latencia de la solicitud del documento'],
  ['Preload Largest Contentful Paint image', 'Precargar la imagen de LCP'],
  ['Reduce the impact of third-party code', 'Reducir el impacto del código de terceros'],
  ['Use efficient cache lifetimes', 'Usar tiempos de caché eficientes'],
  ['Minify CSS', 'Minificar CSS'],
  ['Minify JavaScript', 'Minificar JavaScript'],
  ['Remove duplicate modules in JavaScript bundles', 'Eliminar módulos duplicados en paquetes de JavaScript'],
  ['Initial server response time was short', 'El tiempo de respuesta inicial del servidor fue corto'],
  ['Page prevented back/forward cache restoration', 'La página impidió la restauración de la caché de retroceso/avance (bfcache)'],
  ['Legacy JavaScript', 'JavaScript heredado'],
]);

function norm(s: unknown) {
  return String(s || '')
    .toLowerCase()
    .replace(/[`’'"]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

const T_SOFT = new Map<string, string>([
  ['render blocking requests', 'Solicitudes que bloquean el renderizado'],
  ['use video formats for animated content', 'Usar formatos de video para contenido animado'],
  ['avoid serving legacy javascript to modern browsers', 'Evitar servir JavaScript heredado a navegadores modernos'],
  ['eliminate render blocking resources', 'Eliminar recursos que bloquean el renderizado'],
  ['avoid document.write()', 'Evitar document.write()'],
  ['reduce unused javascript', 'Reducir JavaScript no utilizado'],
  ['reduce unused css', 'Reducir CSS no utilizado'],
  ['serve images in next gen formats', 'Servir imágenes en formatos modernos'],
  ['efficiently encode images', 'Codificar imágenes eficientemente'],
  ['properly size images', 'Ajustar tamaño de imágenes'],
  ['defer offscreen images', 'Diferir imágenes fuera de pantalla'],
  ['avoid chaining critical requests', 'Evitar encadenamiento de solicitudes críticas'],
  ['enable text compression', 'Habilitar compresión de texto'],
  ['serve static assets with an efficient cache policy', 'Servir recursos estáticos con una política de caché eficiente'],
  ['avoid enormous network payloads', 'Evitar cargas de red enormes'],
  ['reduce server response times (ttfb)', 'Reducir el tiempo de respuesta del servidor (TTFB)'],
  ['first contentful paint', 'Primera pintura con contenido (FCP)'],
  ['largest contentful paint', 'Pintura de mayor contenido (LCP)'],
  ['speed index', 'Índice de velocidad (SI)'],
  ['time to interactive', 'Tiempo hasta interactivo (TTI)'],
  ['total blocking time', 'Tiempo total de bloqueo (TBT)'],
  ['max potential first input delay', 'Retraso potencial máximo de la primera interacción (Max Potential FID)'],
  ['network dependency tree', 'Árbol de dependencias de red'],
  ['lcp request discovery', 'Descubrimiento de solicitud de LCP'],
  ['forced reflow', 'Reflujo forzado'],
  ['image elements do not have explicit width and height', 'Los elementos de imagen no tienen width ni height explícitos'],
  ['document request latency', 'Latencia de la solicitud del documento'],
  ['preload largest contentful paint image', 'Precargar la imagen de LCP'],
  ['reduce the impact of third party code', 'Reducir el impacto del código de terceros'],
  ['use efficient cache lifetimes', 'Usar tiempos de caché eficientes'],
  ['remove duplicate modules in javascript bundles', 'Eliminar módulos duplicados en paquetes de JavaScript'],
  ['initial server response time was short', 'El tiempo de respuesta inicial del servidor fue corto'],
  ['page prevented back forward cache restoration', 'La página impidió la restauración de la caché de retroceso/avance (bfcache)'],
  ['legacy javascript', 'JavaScript heredado'],
]);

export function tTitle(s: unknown) {
  if (typeof s !== 'string') return s;
  return T_EXACT.get(s) || T_SOFT.get(norm(s)) || s;
}

/** Reemplazos por frases comunes en descripciones largas (preserva markdown/links) */
const REPL_LIST: Array<[RegExp, string]> = [
  // TTFB (mantener respuesta del servidor corta)
[/^Keep the server response time for the main document short because all other requests depend on it\./gi,
 'Mantén corto el tiempo de respuesta del servidor para el documento principal, porque todas las demás solicitudes dependen de él.'],

// Formatos de imagen modernos (WebP/AVIF)
[/^Image formats like WebP and AVIF often provide better compression than PNG or JPEG, which means faster downloads and less data consumption\./gi,
 'Los formatos de imagen como WebP y AVIF suelen ofrecer mejor compresión que PNG o JPEG, lo que implica descargas más rápidas y menor consumo de datos.'],

// Listeners pasivos
[/^Consider marking your touch and wheel event listeners as `passive` to improve your page's scroll performance\./gi,
 'Considera marcar tus listeners de eventos de toque y rueda como `passive` para mejorar el rendimiento del desplazamiento de la página.'],

  // DOM grande
  [/^A large DOM will increase memory usage, cause longer\b/gi,
   'Un DOM grande aumentará el uso de memoria, provocará '],
  [/, and produce costly\b/gi, ', y generará '],

  // Reflow forzado
  [/^A forced reflow occurs when JavaScript queries geometric properties \(such as offsetWidth\) after styles have been invalidated by a change to the DOM state\./gi,
   'Se produce un reflujo forzado cuando JavaScript consulta propiedades geométricas (como offsetWidth) después de que los estilos han quedado invalidados por un cambio en el estado del DOM.'],
  [/This can result in poor performance\./gi, 'Esto puede resultar en un rendimiento deficiente.'],

  // CLS
  [/Cumulative Layout Shift measures the movement of visible elements within the viewport\./gi,
   'Cumulative Layout Shift (CLS) mide el movimiento de los elementos visibles dentro del viewport.'],

  // LCP / FCP
  [/This is the largest contentful element painted within the viewport\./gi,
   'Este es el elemento de contenido más grande pintado dentro del viewport.'],
  [/Largest Contentful Paint marks the time at which the largest text or image is painted\./gi,
   'Largest Contentful Paint (LCP) marca el tiempo en el que se pinta el texto o imagen más grande.'],
  [/First Contentful Paint marks the time at which the first text or image is painted\./gi,
   'First Contentful Paint (FCP) indica el tiempo en el que se pinta el primer texto o imagen.'],

  // LCP discovery / Preload LCP
  [/^Optimize LCP by making the LCP image \[discoverable\]\(([^)]+)\) from the HTML immediately, and \[avoiding lazy-loading\]\(([^)]+)\)\./gi,
   'Optimiza LCP haciendo que la imagen de LCP sea [detectable]($1) desde el HTML inmediatamente y [evitando la carga diferida]($2).'],
  [/^If the LCP element is dynamically added to the page, you should preload the image in order to improve LCP\./gi,
   'Si el elemento de LCP se añade dinámicamente a la página, deberías precargar la imagen para mejorar el LCP.'],

  // Redirecciones
  [/^Redirects introduce additional delays before the page can be loaded\./gi,
   'Las redirecciones introducen retrasos adicionales antes de que la página pueda cargarse.'],

  // Árbol de dependencias de red
  [/^Avoid chaining critical requests by reducing the length of chains, reducing the download size of resources, or deferring the download of unnecessary resources to improve page load\./gi,
   'Evita el encadenamiento de solicitudes críticas reduciendo la longitud de las cadenas, disminuyendo el tamaño de descarga de recursos o aplazando la descarga de recursos innecesarios para mejorar la carga de la página.'],

  // Legacy JS
  [/^Polyfills and transforms enable older browsers to use new JavaScript features\./gi,
   'Los polyfills y transformaciones permiten que navegadores antiguos usen nuevas características de JavaScript.'],
  [/^However, many aren’t necessary for modern browsers\./gi,
   'Sin embargo, muchas no son necesarias para navegadores modernos.'],
  [/^Consider modifying your JavaScript build process to not transpile \[Baseline\]\(([^)]+)\) features, unless you know you must support older browsers\./gi,
   'Considera modificar tu proceso de build para no transpilar características de [Baseline]($1), a menos que necesites soportar navegadores antiguos.'],

  // Render blocking requests
  [/^Requests are blocking the page's initial render, which may delay LCP\./gi,
   'Solicitudes de red están bloqueando el renderizado inicial de la página, lo que puede retrasar el LCP.'],
  [/^\[Deferring or inlining\]\(([^)]+)\) can move these network requests out of the critical path\./gi,
   '[Diferir o inyectar en línea]($1) puede sacar estas solicitudes de la ruta crítica.'],

  // Reduce unused JS (descripción larga)
  [/^Reduce unused JavaScript and defer loading scripts until they are required to decrease bytes consumed by network activity\./gi,
   'Reduce JavaScript no utilizado y difiere la carga de scripts hasta que sean necesarios para disminuir los bytes consumidos por la actividad de red.'],

  // Third-party impact
  [/^Third-?party code can significantly impact load performance\./gi,
   'El código de terceros puede afectar significativamente el rendimiento de carga.'],
  [/^Limit the number of redundant third-?party providers and try to load third-?party code after your page has primarily finished loading\./gi,
   'Limita la cantidad de proveedores de terceros redundantes e intenta cargar el código de terceros después de que la página haya terminado de cargar principalmente.'],

  // TTI/TBT/FID
  [/^Speed Index shows how quickly the contents of a page are visibly populated\./gi,
   'El Índice de Velocidad (Speed Index) muestra qué tan rápido se vuelve visible el contenido de una página.'],
  [/^The maximum potential First Input Delay that your users could experience is the duration of the longest task\./gi,
   'El retraso potencial máximo de la primera interacción que podrían experimentar tus usuarios es la duración de la tarea más larga.'],
  [/^Time to Interactive is the amount of time it takes for the page to become fully interactive\./gi,
   'El Tiempo hasta Interactivo (TTI) es el tiempo que tarda la página en volverse completamente interactiva.'],
  [/^Sum of all time periods between FCP and Time to Interactive, when task length exceeded 50ms, expressed in milliseconds\./gi,
   'Suma de todos los períodos entre FCP y Tiempo hasta Interactivo en los que la duración de las tareas excedió 50 ms, expresada en milisegundos.'],

  // Imagen sin width/height
  [/^Image elements do not have explicit `width` and `height`/gi,
   'Los elementos de imagen no tienen `width` ni `height` explícitos'],

  // Latencia primera solicitud / TTFB
  [/^Your first network request is the most important\. Reduce its latency by avoiding redirects, ensuring a fast server response, and enabling text compression\./gi,
   'Tu primera solicitud de red es la más importante. Reduce su latencia evitando redirecciones, asegurando una respuesta rápida del servidor y habilitando compresión de texto.'],

  // bfcache
  [/^Many navigations are performed by going back to a previous page, or forwards again\. The back\/forward cache \(bfcache\) can speed up these return navigations\./gi,
   'Muchas navegaciones se realizan volviendo a la página anterior o avanzando de nuevo. La caché de retroceso/avance (bfcache) puede acelerar estos regresos.'],

  // Genéricas
  [/\bFor users on slow connections\b/gi, 'Para usuarios con conexiones lentas'],
  [/\bcan delay page load by tens of seconds\b/gi, 'puede retrasar la carga de la página varios segundos'],
  [/\bto save network bytes\b/gi, 'para ahorrar bytes de red'],
  [/\binstead of\b/gi, 'en lugar de'],
  [/\bConsider using\b/gi, 'Considera usar'],
];

/** Traducción de anclas/links: Learn/More information + “about …” + “how to …” + “why …” */
function translateLinkAnchors(md: string): string {
  let out = md;
  out = out.replace(/\[Learn more\]\(([^)]+)\)/gi, '[Más información]($1)');
  out = out.replace(/\[More information\]\(([^)]+)\)/gi, '[Más información]($1)');
  out = out.replace(/\[Learn more about ([^\]]+)\]\(([^)]+)\)/gi, '[Más información sobre $1]($2)');
  out = out.replace(/\[More information about ([^\]]+)\]\(([^)]+)\)/gi, '[Más información sobre $1]($2)');
  out = out.replace(/\[Learn how to ([^\]]+)\]\(([^)]+)\)/gi, '[Aprende cómo $1]($2)');
  out = out.replace(/\[Learn why ([^\]]+)\]\(([^)]+)\)/gi, '[Aprende por qué $1]($2)');
  // TTFB (sin “the” en el texto ancla)
  out = out.replace(/Más información sobre Time to First Byte metric/gi,
                    'Más información sobre la métrica Time to First Byte (TTFB)');

  // Formatos de imagen modernos
  out = out.replace(/Más información sobre modern image formats/gi,
                    'Más información sobre formatos de imagen modernos');

  // Listeners pasivos
  out = out.replace(/Más información sobre adopting passive event listeners/gi,
                    'Más información sobre el uso de listeners de eventos pasivos');

  // (Por si aparece “use passive event listeners”)
  out = out.replace(/Más información sobre use passive event listeners/gi,
                    'Más información sobre el uso de listeners de eventos pasivos');

  // Pulir “sobre the …”
  out = out.replace(/(Más información sobre )the /gi, '$1');

  // Afinar frases dentro del texto ancla más comunes
  out = out
    .replace(/Aprende cómo reduce unused JavaScript/gi, 'Aprende cómo reducir JavaScript no utilizado')
    .replace(/Aprende cómo eliminate render[- ]blocking resources/gi, 'Aprende cómo eliminar recursos que bloquean el renderizado')
    .replace(/Aprende cómo defer offscreen images/gi, 'Aprende cómo diferir imágenes fuera de pantalla')
    .replace(/Aprende cómo minimize third[- ]party impact/gi, 'Aprende cómo minimizar el impacto de terceros')
    .replace(/Más información sobre preloading LCP elements/gi, 'Más información sobre la precarga de elementos LCP')
    .replace(/Más información sobre the Largest Contentful Paint element/gi, 'Más información sobre el elemento de LCP (Largest Contentful Paint)')
    .replace(/Más información sobre the Time to First Byte metric/gi, 'Más información sobre la métrica Time to First Byte (TTFB)');
  return out;
}

export function tRich(s: unknown) {
  if (typeof s !== 'string' || !s) return s as any;
  let out = s;
  out = translateLinkAnchors(out);
  for (const [re, rep] of REPL_LIST) out = out.replace(re, rep);
  return out;
}

// ---------------- Types for processed/audit ----------------
type ProcessedMetric = { key: string; raw: number | null; trend?: Trend };
type ProcessedData = {
  metrics?: ProcessedMetric[];
  errors?: any[];
  improvements?: any[];
  opportunities?: any[];
};

type AuditEnvelope = {
  url?: string;
  fecha?: string;
  email?: string;
  audit?: Record<string, any>;
};

// ---------------- Builders ----------------
function buildFindings(apiData: any, processed: ProcessedData | null) {
  const fromProcessed = {
    errors: Array.isArray(processed?.errors) ? processed!.errors : [],
    improvements: Array.isArray(processed?.improvements) ? processed!.improvements : [],
  };
  if (fromProcessed.errors.length || fromProcessed.improvements.length) return fromProcessed;

  const auditsObj = pickAudits(apiData);
  const all = Object.entries(auditsObj).map(([id, a]) => ({ id, ...(a as any) }));

  const errors: any[] = [];
  const improvements: any[] = [];

  for (const a of all) {
    if (a?.scoreDisplayMode === 'manual' || a?.scoreDisplayMode === 'notApplicable') continue;

    const item = {
      id: (a as any).id,
      title: tTitle((a as any).title || (a as any).id),
      description: tRich((a as any).description || ''),
      displayValue: (a as any).displayValue || '',
      details: (a as any).details || null,
      score: typeof (a as any).score === 'number' ? (a as any).score : null,
      typeHint: (a as any)?.details?.type || null, // 'opportunity' | 'diagnostic'
    };

    if (typeof item.score === 'number') {
      if (item.score < 0.5) errors.push(item);
      else if (item.score < 1) improvements.push(item);
    } else if (item.typeHint === 'opportunity') {
      improvements.push(item);
    }
  }

  errors.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
  improvements.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
  return { errors, improvements };
}

function buildOpportunities(apiData: any, processed: ProcessedData | null) {
  if (Array.isArray(processed?.opportunities) && processed!.opportunities!.length) {
    return processed!.opportunities!.map((o: any) => ({
      type: 'improvement',
      severity: 'info',
      impactScore: 100,
      ...o,
      title: tTitle(o.title || o.id),
      recommendation: tRich(o.recommendation || ''),
    }));
  }

  const auditsObj = pickAudits(apiData);
  const all = Object.entries(auditsObj).map(([id, a]) => ({ id, ...(a as any) }));
  const opps: any[] = [];

  for (const a of all) {
    const d = (a as any).details || {};
    const hasOppType = d.type === 'opportunity';
    const savingsMs = (typeof d.overallSavingsMs === 'number') ? d.overallSavingsMs : null;
    const savingsB  = (typeof d.overallSavingsBytes === 'number') ? d.overallSavingsBytes : null;

    if (hasOppType || savingsMs != null || savingsB != null) {
      let savingsLabel = '';
      if (savingsMs != null && savingsMs > 0) {
        savingsLabel = (savingsMs >= 100)
          ? `${Math.round((savingsMs/1000)*10)/10}s`
          : `${Math.round(savingsMs)}ms`;
      } else if (savingsB != null && savingsB > 0) {
        const kb = savingsB/1024;
        savingsLabel = (kb >= 1024) ? `${(kb/1024).toFixed(1)}MB` : `${Math.round(kb)}KB`;
      } else if ((a as any).displayValue) {
        savingsLabel = (a as any).displayValue;
      }

      opps.push({
        id: (a as any).id,
        title: tTitle((a as any).title || (a as any).id),
        recommendation: tRich((a as any).description || ''),
        savingsLabel,
        impactScore: (savingsMs || 0) + (savingsB ? Math.min(savingsB/10, 1000) : 0),
        type: 'improvement',
        severity: 'info',
      });
    }
  }
  opps.sort((b, a) => ((a as any).impactScore || 0) - ((b as any).impactScore || 0));
  return opps;
}

// ---------------- Component ----------------
export default function DiagnosticoView() {
  const params = useParams();
  const location = useLocation();
  const id: string | null = (params as any)?.id || new URLSearchParams(location.search).get('id');

  const [auditData, setAuditData] = useState<AuditEnvelope | null>(null);
  const [err, setErr] = useState<string>('');
  const [activeApi, setActiveApi] = useState<string>('');
  const [processed, setProcessed] = useState<ProcessedData | null>(null);

  const contenedorReporteRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setAuditData(null); setErr(''); setActiveApi(''); setProcessed(null);
    if (!id) return;
    const isValidObjectId = /^[0-9a-fA-F]{24}$/.test(String(id).trim());
    if (!isValidObjectId) { setErr('ID inválido'); return; }

    let mounted = true;
    (async () => {
      try {
        const res = await fetch(`/api/audit/${id}`);
        const payload = await safeParseJSON(res);
        if (!res.ok) {
          const msg = payload.error || payload.message || payload._raw || `HTTP ${res.status}`;
          throw new Error(msg);
        }

        const available = Object.keys(payload.audit || {}).filter(k => {
          const m = (payload.audit?.[k] || {}).metrics || payload.audit?.[k] || {};
          return Object.keys(m).length > 0;
        });
        const ORDER = ['pagespeed','unlighthouse'] as const;
        const apis = ORDER.filter(k => available.includes(k));

        if (mounted) {
          setActiveApi(apis[0] || '');
          setAuditData(payload);

          if (payload.url) {
            fetch(`/api/diagnostics/${encodeURIComponent(payload.url)}/processed`)
              .then(async (r) => {
                const data = await safeParseJSON(r);
                if (!r.ok) throw new Error(data.error || data.message || data._raw || `HTTP ${r.status}`);
                return data;
              })
              .then((d) => { if (mounted) setProcessed(d); })
              .catch(() => {}); // 404 está bien, caemos al fallback
          }
        }
      } catch (e: any) { if (mounted) setErr(e?.message || String(e)); }
    })();
    return () => { mounted = false; };
  }, [id]);

  if (!id) {
    return (
      <div className="card">
        <p className="error">Falta el ID del diagnóstico.</p>
        <Link to="/" className="back-link">← Volver</Link>
      </div>
    );
  }

  if (err) return (
    <div className="card">
      <p className="error">Error: {err}</p>
      <Link to="/" className="back-link">← Volver</Link>
    </div>
  );

  if (!auditData) return (
    <div className="card loading-placeholder">
      <div className="spinner" />
      <p>Cargando diagnóstico…</p>
    </div>
  );

  const { url, fecha, audit = {} } = (auditData as any);
  const apiData = (audit as Record<string, any>)[activeApi] || {};
  const metrics = apiData.metrics || apiData;

  if (!activeApi || Object.keys(metrics).length === 0) {
    return (
      <div className="card">
        <Link to="/" className="back-link">← Nuevo diagnóstico</Link>
        <Link to={`/historico?url=${encodeURIComponent(url)}`} className="back-link" style={{ marginLeft: '1rem' }}>Ver histórico de esta URL</Link>
        <h2 className="diagnostico-title">Diagnóstico de <span className="url">{url}</span></h2>
        <p className="no-metrics">No se encontraron métricas para la API seleccionada.</p>
      </div>
    );
  }

  let performance: number | null = null;
  if (typeof apiData.performance === 'number') performance = Math.round(apiData.performance);
  else if (typeof metrics.performance === 'number') performance = Math.round(metrics.performance);
  else if (processed?.metrics) {
    const p = processed.metrics.find(m => m.key === 'performance')?.raw;
    if (typeof p === 'number') performance = Math.round(p);
  }

  const fcpSec  = toSeconds(metrics.fcp)  ?? processed?.metrics?.find(m => m.key === 'fcp')?.raw ?? null;
  const lcpSec  = toSeconds(metrics.lcp)  ?? processed?.metrics?.find(m => m.key === 'lcp')?.raw ?? null;
  const siSec   = toSeconds(metrics.si)   ?? processed?.metrics?.find(m => m.key === 'si')?.raw  ?? null;
  const ttfbSec = toSeconds(metrics.ttfb) ?? processed?.metrics?.find(m => m.key === 'ttfb')?.raw?? null;

  const tbtApiS   = toSeconds(metrics.tbt);
  const tbtProcMs = processed?.metrics?.find(m => m.key === 'tbt')?.raw;
  const tbtSec = (tbtApiS != null) ? tbtApiS : (typeof tbtProcMs === 'number' ? Math.round((tbtProcMs/1000)*10)/10 : null);

  const trendByKey: Record<string, Trend | undefined> = {};
  if (processed?.metrics) for (const m of processed.metrics) trendByKey[m.key] = m.trend;

  const items: Array<{ id: MetricId; label: string; value: number | null; desc: string }> = [
    { id: 'performance', label: 'RENDIMIENTO', value: performance, desc: `Porcentaje de rendimiento según ${API_LABELS[activeApi]}.` },
    { id: 'fcp', label: 'FCP', value: fcpSec, desc: 'Tiempo hasta la primera pintura de contenido (s)' },
    { id: 'lcp', label: 'LCP', value: lcpSec, desc: 'Tiempo hasta la pintura de contenido más grande (s)' },
    { id: 'tbt', label: 'TBT', value: tbtSec, desc: 'Tiempo total de bloqueo (s)' },
    { id: 'si',  label: 'SI',  value: siSec,  desc: 'Índice de velocidad (s)' },
    { id: 'ttfb',label: 'TTFB',value: ttfbSec,desc: 'Tiempo hasta el primer byte (s)' },
  ];

  const { errors: detectedErrors, improvements } = buildFindings(apiData, processed);
  const opportunities = buildOpportunities(apiData, processed);

  // Normalización para ActionPlanPanel (con traducción)
  const mapFindingToOpp = (arr: any[], kind: 'error' | 'improvement') => arr.map((e, i) => {
    let savingsLabel = e.displayValue || '';
    const ms = e?.details?.overallSavingsMs as number | undefined;
    const bytes = e?.details?.overallSavingsBytes as number | undefined;
    if (!savingsLabel && typeof ms === 'number') {
      savingsLabel = ms >= 100 ? `${Math.round((ms/1000)*10)/10}s` : `${Math.round(ms)}ms`;
    } else if (!savingsLabel && typeof bytes === 'number') {
      const kb = bytes / 1024;
      savingsLabel = kb >= 1024 ? `${(kb/1024).toFixed(1)}MB` : `${Math.round(kb)}KB`;
    }
    return {
      id: e.id || `finding-${kind}-${i}`,
      title: tTitle(e.title || e.id || 'Hallazgo'),
      recommendation: tRich(e.description || e.displayValue || ''),
      savingsLabel,
      type: kind,                                  // 'error' | 'improvement'
      severity: kind === 'error' ? 'critical' : 'info',
      impactScore: kind === 'error' ? 2000 : (typeof e.impactScore === 'number' ? e.impactScore : 100),
    };
  });

  const planItems = [
    ...opportunities.map(o => ({
      type: 'improvement',
      severity: 'info',
      impactScore: 100,
      ...o,
      title: tTitle(o.title || o.id),
      recommendation: tRich(o.recommendation || ''),
    })),
    ...mapFindingToOpp(detectedErrors, 'error'),
    ...mapFindingToOpp(improvements, 'improvement'),
  ];

  return (
    <div className="card">
      <div ref={contenedorReporteRef}>
        <Link to="/" className="back-link"> Nuevo diagnóstico</Link>
        <Link to={`/historico?url=${encodeURIComponent(url as string)}`} className="back-link" style={{ marginLeft: '1rem' }}>Ver histórico de esta URL</Link>

        <h2 className="diagnostico-title">Diagnóstico de <span className="url">{url}</span></h2>
        <div className="date">{new Date(fecha as string).toLocaleString()}</div>

        <div className="tabs">
          {Object.keys(audit as Record<string, any>).map(api => (
            <button
              key={api}
              onClick={() => setActiveApi(api)}
              className={`tab-button${activeApi === api ? ' active' : ''}`}
            >
              {API_LABELS[api] || api}
            </button>
          ))}
        </div>

        <div className="diagnostico-grid">
          {items.map(item => (
            <div key={item.id} className="item">
              <h3 className="item-label" style={{display:'flex',alignItems:'center',gap:8}}>
                {item.label}
                {trendByKey[item.id] && (
                  <span style={{fontSize:12, color: trendColor(trendByKey[item.id])}}>
                    {trendSymbol(trendByKey[item.id])}
                  </span>
                )}
              </h3>
              <CircularGauge
                value={item.value ?? 0}
                max={item.id === 'performance' ? 100 : undefined}
                color={gaugeColor(item.id, item.value)}
                decimals={item.id === 'performance' ? 0 : 1}
                suffix={item.id === 'performance' ? '%' : 's'}
              />
              <p className="item-desc">
                {item.value == null ? 'N/A' : (item.id === 'performance' ? `${item.value}%` : `${(item.value as number).toFixed(1)}s`)} — {item.desc}
              </p>
            </div>
          ))}
        </div>

        <ActionPlanPanel
          opportunities={planItems as any}
          performance={performance ?? undefined}
        />
      </div>

      <EmailSendBar
        captureRef={contenedorReporteRef as any}
        url={url as string}
        email={(auditData as any)?.email || ""}
        hideEmailInput={true}
        subject={`Diagnóstico de ${url}`}
        endpoint="/api/audit/send-diagnostic"
        includePdf={true}
      />
    </div>
  );
}
