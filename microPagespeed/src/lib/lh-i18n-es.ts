/**
 * i18n ligero para resultados Lighthouse → ES
 * - tTitle(): traduce títulos y encabezados (incluye textos dentro de [enlaces])
 * - tRich(): traduce descripciones conservando markdown y enlaces
 * - tSavings(): normaliza etiquetas de “ahorro” (ms/s/KiB/KB/MB, etc.)
 *
 * Diseño:
 * 1) Diccionarios de títulos/etiquetas comunes
 * 2) Reglas de fraseo genéricas (Learn more..., Consider..., etc.)
 * 3) Frases concretas que aparecen en Plan de acción y Detalles
 */

type Dict = Array<[RegExp, string]>;

const rx = (s: string, flags = "gi") => new RegExp(s.replace(/\//g, "\\/"), flags);

// ————————————————————————————————————————————————————————
// 1) TÍTULOS / ETIQUETAS (también para textos entre corchetes de enlaces)
// ————————————————————————————————————————————————————————
const TITLES: Dict = [
  // Plan de acción / performance
  [rx("\\bAvoid chaining critical requests\\b"), "Evita encadenar solicitudes críticas"],
  [rx("\\bReduce unused JavaScript\\b"), "Reduce JavaScript no utilizado"],
  [rx("\\bDocument request latency\\b"), "Latencia de la solicitud del documento"],
  [rx("\\bSpeed Index\\b"), "Índice de velocidad (SI)"],
  [rx("\\bLargest Contentful Paint element\\b"), "Elemento de LCP (Largest Contentful Paint)"],
  [rx("\\bLargest Contentful Paint\\b"), "LCP (Largest Contentful Paint)"],
  [rx("\\bFirst Contentful Paint\\b"), "FCP (First Contentful Paint)"],
  [rx("\\bMinimize third-party usage\\b"), "Minimiza el uso de terceros"],
  [rx("\\bNetwork dependency tree\\b"), "Árbol de dependencias de red"],
  [rx("\\bTime to Interactive\\b"), "Time to Interactive (TTI)"],
  [rx("\\bTotal Blocking Time\\b"), "Tiempo total de bloqueo (TBT)"],
  [rx("\\bRemove duplicate modules in JavaScript bundles\\b"), "Elimina módulos duplicados en JavaScript"],
  [rx("\\bUse efficient animated content\\b"), "Usa formatos eficientes para contenido animado"],
  [rx("\\bOptimize image size\\b"), "Optimiza el tamaño de las imágenes"],
  [rx("\\bNetwork round trip times\\b"), "Tiempos de ida y vuelta de red"],
  [rx("\\bAvoids an excessive DOM size\\b"), "Evita un tamaño de DOM excesivo"],
  [rx("\\bDocument uses legible font sizes\\b"), "El documento usa tamaños de fuente legibles"],
  [rx("\\bServe images in next-gen formats\\b"), "Sirve imágenes en formatos modernos (WebP/AVIF)"],
  [rx("\\bMinify CSS\\b"), "Minificar CSS"],
  [rx("\\bMinify JavaScript\\b"), "Minificar JavaScript"],
  [rx("\\bAvoid serving legacy JavaScript to modern browsers\\b"), "Evita servir JavaScript heredado a navegadores modernos"],
  [rx("\\bEnable text compression\\b"), "Habilita compresión de texto"],
  [rx("\\bReduce JavaScript execution time\\b"), "Reduce el tiempo de ejecución de JavaScript"],
  [rx("\\bDefer offscreen images\\b"), "Difere imágenes fuera de la vista"],
  [rx("\\bCumulative Layout Shift\\b"), "Desplazamiento acumulado de diseño (CLS)"],
  [rx("\\bUser Timing marks and measures\\b"), "Marcas y mediciones de User Timing"],
  // Buenas prácticas / SEO
  [rx("\\bUses HTTPS\\b"), "Usa HTTPS"],
  [rx("\\bAvoids deprecated APIs\\b"), "Evita APIs obsoletas"],
  [rx("\\bAvoids third-party cookies\\b"), "Evita cookies de terceros"],
  [rx("\\bLinks have descriptive text\\b"), "Los enlaces tienen texto descriptivo"],
  [rx("\\bPage isn'?t blocked from indexing\\b"), "La página no está bloqueada para indexación"],
  [rx("\\bDocument has a <title> element\\b"), "El documento tiene un elemento <title>"],
  [rx("\\bDocument does not have a meta description\\b"), "El documento no tiene una meta descripción"],
  [rx("\\brobots\\.txt is valid\\b"), "robots.txt es válido"],
  [rx("\\bPage has successful HTTP status code\\b"), "La página responde con un código HTTP correcto"],
];

// ————————————————————————————————————————————————————————
// 2) REGLAS DE FRASEO GENÉRICAS (mantienen enlaces/markdown)
// ————————————————————————————————————————————————————————
const PHRASES_GENERIC: Dict = [
  [rx("\\bLearn more about\\b"), "Más información sobre"],
  [rx("\\bLearn how to\\b"), "Aprende cómo"],
  [rx("\\bLearn more\\b"), "Más información"],
  [rx("\\bConsider\\b"), "Considera"],
  [rx("\\bYour first network request is the most important\\b"), "Tu primera solicitud de red es la más importante"],
  [rx("\\bReduce its latency by avoiding redirects, ensuring a fast server response, and enabling text compression\\b"),
   "Reduce su latencia evitando redirecciones, asegurando una respuesta rápida del servidor y habilitando la compresión de texto"],
  [rx("\\bYou may find delivering smaller JS payloads helps with this\\b"),
   "Entregar cargas de JS más pequeñas suele ayudar con esto"],
  [rx("\\bby reducing the length of chains, reducing the download size of resources, or deferring the download of unnecessary resources to improve page load\\b"),
   "reduciendo la longitud de las cadenas, disminuyendo el tamaño de descarga de recursos o difiriendo los recursos innecesarios para mejorar la carga de la página"],
];

// ————————————————————————————————————————————————————————
// 3) FRASES CONCRETAS QUE SUELEN SALIR EN DETALLES / PLAN
// ————————————————————————————————————————————————————————
const PHRASES_SPECIFIC: Dict = [
  [rx("\\bThis is the largest contentful element painted within the viewport\\b"),
   "Este es el elemento con mayor contenido pintado dentro del viewport"],
  [rx("\\bLargest Contentful Paint marks the time at which the largest text or image is painted\\b"),
   "LCP marca el momento en que se pinta el texto o imagen más grande"],
  [rx("\\bFirst Contentful Paint marks the time at which the first text or image is painted\\b"),
   "FCP marca el momento en que se pinta el primer texto o imagen"],
  [rx("\\bSpeed Index shows how quickly the contents of a page are visibly populated\\b"),
   "El Índice de velocidad (Speed Index) muestra qué tan rápido se llena visualmente el contenido de una página"],
  [rx("\\bCumulative Layout Shift measures the movement of visible elements within the viewport\\b"),
   "El Desplazamiento Acumulado de Diseño (CLS) mide el movimiento de los elementos visibles dentro del viewport"],
  [rx("\\bReduce unused JavaScript and defer loading scripts until they are required to decrease bytes consumed by network activity\\b"),
   "Reduce JavaScript no utilizado y difiere la carga de scripts hasta que sean necesarios para disminuir bytes consumidos por la red"],
  [rx("\\bThe Critical Request Chains below show you what resources are loaded with a high priority\\b"),
   "Las cadenas de solicitudes críticas muestran qué recursos se cargan con alta prioridad"],
  [rx("\\bServer latencies can impact web performance\\b"),
   "Las latencias del servidor pueden afectar el rendimiento web"],
];

// ————————————————————————————————————————————————————————
// 4) AHORROS / MAGNITUDES
// ————————————————————————————————————————————————————————
const SAVINGS: Dict = [
  [rx("\\bAhorro:?\\s*Est(?:imated|) savings of\\s*([\\d.,]+)\\s*Ki?B\\b"), "Ahorro estimado de $1 KiB"],
  [rx("\\bEst savings of\\s*([\\d.,]+)\\s*Ki?B\\b"), "Ahorro estimado de $1 KiB"],
  [rx("\\bTotal size was\\s*([\\d.,]+)\\s*Ki?B\\b"), "El tamaño total fue de $1 KiB"],
  [rx("\\bRoot document took\\s*([\\d.,]+)\\s*ms\\b"), "El documento raíz tardó $1 ms"],
  [rx("\\b(\\d+)\\s*layout shifts found\\b"), "$1 desplazamientos de diseño encontrados"],
  [rx("\\b(\\d+)\\s*resources found\\b"), "$1 recursos encontrados"],
  [rx("\\bThird-party code blocked the main thread for\\s*(\\d+)\\s*ms\\b"),
   "El código de terceros bloqueó el hilo principal durante $1 ms"],
];

// Utilidades de reemplazo
const applyDict = (input: string, dict: Dict): string =>
  dict.reduce((acc, [re, out]) => acc.replace(re, out), input);

// ————————————————————————————————————————————————————————
// API pública
// ————————————————————————————————————————————————————————
/**
 * Traduce un título o etiqueta corta (incluye contenidos dentro de [corchetes]).
 */
export function tTitle(s: unknown): string {
  if (typeof s !== "string" || !s) return String(s ?? "");
  let out = s;

  // Traducir primero los textos dentro de enlaces [ ... ]
  // (no rompe el markdown; solo cambia el interior)
  out = out.replace(/\[([^\]]+)\]/g, (_m, inside) => {
    const translated = applyDict(inside, TITLES);
    return `[${translated}]`;
  });

  // Y después el resto del string
  out = applyDict(out, TITLES);

  // Limpieza menor
  out = out.replace(/\s+/g, " ").trim();
  return out;
}

/**
 * Traduce descripciones conservando markdown, enlaces y backticks.
 * Aplica reglas genéricas y frases específicas.
 */
export function tRich(s: unknown): string {
  if (typeof s !== "string" || !s) return String(s ?? "");
  let out = s;

  // Normalizaciones rápidas para evitar mezclas EN/ES
  out = applyDict(out, PHRASES_GENERIC);
  out = applyDict(out, PHRASES_SPECIFIC);

  // También traducimos títulos si vienen incrustados dentro de corchetes de un enlace
  out = out.replace(/\[([^\]]+)\]/g, (_m, inside) => `[${applyDict(inside, TITLES)}]`);

  // Ajustes de puntuación comunes “Más información sobre …”
  out = out.replace(/\((\s*https?:\/\/[^\s)]+)\)/gi, "($1)");
  out = out.replace(/\s+/g, " ").trim();
  return out;
}

