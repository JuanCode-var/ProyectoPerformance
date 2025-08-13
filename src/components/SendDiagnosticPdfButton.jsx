import React, { useState } from "react";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";

/**
 * Botón que:
 * - Captura SOLO el contenedor de diagnóstico (gauges + plan) en PDF
 * - Envía el PDF al backend como multipart/form-data a /api/audit/send-diagnostic
 * - Usa el email guardado en el documento (no muestra input)
 *
 * Props:
 *  - captureRef: ref al contenedor QUE SÍ va al PDF (no incluye el propio botón)
 *  - url: string (URL auditada)
 *  - email: string (el del formulario ya guardado en la BD)
 */
export default function SendDiagnosticPdfButton({ captureRef, url, email }) {
  const [sending, setSending] = useState(false);
  const [msg, setMsg] = useState("");

  async function makePdfBlob() {
    const el = captureRef?.current;
    if (!el) throw new Error("No se encontró el bloque de diagnóstico a capturar.");
    const prevY = window.scrollY;
    window.scrollTo(0, 0);
    try {
      const canvas = await html2canvas(el, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: "#ffffff",
        windowWidth: document.documentElement.scrollWidth,
        windowHeight: document.documentElement.scrollHeight,
      });

      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF("p", "mm", "a4");
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const imgW = pageW;
      const imgH = (canvas.height * imgW) / canvas.width;

      let heightLeft = imgH;
      let position = 0;
      pdf.addImage(imgData, "PNG", 0, position, imgW, imgH, undefined, "FAST");
      heightLeft -= pageH;

      while (heightLeft > 0) {
        position = heightLeft * -1;
        pdf.addPage();
        pdf.addImage(imgData, "PNG", 0, position, imgW, imgH, undefined, "FAST");
        heightLeft -= pageH;
      }

      return pdf.output("blob");
    } finally {
      window.scrollTo(0, prevY);
    }
  }

  async function handleSend() {
    setMsg("");
    if (!email) {
      setMsg("❌ No hay correo asociado a este diagnóstico.");
      return;
    }
    try {
      setSending(true);
      const blob = await makePdfBlob();
      const file = new File([blob], "diagnostico.pdf", { type: "application/pdf" });
      const fd = new FormData();
      fd.append("email", email);
      fd.append("url", url || "");
      fd.append("file", file); // <-- multipart evita "request entity too large"

      const resp = await fetch("/api/audit/send-diagnostic", {
        method: "POST",
        body: fd
      });

      const text = await resp.text();
      let payload;
      try { payload = JSON.parse(text); } catch { payload = { message: text }; }
      if (!resp.ok) throw new Error(payload.error || payload.message || `Error ${resp.status}`);

      setMsg(`✅ ${payload.message || "Informe enviado al correo."}`);
    } catch (e) {
      setMsg(`❌ ${e.message || e}`);
    } finally {
      setSending(false);
    }
  }

  return (
    <div style={{ marginTop: '1.5rem', textAlign: 'right' }}>
      <button className="btn-primary" disabled={sending} onClick={handleSend}>
        {sending ? "Enviando…" : "Enviar informe por correo ✉️"}
      </button>
      {msg && (
        <p style={{ marginTop: '0.5rem', fontSize: '0.9rem', color: msg.startsWith("❌") ? "#dc2626" : "#047857" }}>
          {msg}
        </p>
      )}
    </div>
  );
}