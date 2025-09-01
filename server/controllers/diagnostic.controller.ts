// server/controllers/diagnostic.controller.ts
import type { Request, Response } from "express";
import Audit from "../database/esquemaBD.js";
import {
  readMetrics,
  extractOpportunities,
  // packMetrics,
  THRESHOLDS,
} from "../utils/lh.js";


// ---------------- Types mínimos para no romper contratos ----------------
type Opportunity = {
  id: string;
  title: string;
  savingsLabel?: string | null;
  impactScore?: number;
  recommendation?: string | null;
};

type CurrMetrics = {
  performance?: number | null;
  fcp?: number | null;
  lcp?: number | null;
  tbt?: number | null;
  si?: number | null;
  ttfb?: number | null;
};

// Fallback: genera "problemas" a partir de las métricas cuando no hay opportunities en el LHR
function buildThresholdOpps(curr: CurrMetrics): Opportunity[] {
  const opps: Opportunity[] = [];
  const ms = (s: number) => Math.max(0, Math.round(s * 1000));
  const push = (id: string, title: string, reco: string, savingMs: number | null = null) => {
    opps.push({
      id,
      title,
      savingsLabel: savingMs != null ? `${(savingMs / 1000).toFixed(1)}s` : null,
      impactScore: savingMs || 0,
      recommendation: reco,
    });
  };

  // Performance bajo
  if (typeof curr.performance === "number" && curr.performance < THRESHOLDS.performance.amber) {
    push(
      "performance",
      "Performance bajo",
      "Ataca primero LCP y TBT. Reduce JS no usado, prioriza recursos críticos (preload) y aplica lazy-load."
    );
  }

  // LCP alto
  if (curr.lcp != null && curr.lcp > THRESHOLDS.lcp.green) {
    push(
      "largest-contentful-paint",
      "LCP alto",
      "Optimiza el recurso LCP (tamaño/formato WebP/AVIF, preload) y aplica lazy-load a lo no crítico.",
      ms(curr.lcp - THRESHOLDS.lcp.green)
    );
  }

  // FCP alto
  if (curr.fcp != null && curr.fcp > THRESHOLDS.fcp.green) {
    push(
      "first-contentful-paint",
      "FCP alto",
      "Evita bloqueos de render: usa defer/async en scripts, CSS crítico inline y font-display: swap.",
      ms(curr.fcp - THRESHOLDS.fcp.green)
    );
  }

  // TBT alto (ya viene en ms)
  if (curr.tbt != null && curr.tbt > THRESHOLDS.tbt.green) {
    push(
      "total-blocking-time",
      "TBT alto",
      "Divide bundles (code-splitting), carga diferida, evita tareas largas en main thread.",
      Math.max(0, (curr.tbt ?? 0) - THRESHOLDS.tbt.green)
    );
  }

  // Speed Index alto
  if (curr.si != null && curr.si > THRESHOLDS.si.green) {
    push(
      "speed-index",
      "Speed Index alto",
      "Mejora pintura temprana: CSS crítico, prioriza contenido above-the-fold y reduce imágenes iniciales.",
      ms(curr.si - THRESHOLDS.si.green)
    );
  }

  // TTFB alto
  if (curr.ttfb != null && curr.ttfb > THRESHOLDS.ttfb.green) {
    push(
      "server-response-time",
      "TTFB alto",
      "Usa CDN/edge, cachea respuestas, optimiza consultas y mantén caliente el backend.",
      ms(curr.ttfb - THRESHOLDS.ttfb.green)
    );
  }

  // ordenar por impacto y deduplicar por id
  opps.sort((a, b) => (b.impactScore || 0) - (a.impactScore || 0));
  const seen = new Set<string>();
  return opps.filter((o) => (seen.has(o.id) ? false : (seen.add(o.id), true)));
}

// GET /api/diagnostics/:encodedUrl/processed
export async function getProcessedByUrl(req: Request, res: Response) {
  try {
    const url = decodeURIComponent(req.params.encodedUrl as string);

    // Trae últimos por fecha (tu esquema usa "fecha")
    const docs = await Audit.find({ url }).sort({ fecha: -1 }).limit(6).lean();
    if (!docs.length) return res.status(404).json({ error: "No hay reportes para esta URL" });

    // Compara dentro del mismo tipo si es posible (pagespeed/unlighthouse)
    const sameType = docs.filter((d: any) => d.type === docs[0].type);
    const current  = sameType[0] || docs[0];
    const previous = sameType[1] || docs[1] || null;

    const currMetrics = readMetrics(current);
    const prevMetrics = previous ? readMetrics(previous) : null;

    // const metrics = packMetrics(currMetrics, prevMetrics);

    // 1) Intenta extraer desde el LHR
    let opportunities = extractOpportunities(current);

    // 2) Si viene vacío, genera fallback por umbrales
    if (!opportunities || opportunities.length === 0) {
      // opportunities = buildThresholdOpps(currMetrics);
    }

    res.json({
      url,
      currentDate: current.fecha || null,
      previousDate: previous?.fecha || null,
      // metrics,
      opportunities,
    });
  } catch (e) {
    console.error("getProcessedByUrl error:", e);
    res.status(500).json({ error: "Error procesando reporte" });
  }
}