import "dotenv/config";
import express, { type Request, type Response } from "express";
import cors from "cors";
import { pino } from "pino";                    // 👈 dejamos tu import como lo tienes
import { runPageSpeed } from "./pagespeed.service.js"; // NodeNext: .js

// Logger: prod simple; dev con pino-pretty
const logger = pino({
  level: process.env.LOG_LEVEL || "info",
  ...(process.env.NODE_ENV === "production"
    ? {}
    : {
        transport: {
          target: "pino-pretty",
          options: { colorize: true },
        },
      }),
});

const app = express();
app.use(cors());
app.use(express.json());

// Helpers
const ALL_CATEGORIES = ["performance", "accessibility", "best-practices", "seo"] as const;
type Strategy = "mobile" | "desktop";
function normalizeStrategy(s?: string): Strategy {
  return s === "desktop" ? "desktop" : "mobile";
}
function normalizeCategories(input?: string[] | undefined) {
  if (!input || input.length === 0) return [...ALL_CATEGORIES];
  // Filtra sólo las válidas, sin romper si viene algo raro desde el front
  const set = new Set(
    input
      .map((c) => String(c).toLowerCase())
      .filter((c) => (ALL_CATEGORIES as readonly string[]).includes(c))
  );
  return set.size ? Array.from(set) : [...ALL_CATEGORIES];
}

/* ——— POST /audit ——————————————————————————————————— */
app.post(["/audit", "/audit/"], async (req: Request, res: Response) => {
  logger.info({ body: req.body }, "[microPagespeed] body");

  const {
    url,
    strategy,
    categories,
    key, // opcional: te permite forzar una key distinta a la del .env para esta corrida
  }: {
    url?: string;
    strategy?: Strategy | (string & {});
    categories?: string[];
    key?: string;
  } = req.body || {};

  if (!url) {
    return res.status(400).json({ ok: false, error: "url is required" });
  }

  try {
    const data = await runPageSpeed({
      url,
      strategy: normalizeStrategy(strategy as string),
      categories: normalizeCategories(categories),
      key,
    });
    res.json({ ok: true, ...data });
  } catch (e: any) {
    logger.error(e);
    const status = e?.response?.status || 500;
    const detail = e?.response?.data?.error?.message || e?.message || String(e);
    const retryAfter = e?.response?.headers?.["retry-after"];
    res.status(status).json({ ok: false, error: "PSI error", detail, retryAfter });
  }
});

const PORT = Number(process.env.PORT) || 3001;
app.listen(PORT, () => logger.info(`🚀 microPagespeed listening on :${PORT}`));
