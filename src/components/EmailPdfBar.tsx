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
  endpoint?: string;        // default: "/api/audit/send-diagnostic"
  includePdf?: boolean;     // default: true
  email?: string;           // email inicial
  hideEmailInput?: boolean; // default: true
  id?: string | null;
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
}: Props) {
  const [emailState, setEmailState] = useState<string>(email || "");
  const [sending, setSending] = useState<boolean>(false);
  const [sentMsg, setSentMsg] = useState<string>("");
  const [errorMsg, setErrorMsg] = useState<string>("");

  async function safeParse(res: Response): Promise<any> {
    const txt = await res.text();
    try { return JSON.parse(txt || "{}"); } catch { return { _raw: txt }; }
  }

  const waitForPaint = async (ms = 1200) => {
    await new Promise<void>(r => requestAnimationFrame(() => requestAnimationFrame(() => r())));
    if (ms > 0) await new Promise<void>(r => setTimeout(r, ms));
  };

  async function makePdfFromRef(): Promise<PdfAttachment> {
    if (!captureRef?.current) return null;

    // 1) NO mover la página
    const prevX = window.scrollX;
    const prevY = window.scrollY;

    try {
      await waitForPaint(1200);

      const canvas = await html2canvas(captureRef.current as HTMLElement, {
        useCORS: true,
        backgroundColor: "#ffffff",
        scale: 2,
        logging: false,
        // 2) Capturar sin depender del scroll actual
        windowWidth: document.documentElement.scrollWidth,
        windowHeight: document.documentElement.scrollHeight,
        scrollX: -window.scrollX,
        scrollY: -window.scrollY,
      });

      const pdf = new jsPDF({ orientation: "p", unit: "pt", format: "a4" });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 24;

      const origW = canvas.width;
      const origH = canvas.height;
      const imgWidth = pageWidth - margin * 2;
      const scale = imgWidth / origW;
      const visiblePerPage = pageHeight - margin * 2;

      let yPx = 0;
      const slicePx = Math.floor(visiblePerPage / scale);
      let first = true;

      while (yPx < origH) {
        const sliceH = Math.min(slicePx, origH - yPx);

        const slice = document.createElement("canvas");
        slice.width = origW;
        slice.height = sliceH;
        const sctx = slice.getContext("2d")!;
        sctx.drawImage(canvas, 0, yPx, origW, sliceH, 0, 0, origW, sliceH);

        const img = slice.toDataURL("image/png");
        const hPt = sliceH * scale;

        if (!first) pdf.addPage();
        first = false;

        pdf.addImage(img, "PNG", margin, margin, imgWidth, hPt, undefined, "FAST");

        yPx += sliceH;
      }

      const base64 = pdf.output("datauristring").split(",")[1]!;
      const filenameSafe = (url || "sitio")
        .replace(/[^a-z0-9]+/gi, "_")
        .replace(/^_+|_+$/g, "")
        .slice(0, 60);

      return {
        filename: `diagnostico_${filenameSafe}.pdf`,
        base64,
        contentType: "application/pdf",
      };
    } finally {
      // 3) Restaurar posición exacta
      window.scrollTo(prevX, prevY);
    }
  }

  async function handleSend() {
    setSentMsg("");
    setErrorMsg("");
    setSending(true);
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
        pdf
      };

      const res = await fetch(endpoint, {
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
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Error al enviar el informe";
      setErrorMsg(msg);
    } finally {
      setSending(false);
      setTimeout(() => setSentMsg(""), 5000);
    }
  }

  return (
    <div style={{ marginTop: 16, display: "flex", gap: 10, alignItems: "center", justifyContent: "flex-end", flexWrap: "wrap" }}>
      {/* Si lo tienes dentro de un <form>, esto evita submit */}
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
          fontWeight: 600
        }}
      >
        {sending ? "Enviando…" : "Enviar informe (PDF) ✉️"}
      </button>

      {errorMsg && <span style={{ color: "#dc2626", fontSize: ".95rem" }}>❌ {errorMsg}</span>}
      {sentMsg && <span style={{ color: "#059669", fontSize: ".95rem" }}>✅ {sentMsg}</span>}
    </div>
  );
}