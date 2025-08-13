// src/services/diagnostics.api.js
export async function fetchProcessedByUrl(url) {
  const res = await fetch(`/api/diagnostics/${encodeURIComponent(url)}/processed`);
  if (!res.ok) throw new Error("No se pudo obtener el diagnóstico procesado");
  return res.json();
}
