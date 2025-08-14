import React, { useState } from "react";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";

/**
 * Barra para enviar el informe por correo SOLO con PDF adjunto.
 *
 * Props:
 *  - captureRef: ref al contenedor que se convertirá a PDF (gráficas + errores + mejoras + plan)
 *  - url: URL auditada
 *  - subject: asunto (p.ej. "Diagnóstico de <url>")
 *  - endpoint: endpoint backend (default: "/api/audit/send-diagnostic")
 *  - includePdf: boolean (default true)
 *  - email: (opcional) si hideEmailInput=false, se usa este email; si true, el backend usará el email del diagnóstico
 *  - hideEmailInput: si true (default), no se muestra input de correo
 *  - id: (opcional) id del diagnóstico en BD
 */
export default function EmailPdfBar({
  captureRef,
  url = "",
  subject,
  endpoint = "/api/audit/send-diagnostic",
  includePdf = true,
  email = "",
  hideEmailInput = true,
  id = null,
}) {
  const [emailState, setEmailState] = useState(email || "");
  const [sending, setSending] = useState(false);
  const [sentMsg, setSentMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  // Parseo seguro: evita "Unexpected end of JSON input"
  async function safeParse(res) {
    const txt = await res.text();
    try { return JSON.parse(txt || "{}"); } catch { return { _raw: txt }; }
  }

  // Espera a que el DOM/estilos terminen de pintar
  const waitForPaint = async (ms = 1200) => {
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
    if (ms > 0) await new Promise(r => setTimeout(r, ms));
  };

  // Crea un PDF multipágina a partir del contenedor
  async function makePdfFromRef() {
    if (!captureRef?.current) return null;

    // Asegurar visibilidad del contenedor
    try { captureRef.current.scrollIntoView({ behavior: "auto", block: "start" }); } catch {}

    // Esperar pintado (evita PDF con valores en 0 o listas vacías)
    await waitForPaint(1200);

    // Render a canvas (doble escala = mejor nitidez)
    const canvas = await html2canvas(captureRef.current, {
      useCORS: true,
      backgroundColor: "#ffffff",
      scale: 2,
      logging: false,
      windowWidth: document.documentElement.scrollWidth,
      windowHeight: document.documentElement.scrollHeight,
    });

    // Config PDF en puntos (pt) para precisión
    const pdf = new jsPDF({ orientation: "p", unit: "pt", format: "a4" });
    const pageWidth = pdf.internal.pageSize.getWidth();   // ~595 pt
    const pageHeight = pdf.internal.pageSize.getHeight(); // ~842 pt
    const margin = 24;

    const origW = canvas.width;
    const origH = canvas.height;

    // Escalamos la imagen al ancho de página (con márgenes)
    const imgWidth = pageWidth - margin * 2;
    const scale = imgWidth / origW;
    const scaledTotalHeight = origH * scale;
    const visiblePerPage = pageHeight - margin * 2;

    // Slicing: recortar porciones del canvas original y añadir páginas
    let yPx = 0;
    const slicePx = Math.floor(visiblePerPage / scale); // alto en pixeles originales por página
    let firstPage = true;

    while (yPx < origH) {
      const sliceHeightPx = Math.min(slicePx, origH - yPx);

      // Canvas temporal con el "corte" visible de esta página
      const sliceCanvas = document.createElement("canvas");
      sliceCanvas.width = origW;
      sliceCanvas.height = sliceHeightPx;
      const sctx = sliceCanvas.getContext("2d");
      sctx.drawImage(
        canvas,
        0, yPx, origW, sliceHeightPx,  // src
        0, 0, origW, sliceHeightPx     // dst
      );

      const sliceData = sliceCanvas.toDataURL("image/png");
      const sliceHeightPt = sliceHeightPx * scale;

      if (!firstPage) pdf.addPage();
      firstPage = false;

      pdf.addImage(
        sliceData,
        "PNG",
        margin,
        margin,
        imgWidth,
        sliceHeightPt,
        undefined,
        "FAST"
      );

      yPx += sliceHeightPx;
    }

    // Exporta como base64 (sin encabezado data:)
    const base64 = pdf.output("datauristring").split(",")[1];

    const filenameSafe = (url || "sitio")
      .replace(/[^a-z0-9]+/gi, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 60);

    return {
      filename: `diagnostico_${filenameSafe}.pdf`,
      base64,
      contentType: "application/pdf",
    };
  }

  async function handleSend() {
    setSentMsg("");
    setErrorMsg("");
    setSending(true);
    try {
      let pdf = null;

      if (includePdf) {
        pdf = await makePdfFromRef();
        if (!pdf) {
          // Continuar sin PDF si algo falla (pero avisar)
          console.warn("No se pudo generar el PDF; se enviará sin adjunto.");
        }
      }

      // Payload SOLO con PDF (sin tabla ni html)
      const payload = {
        id,
        url,
        subject: subject || (url ? `Diagnóstico de ${url}` : "Diagnóstico"),
        // Si ocultas el input, el backend usará el email guardado en el diagnóstico
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
    } catch (e) {
      setErrorMsg(e.message || "Error al enviar el informe");
    } finally {
      setSending(false);
      setTimeout(() => setSentMsg(""), 5000);
    }
  }

  return (
    <div style={{ marginTop: 16, display: "flex", gap: 10, alignItems: "center", justifyContent: "flex-end", flexWrap: "wrap" }}>
      {!hideEmailInput && (
        <input
          type="email"
          placeholder="cliente@correo.com"
          value={emailState}
          onChange={(e) => setEmailState(e.target.value)}
          style={{
            padding: "10px 12px",
            borderRadius: 10,
            border: "1px solid #e5e7eb",
            minWidth: 260,
          }}
        />
      )}

      <button
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

      {errorMsg && (
        <span style={{ color: "#dc2626", fontSize: ".95rem" }}>❌ {errorMsg}</span>
      )}
      {sentMsg && (
        <span style={{ color: "#059669", fontSize: ".95rem" }}>✅ {sentMsg}</span>
      )}
    </div>
  );
}
