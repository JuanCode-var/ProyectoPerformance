import "dotenv/config";
import express, { type Request, type Response } from "express";
import cors from "cors";
import { pino } from "pino";                    // 👈 usa named export
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

/* ——— POST /audit ——————————————————————————————————— */
app.post(["/audit", "/audit/"], async (req: Request, res: Response) => {
  logger.info({ body: req.body }, "[microPagespeed] body");
  const { url, strategy = "mobile", categories = ["performance"] } = req.body as {
    url?: string;
    strategy?: "mobile" | "desktop" | (string & {});
    categories?: string[];
  };

  if (!url) return res.status(400).json({ error: "url is required" });

  try {
    const data = await runPageSpeed({ url, strategy, categories });
    res.json(data);
  } catch (e: any) {
    logger.error(e);
    const status = e?.response?.status || 500;
    const detail = e?.response?.data?.error?.message || e?.message || String(e);
    const retryAfter = e?.response?.headers?.["retry-after"];
    res.status(status).json({ error: "PSI error", detail, retryAfter });
  }
});

const PORT = Number(process.env.PORT) || 3001;
app.listen(PORT, () => logger.info(`🚀 microPagespeed listening on :${PORT}`));
