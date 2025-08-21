// src/lib/lh-i18n-es.ts
// Traductor “best-effort” para títulos, descripciones y etiquetas de ahorro de Lighthouse/PSI.
// i18n Lighthouse helpers

type U = unknown;

const norm = (s: U) =>
  String(s ?? "")
    .toLowerCase()
    .replace(/[`’'"]/g, "")
    .replace(/\s+/g, " ")
    .trim();

/** Traducciones exactas (respetan mayúsculas/espaciado del LHR) */
const T_EXACT = new Map<string, string>([
  // ===== Métricas / secciones comunes =====
  ["First Contentful Paint", "Primera pintura con contenido (FCP)"],
  ["Largest Contentful Paint", "Pintura de mayor contenido (LCP)"],
  ["Largest Contentful Paint element", "Elemento de la pintura de contenido más grande (LCP)"],
  ["Speed Index", "Índice de velocidad (SI)"],
  ["Time to Interactive", "Tiempo hasta interactivo (TTI)"],
  ["Total Blocking Time", "Tiempo total de bloqueo (TBT)"],
  ["Cumulative Layout Shift", "Desplazamiento acumulado de diseño (CLS)"],
  ["Document request latency", "Latencia de la solicitud del documento"],
  ["Network Round Trip Times", "Tiempos de ida y vuelta de red (RTT)"],

  // ===== Oportunidades / diagnósticos =====
  ["Eliminate render-blocking resources", "Eliminar recursos que bloquean el renderizado"],
  ["Reduce unused JavaScript", "Reducir JavaScript no utilizado"],
  ["Reduce unused CSS", "Reducir CSS no utilizado"],
  ["Serve images in next-gen formats", "Servir imágenes en formatos modernos"],
  ["Efficiently encode images", "Codificar imágenes eficientemente"],
  ["Properly size images", "Ajustar tamaño de imágenes"],
  ["Defer offscreen images", "Diferir imágenes fuera de pantalla"],
  ["Preload Largest Contentful Paint image", "Precargar la imagen de LCP"],
  ["Avoid chaining critical requests", "Evitar encadenamiento de solicitudes críticas"],
  ["Enable text compression", "Habilitar compresión de texto"],
  ["Serve static assets with an efficient cache policy", "Servir recursos estáticos con una política de caché eficiente"],
  ["Avoid enormous network payloads", "Evitar cargas de red enormes"],
  ["Reduce server response times (TTFB)", "Reducir el tiempo de respuesta del servidor (TTFB)"],
  ["Render blocking requests", "Solicitudes que bloquean el renderizado"],
  ["User Timing marks and measures", "Marcadores y mediciones de User Timing"],
  ["Remove duplicate modules in JavaScript bundles", "Eliminar módulos duplicados en paquetes de JavaScript"],
  ["Minify CSS", "Minificar CSS"],
  ["Minify JavaScript", "Minificar JavaScript"],
  ["Avoid long main-thread tasks", "Evitar tareas largas en el hilo principal"],
  ["Avoid an excessive DOM size", "Evitar un tamaño de DOM excesivo"],
  ["Avoids an excessive DOM size", "Evita un tamaño de DOM excesivo"],
  ["Avoid non-composited animations", "Evitar animaciones no compuestas"],
  ["Image elements do not have explicit `width` and `height`", "Los elementos de imagen no tienen `width` ni `height` explícitos"],
  ["Image elements do not have [alt] attributes", "Los elementos de imagen no tienen atributo [alt]"],
  ["Links are not crawlable", "Los enlaces no se pueden rastrear"],
  ["Links do not have a discernible name", "Los enlaces no tienen un nombre descriptivo"],
  ["Browser errors were logged to the console", "Se registraron errores del navegador en la consola"],
  ["Issues were logged in the 'Issues' panel in Chrome Devtools", "Se registraron problemas en el panel 'Issues' de Chrome DevTools"],
  ["Forced reflow", "Reflujo forzado"],
  ["LCP request discovery", "Descubrimiento de solicitud de LCP"],
  ["Optimize LCP by making the LCP image [discoverable] from the HTML immediately, and [avoiding lazy-loading].",
   "Optimiza LCP haciendo que la imagen de LCP sea detectables desde el HTML inmediatamente y evitando la carga diferida."
  ],

  // ===== Reglas de accesibilidad (AXE/ARIA) =====
  ["'[accesskey]' values are unique", "Los valores de '[accesskey]' son únicos"],
  ["`button`, `link`, and `menuitem` elements have accessible names", "Los elementos `button`, `link` y `menuitem` tienen nombres accesibles"],
  ["ARIA input fields have accessible names", "Los campos de entrada ARIA tienen nombres accesibles"],
  ["ARIA `meter` elements have accessible names", "Los elementos ARIA `meter` tienen nombres accesibles"],
  ["ARIA `progressbar` elements have accessible names", "Los elementos ARIA `progressbar` tienen nombres accesibles"],
  ["Elements with an ARIA `role` that require children to contain a specific `role` have all required children.",
   "Los elementos con `role` de ARIA que requieren hijos con un `role` específico tienen todos los hijos requeridos."
  ],
  ["Elements with the `role=text` attribute do not have focusable descendents.",
   "Los elementos con el atributo `role=text` no tienen descendientes enfocables."
  ],
  ["ARIA toggle fields have accessible names", "Los campos de alternancia ARIA tienen nombres accesibles"],
  ["ARIA `tooltip` elements have accessible names", "Los elementos ARIA `tooltip` tienen nombres accesibles"],
  ["ARIA `treeitem` elements have accessible names", "Los elementos ARIA `treeitem` tienen nombres accesibles"],

  // ===== Legacy JS / font display =====
  ["Avoid serving legacy JavaScript to modern browsers", "Evitar servir JavaScript heredado a navegadores modernos"],
  ["Font display", "Visualización de fuentes (font-display)"],
]);

/** Traducciones por similitud (sin importar mayúsculas ni acentos) */
const T_SOFT = new Map<string, string>([
  ["first contentful paint", "Primera pintura con contenido (FCP)"],
  ["largest contentful paint element", "Elemento de la pintura de contenido más grande (LCP)"],
  ["largest contentful paint", "Pintura de mayor contenido (LCP)"],
  ["cumulative layout shift", "Desplazamiento acumulado de diseño (CLS)"],
  ["document request latency", "Latencia de la solicitud del documento"],
  ["browser errors were logged to the console", "Se registraron errores del navegador en la consola"],
  ["issues were logged in the issues panel in chrome devtools", "Se registraron problemas en el panel 'Issues' de Chrome DevTools"],
  ["links are not crawlable", "Los enlaces no se pueden rastrear"],
  ["links do not have a discernible name", "Los enlaces no tienen un nombre descriptivo"],
  ["forced reflow", "Reflujo forzado"],
  ["avoid an excessive dom size", "Evitar un tamaño de DOM excesivo"],
  ["avoid non-composited animations", "Evitar animaciones no compuestas"],
  ["network round trip times", "Tiempos de ida y vuelta de red (RTT)"],
  ["image elements do not have [alt] attributes", "Los elementos de imagen no tienen atributo [alt]"],
  ["remove duplicate modules in javascript bundles", "Eliminar módulos duplicados en paquetes de JavaScript"],
  ["minify css", "Minificar CSS"],
  ["minify javascript", "Minificar JavaScript"],
  ["avoid long main-thread tasks", "Evitar tareas largas en el hilo principal"],
  ["enable text compression", "Habilitar compresión de texto"],
]);

/** Reemplazos en descripciones largas manteniendo markdown y enlaces */
const REPL_LIST: Array<[RegExp, string]> = [
  // Genéricas de guía
  [/\[Learn more\]\(([^)]+)\)/gi, "[Más información]($1)"],
  [/\[More information\]\(([^)]+)\)/gi, "[Más información]($1)"],
  [/\[Learn more about ([^\]]+)\]\(([^)]+)\)/gi, "[Más información sobre $1]($2)"],
  [/\[Learn how to ([^\]]+)\]\(([^)]+)\)/gi, "[Aprende cómo $1]($2)"],
  [/\[Learn why ([^\]]+)\]\(([^)]+)\)/gi, "[Aprende por qué $1]($2)"],

  // TTFB
  [/Keep the server response time for the main document short because all other requests depend on it\./gi,
   "Mantén corto el tiempo de respuesta del servidor para el documento principal, porque todas las demás solicitudes dependen de él."
  ],

  // Imágenes / formatos
  [/Image formats like WebP and AVIF often provide better compression than PNG or JPEG, which means faster downloads and less data consumption\./gi,
   "Los formatos de imagen como WebP y AVIF suelen ofrecer mejor compresión que PNG o JPEG, lo que implica descargas más rápidas y menor consumo de datos."
  ],

  // Listeners pasivos
  [/Consider marking your touch and wheel event listeners as `passive`/gi,
   "Considera marcar tus listeners de eventos de toque y rueda como `passive`"
  ],

  // CLS / FCP / LCP textos intro
  [/Largest Contentful Paint marks the time at which the largest text or image is painted\./gi,
   "Largest Contentful Paint (LCP) marca el tiempo en el que se pinta el texto o imagen más grande."
  ],
  [/First Contentful Paint marks the time at which the first text or image is painted\./gi,
   "First Contentful Paint (FCP) indica el tiempo en el que se pinta el primer texto o imagen."
  ],
  [/These are the largest layout shifts observed on the page\./gi,
   "Estos son los mayores desplazamientos de diseño observados en la página."
  ],

  // “Issues panel”
  [/Issues were logged to the 'Issues' panel in Chrome Devtools/gi,
   "Se registraron problemas en el panel 'Issues' de Chrome DevTools"
  ],

  // Reflow forzado
  [/A forced reflow occurs when JavaScript queries geometric properties.*?state\./gi,
   "Se produce un reflujo forzado cuando JavaScript consulta propiedades geométricas (como offsetWidth) después de que los estilos han quedado invalidados por un cambio en el estado del DOM."
  ],
];

/** Traduce textos tipo “Ahorro … / found …” que vienen en badges */
export function tSavings(s: U): string {
  let out = String(s ?? "");
  out = out.replace(/\bEst savings of\b/gi, "Ahorro est. de");
  out = out.replace(/\bsavings of\b/gi, "Ahorro de");
  out = out.replace(/\bAhorro:\b/gi, "Ahorro:");
  out = out.replace(/\bchains? found\b/gi, "cadenas encontradas");
  out = out.replace(/\blayout shifts? found\b/gi, "desplazamientos de diseño encontrados");
  out = out.replace(/\blong tasks? found\b/gi, "tareas largas encontradas");
  out = out.replace(/\banimated elements? found\b/gi, "elementos animados encontrados");
  out = out.replace(/\bresources? found\b/gi, "recursos encontrados");
  out = out.replace(/\belements?\b/gi, "elementos");
  return out;
}

/** Títulos cortos (id → título) */
export function tTitle(s: U): string {
  if (typeof s !== "string") return String(s ?? "");
  const exact = T_EXACT.get(s);
  if (exact) return exact;
  return T_SOFT.get(norm(s)) || s;
}

/** Descripciones con markdown (mantiene enlaces) */
export function tRich(s: U): string {
  if (typeof s !== "string" || !s) return String(s ?? "");
  let out = s;
  for (const [re, rep] of REPL_LIST) out = out.replace(re, rep);
  // Ajustes menores comunes
  out = out.replace(/\bcolor contrast\b/gi, "contraste de color");
  out = out.replace(/\bserver response time\b/gi, "tiempo de respuesta del servidor");
  return out;
}

/** Azúcar: traduce un “audit-like” in place */
export function translateAuditLike<T extends { title?: string; description?: string; displayValue?: string }>(a: T): T {
  if (!a) return a;
  if (a.title) a.title = tTitle(a.title);
  if (a.description) a.description = tRich(a.description);
  if (a.displayValue) a.displayValue = tSavings(a.displayValue);
  return a;
}