/**
 * Traduce/normaliza etiquetas de “ahorro” o displayValue
 * (ms ↔ s, KiB/KB/MB, frases típicas).
 * Si no coincide nada, devuelve el texto original tal cual.
 */
export function tSavings(s: unknown): string {
  if (!s) return "";
  let out = String(s);

  // Normalizar commas vs puntos en números dentro de unidades ms/s cuando vienen como texto
  out = out.replace(/\b([\d]+),([\d]+)\b/g, "$1.$2");

  // Reglas de ahorro
  out = applyDict(out, SAVINGS);

  // Traducciones sueltas frecuentes
  out = out
    .replace(/\bEst(?:imated)? savings of\b/gi, "Ahorro estimado de")
    .replace(/\bSavings\b/gi, "Ahorro")
    .replace(/\bgain\b/gi, "ahorro")
    .replace(/\bms\b/gi, "ms")
    .replace(/\bKi?B\b/gi, "KiB");

  return out.trim();
}

/**
 * Utilidad opcional por si quieres forzar ES en un objeto de auditoría
 * (traduce título/description/displayValue si existen).
 */
export function ensureEsAudit<T extends { title?: any; description?: any; displayValue?: any }>(a: T): T {
  if (!a) return a;
  const copy: any = { ...a };
  if (copy.title) copy.title = tTitle(copy.title);
  if (copy.description) copy.description = tRich(copy.description);
  if (copy.displayValue) copy.displayValue = tSavings(copy.displayValue);
  return copy as T;
}