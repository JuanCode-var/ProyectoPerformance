// src/services/diagnostics.api.ts

export type Trend = "up" | "down" | "flat" | string;
export type Color = "green" | "amber" | "red" | "gray" | string;

export type ProcessedMetric = {
  key: string;
  raw?: number | null;
  display?: string;
  color: Color;
  trend?: Trend;
};

export type ProcessedOpportunity = {
  id: string;
  title: string;
  savingsLabel?: string;
  recommendation?: string;
};

export type ProcessedDiagnostics = {
  url: string;
  currentDate?: string;
  previousDate?: string;
  metrics: ProcessedMetric[];
  opportunities: ProcessedOpportunity[];
  // Campos extra que pudiera devolver el backend:
  [k: string]: unknown;
};

export async function fetchProcessedByUrl(url: string): Promise<ProcessedDiagnostics> {
  const res = await fetch(`/api/diagnostics/${encodeURIComponent(url)}/processed`);
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || "No se pudo obtener el diagnóstico procesado");
  }
  return (await res.json()) as ProcessedDiagnostics;
}
