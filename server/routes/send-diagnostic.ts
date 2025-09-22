// server/routes/send-diagnostic.ts
import type { Request, Response } from "express";
import nodemailer from "nodemailer";
import type { SendMailOptions, SentMessageInfo } from "nodemailer";


// Importa tu modelo y utils reales (NodeNext/ESM ⇒ termina en .js)
import Audit from "../database/esquemaBD.js";
import { readMetrics, extractOpportunities } from "../utils/lh.js";

/** PDF adjunto opcional que puede venir desde el front */
type PdfAttachment = {
  filename: string;
  base64: string;
  contentType?: string;
} | null;

/** Pequeños helpers de formato (los mismos del controlador) */
const pct = (v: number | null | undefined) => (v == null ? "N/A" : `${Math.round(v)}%`);
const fmtS = (s: number | null | undefined) =>
  s == null ? "N/A" : `${Number(s).toFixed(2)}s`;
const fmtMs = (ms: number | null | undefined) =>
  ms == null ? "N/A" : `${Math.round(ms)}ms`;

/** Convierte markdown de links [texto](url) a <a>…</a> para HTML de email */
const mdLinkify = (s = "") =>
  s.replace(
    /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
    '<a href="$2" style="color:#2563EB;text-decoration:underline">$1</a>',
  );

const escapeHtml = (s = "") =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/**
 * POST /api/audit/send-diagnostic
 * Envía por correo el diagnóstico (HTML) y opcionalmente adjunta un PDF generado en el front.
 */
export async function sendDiagnostic(req: Request, res: Response) {
  try {
    const { id, url, email, subject, pdf } = (req.body || {}) as {
      id?: string;
      url?: string;
      email?: string;
      subject?: string;
      pdf?: PdfAttachment;
    };

    if (!id && !url) {
      return res.status(400).json({ error: "Falta id o url" });
    }

    // 1) Buscar diagnóstico: por id o el más reciente por url
    let doc: any = null;
    if (id) {
      doc = await Audit.findById(id).lean();
    } else {
      doc = await Audit.findOne({ url }).sort({ fecha: -1 }).lean();
    }
    if (!doc) return res.status(404).json({ error: "No hay diagnóstico para ese criterio" });

    // 2) Destinatario
    let toEmail = (email || doc.email || "").trim();
    if (!toEmail) {
      return res
        .status(400)
        .json({ error: "No hay email disponible (ni en body ni en el diagnóstico)" });
    }

    // 3) Métricas + oportunidades (para el body HTML)
    const metrics = readMetrics(doc);
    const opps = extractOpportunities(doc).slice(0, 10);

    // 4) KPIs render
    const kpi = (label: string, val: string) =>
      `<div style="flex:1;min-width:120px;border:1px solid #E5E7EB;border-radius:12px;padding:12px;text-align:center">
         <div style="font-size:12px;color:#6B7280">${label}</div>
         <div style="font-size:20px;font-weight:700;color:#111827;margin-top:4px">${val}</div>
       </div>`;

    const fecha = new Date(doc.fecha).toLocaleString();
    const title = subject || `Diagnóstico de ${doc.url}`;

    // 5) Secciones de oportunidades
    const oppLi = opps
      .map((o) => {
        const savings = o.savingsLabel ? ` · Ahorro: ${o.savingsLabel}` : "";
        const reco = o.recommendation
          ? `<div style="color:#374151;margin-top:4px">${mdLinkify(o.recommendation)}</div>`
          : "";
        return `<li style="margin:0 0 10px 0">
          <div style="font-weight:600;color:#111827">${o.title || o.id}${savings}</div>
          ${reco}
        </li>`;
      })
      .join("");

    // 6) Body HTML del correo (limpio y con estilos inline)
    const html = `
      <div style="font-family:Arial,Helvetica,sans-serif;color:#111827;line-height:1.45">
        <h2 style="text-align:center;color:#2563EB;margin:0 0 4px 0">${title}</h2>
        <div style="text-align:center;font-size:12px;color:#6B7280">Generado: ${fecha} · Estrategia: ${
          doc.strategy || "mobile"
        }</div>
        <div style="text-align:center;font-size:12px;color:#6B7280;margin-bottom:16px">
          Fuente: ${doc.audit?.pagespeed?.meta?.source || "desconocida"}
        </div>

        <div style="display:flex;gap:8px;flex-wrap:wrap;margin:16px 0">
          ${kpi("Performance", `${Math.round(metrics.performance ?? 0)}%`)}
          ${kpi("FCP", `${Number(metrics.fcp ?? 0).toFixed(2)}s`)}
          ${kpi("LCP", `${Number(metrics.lcp ?? 0).toFixed(2)}s`)}
          ${kpi("TBT", `${Math.round(metrics.tbt ?? 0)}ms`)}
          ${kpi("Speed Index", `${Number(metrics.si ?? 0).toFixed(2)}s`)}
          ${kpi("TTFB", `${Number(metrics.ttfb ?? 0).toFixed(2)}s`)}
        </div>

        <h3 style="margin:20px 0 8px;color:#111827">Plan de acción sugerido</h3>
        <div style="border:1px solid #E5E7EB;border-radius:12px;padding:12px">
          ${
            opps.length
              ? `<ul style="padding-left:18px;margin:0;list-style:disc;">${oppLi}</ul>`
              : `<p style="color:#374151;margin:0">No se detectaron oportunidades relevantes.</p>`
          }
        </div>

        <p style="text-align:right;font-size:12px;color:#6B7280;margin-top:24px">
          URL: <a href="${doc.url}" style="color:#2563EB">${doc.url}</a>
        </p>
      </div>
    `;

    // 7) Transporter
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: { user: process.env.EMAIL_USER as string, pass: process.env.EMAIL_PASS as string },
    });

    // 8) Opciones de correo
    const mailOptions: SendMailOptions = {
      from: process.env.EMAIL_USER,
      to: toEmail,
      subject: title,
      html,
      attachments: pdf?.base64 && pdf?.filename
        ? [
            {
              filename: pdf.filename,
              content: Buffer.from(pdf.base64, "base64"),
              contentType: pdf.contentType || "application/pdf",
            },
          ]
        : undefined,
    };

    // 9) Enviar
    const info: SentMessageInfo = await transporter.sendMail(mailOptions);

    return res.status(200).json({
      message: "Informe de diagnóstico enviado correctamente",
      messageId: info.messageId,
    });
  } catch (err: any) {
    // eslint-disable-next-line no-console
    console.error("❌ Error al enviar el diagnóstico:", err);
    return res
      .status(500)
      .json({ error: "Error al enviar el diagnóstico", detail: err?.message || String(err) });
  }
}