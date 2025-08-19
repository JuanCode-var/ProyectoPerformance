// server/controllers/auditHistory.controller.ts
import type { Request, Response } from "express";
import Audit from "../database/esquemaBD.js"; // NodeNext: deja .js en el specifier

export async function getAudits(req: Request, res: Response) {
  try {
    // query params
    const { url, type, from, to } = req.query as {
      url?: string;
      type?: string;
      from?: string;
      to?: string;
    };
    const sortParam = (req.query.sort as string) ?? "desc";
    const limitParam = Number((req.query.limit as string) ?? 100);
    const limit = Number.isFinite(limitParam) ? limitParam : 100;

    // construir query para Mongo
    const q: Record<string, any> = {};
    if (url)  q.url   = url;
    if (type) q.tipos = type;
    if (from || to) {
      q.fecha = {};
      if (from) q.fecha.$gte = new Date(from);
      if (to)   q.fecha.$lte = new Date(to);
    }

    const docs = await Audit.find(q)
      .sort({ fecha: sortParam === "asc" ? 1 : -1 })
      .limit(limit);

    return res.json(docs);
  } catch (err: any) {
    console.error("getAudits error", err);
    return res
      .status(500)
      .json({ error: "Internal error", detail: err?.message || String(err) });
  }
}
