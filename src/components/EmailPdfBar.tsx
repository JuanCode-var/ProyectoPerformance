// src/components/EmailPdfBar.tsx
import React, { useState, type RefObject, type ChangeEvent } from "react";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";

type PdfAttachment = {
  filename: string;
  base64: string;
  contentType: "application/pdf";
} | null;

type Props = {
  captureRef: RefObject<HTMLElement | null>;
  url?: string;
  subject?: string;
  endpoint?: string;                 // default: "/api/audit/send-diagnostic"
  includePdf?: boolean;              // default: true
  email?: string;
  hideEmailInput?: boolean;          // default: true
  id?: string | null;
  filenameBase?: string;
  marginPt?: number;                 // default: 24
  captureWidthPx?: number;           // si no pasas, se autodetecta
  extraWaitMs?: number;              // default: 150
  applyPdfClass?: boolean;           // default: true
  pdfClassName?: string;             // default: "pdf-root"
};

export default function EmailPdfBar({
  captureRef,
  url = "",
  subject,
  endpoint = "/api/audit/send-diagnostic",
  includePdf = true,
  email = "",
  hideEmailInput = true,
  id = null,
  filenameBase,
  marginPt = 24,
  captureWidthPx,
  extraWaitMs = 150,
  applyPdfClass = true,
  pdfClassName = "pdf-root",
}: Props) {
  const [emailState, setEmailState] = useState<string>(email || "");
  const [sending, setSending] = useState(false);
  const [sentMsg, setSentMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  async function safeParse(res: Response): Promise<any> {
    const txt = await res.text();
    try { return JSON.parse(txt || "{}"); } catch { return { _raw: txt }; }
  }

  // -------- utilidades ----------
  const waitForReady = async (doc: Document, root: HTMLElement, msExtra = 0) => {
    await new Promise<void>((r) => doc.defaultView?.requestAnimationFrame(() =>
      doc.defaultView?.requestAnimationFrame(() => r())
    ));
    const fonts: any = (doc as any).fonts;
    if (fonts?.ready) { try { await fonts.ready; } catch {} }
    const imgs = Array.from(root.querySelectorAll("img")) as HTMLImageElement[];
    await Promise.all(imgs.map(img => new Promise<void>((resolve) => {
      if (img.complete && img.naturalWidth) return resolve();
      img.addEventListener("load", () => resolve(), { once: true });
      img.addEventListener("error", () => resolve(), { once: true });
    })));
    if (msExtra > 0) await new Promise<void>((r) => setTimeout(r, msExtra));
  };

  function copyStylesTo(doc: Document) {
    const head = doc.head;
    const srcDoc = document;
    srcDoc.querySelectorAll('link[rel="stylesheet"]').forEach((lnk) => {
      const el = doc.createElement("link");
      el.rel = "stylesheet";
      el.href = (lnk as HTMLLinkElement).href;
      head.appendChild(el);
    });
    srcDoc.querySelectorAll("style").forEach((st) => {
      const el = doc.createElement("style");
      el.textContent = st.textContent || "";
      head.appendChild(el);
    });
  }

  // Calcula zonas a evitar (para no cortar tarjetas/gauges a la mitad)
  function computeAvoidRects(root: HTMLElement): Array<[number, number]> {
    const sel = [
      ".diagnostico-grid .item",
      ".card",
      ".opportunities-list .item",
      ".issues-list .item",
    ].join(",");

    const rootTop = root.getBoundingClientRect().top;
    const rects: Array<[number, number]> = [];
    Array.from(root.querySelectorAll(sel)).forEach((el) => {
      const r = (el as HTMLElement).getBoundingClientRect();
      const top = Math.max(0, r.top - rootTop);
      const bottom = top + r.height;
      if (bottom - top > 20) rects.push([top, bottom]);
    });

    // unimos rectas solapadas
    rects.sort((a, b) => a[0] - b[0]);
    const merged: Array<[number, number]> = [];
    for (const [t, b] of rects) {
      if (!merged.length || t > merged[merged.length - 1][1] + 4) {
        merged.push([t, b]);
      } else {
        merged[merged.length - 1][1] = Math.max(merged[merged.length - 1][1], b);
      }
    }
    return merged;
  }

  function findSafeCut(y: number, spans: Array<[number, number]>, maxY: number): number {
    // si y cae dentro de una span, bajamos al final de la span (+espacio)
    const pad = 8; // px extra para respiración
    for (const [t, b] of spans) {
      if (y > t && y < b) return Math.min(b + pad, maxY);
    }
    return y;
  }

  // ----------- captura en iframe con cortes inteligentes -----------
  async function makePdfFromRef(): Promise<PdfAttachment> {
    const src = captureRef?.current;
    if (!src) return null;

    // 1) iframe invisible
    const iframe = document.createElement("iframe");
    Object.assign(iframe.style, {
      position: "fixed", left: "-99999px", top: "0", width: "0", height: "0",
      border: "0", opacity: "0", pointerEvents: "none"
    } as CSSStyleDeclaration);
    document.body.appendChild(iframe);

    const idoc = iframe.contentDocument!;
    idoc.open();
    idoc.write("<!doctype html><html><head></head><body></body></html>");
    idoc.close();
    copyStylesTo(idoc);

    // 2) clonar
    const clone = src.cloneNode(true) as HTMLElement;
    if (applyPdfClass && !clone.classList.contains(pdfClassName)) clone.classList.add(pdfClassName);
    clone.setAttribute("data-pdf", "true");
    clone.style.background = "#ffffff";
    clone.style.boxSizing = "border-box";

    const wrapper = idoc.createElement("div");
    Object.assign(wrapper.style, {
      position: "relative", margin: "0", padding: "0", background: "#ffffff"
    } as CSSStyleDeclaration);
    wrapper.appendChild(clone);
    idoc.body.appendChild(wrapper);

    try {
      // 3) ancho/alto objetivo
      const rect = src.getBoundingClientRect();
      const targetW = Math.ceil(
        captureWidthPx ?? Math.max(src.scrollWidth, rect.width, 1280)
      );
      clone.style.width = `${targetW}px`;
      clone.style.maxWidth = `${targetW}px`;
      clone.style.overflow = "visible";

      await waitForReady(idoc, clone, extraWaitMs);
      const targetH = clone.scrollHeight;

      // 4) canvas del clon
      const canvas = await html2canvas(clone, {
        useCORS: true,
        backgroundColor: "#ffffff",
        scale: Math.min(2, Math.max(1, window.devicePixelRatio || 2)),
        logging: false,
        width: targetW,
        height: targetH,
        windowWidth: targetW,
        windowHeight: targetH,
        scrollX: 0,
        scrollY: 0,
      });

      // 5) PDF A4 + cortes inteligentes
      const pdf = new jsPDF({ orientation: "p", unit: "pt", format: "a4" });
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();

      const cw = canvas.width;
      const ch = canvas.height;

      const imgW = pageW - marginPt * 2;
      const scale = imgW / cw;
      const visiblePerPagePt = pageH - marginPt * 2;
      const visiblePerPagePx = Math.floor(visiblePerPagePt / scale);

      const avoidSpans = computeAvoidRects(clone);
      let yPx = 0;
      let first = true;

      while (yPx < ch) {
        // límite “deseado” para esta página
        let boundary = Math.min(yPx + visiblePerPagePx, ch);
        // mover a un corte seguro (no partir tarjetas)
        boundary = findSafeCut(boundary, avoidSpans, ch);

        const sliceH = boundary - yPx;
        const slice = idoc.createElement("canvas");
        slice.width = cw;
        slice.height = sliceH;
        const sctx = slice.getContext("2d")!;
        sctx.drawImage(canvas, 0, yPx, cw, sliceH, 0, 0, cw, sliceH);

        const img = slice.toDataURL("image/png");
        const hPt = sliceH * scale;
        if (!first) pdf.addPage();
        first = false;
        pdf.addImage(img, "PNG", marginPt, marginPt, imgW, hPt, undefined, "FAST");

        yPx = boundary; // avanzar al nuevo corte seguro
      }

      const base64 = pdf.output("datauristring").split(",")[1]!;
      const safeBase =
        (filenameBase ||
          (url || "sitio").replace(/[^a-z0-9]+/gi, "_").replace(/^_+|_+$/g, "").slice(0, 60)) ||
        "diagnostico";

      return {
        filename: `diagnostico_${safeBase}.pdf`,
        base64,
        contentType: "application/pdf",
      };
    } finally {
      try { document.body.removeChild(iframe); } catch {}
    }
  }

  async function handleSend() {
    setSentMsg(""); setErrorMsg(""); setSending(true);
    try {
      let pdf: PdfAttachment = null;
      if (includePdf) {
        pdf = await makePdfFromRef();
        if (!pdf) console.warn("No se pudo generar el PDF; se enviará sin adjunto.");
      }

      const payload = {
        id,
        url,
        subject: subject || (url ? `Diagnóstico de ${url}` : "Diagnóstico"),
        email: hideEmailInput ? undefined : (emailState || "").trim(),
        pdf,
      };

      const res = await fetch(endpoint || "/api/audit/send-diagnostic", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await safeParse(res);
      if (!res.ok) {
        const msg = data.error || data.message || data.detail || data._raw || `Error ${res.status}`;
        throw new Error(msg);
      }
      setSentMsg(data.message || "Informe enviado correctamente");
    } catch (e: any) {
      setErrorMsg(e?.message || "Error al enviar el informe");
    } finally {
      setSending(false);
      setTimeout(() => setSentMsg(""), 5000);
    }
  }

  return (
    <div
      style={{
        marginTop: 16,
        display: "flex",
        gap: 10,
        alignItems: "center",
        justifyContent: "flex-end",
        flexWrap: "wrap",
      }}
    >
      {!hideEmailInput && (
        <input
          type="email"
          placeholder="cliente@correo.com"
          value={emailState}
          onChange={(e: ChangeEvent<HTMLInputElement>) => setEmailState(e.target.value)}
          style={{
            padding: "10px 12px",
            borderRadius: 10,
            border: "1px solid #e5e7eb",
            minWidth: 260,
          }}
        />
      )}

      <button
        type="button"
        onClick={handleSend}
        disabled={sending}
        title="Enviar informe al correo (PDF)"
        style={{
          background: "#2563EB",
          color: "#fff",
          border: "none",
          padding: "12px 16px",
          borderRadius: 10,
          cursor: sending ? "default" : "pointer",
          boxShadow: "0 1px 2px rgba(0,0,0,.08)",
          fontWeight: 600,
        }}
      >
        {sending ? "Enviando…" : "Enviar informe (PDF) ✉️"}
      </button>

      {errorMsg && <span style={{ color: "#dc2626", fontSize: ".95rem" }}>❌ {errorMsg}</span>}
      {sentMsg && <span style={{ color: "#059669", fontSize: ".95rem" }}>✅ {sentMsg}</span>}
    </div>
  );
}