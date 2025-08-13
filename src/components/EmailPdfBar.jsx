import React, { useState } from "react";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";

/**
 * Barra para enviar el informe por correo usando tu endpoint JSON:
 *   POST /api/audit/send-report  =>  { url, email, subject?, pdf? }
 *
 * Props:
 *  - captureRef: ref al contenedor que se convertirá a PDF (NO incluye esta barra)
 *  - url: URL auditada (se envía en el body)
 *  - defaultEmail: string inicial opcional
 *  - subject: asunto opcional (default: "Diagnóstico de <url>")
 *  - includePdf: boolean (default true) para adjuntar PDF en el JSON
 */
export default function EmailSendBar({
  captureRef,
  url = "",
  defaultEmail = "",
  subject,
  includePdf = true
}) {
  const [email, setEmail] = useState(defaultEmail);
  const [sending, setSending] = useState(false);
  const [sentMsg, setSentMsg] = useState("");

  const finalSubject = subject || (url ? `Diagnóstico de ${url}` : "Diagnóstico");

  async function makePdfBlob() {
    const el = captureRef?.current;
    if (!el) throw new Error("No se encontró el contenedor a capturar.");
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

  async function blobToBase64(blob) {
    const dataUrl = await new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result);
      r.onerror = reject;
      r.readAsDataURL(blob);
    });
    // dataUrl = "data:application/pdf;base64,AAAA..."
    return String(dataUrl).split(",")[1]; // base64 puro
  }

  async function handleSend() {
    setSentMsg("");
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setSentMsg("❌ Ingresa un correo válido.");
      return;
    }

    try {
      setSending(true);

      let pdfPayload = undefined;
      if (includePdf) {
        const blob = await makePdfBlob();
        const base64 = await blobToBase64(blob);
        pdfPayload = {
          filename: `diagnostico-${new Date().toISOString().slice(0,10)}.pdf`,
          contentType: "application/pdf",
          base64
        };
      }

      const resp = await fetch("/api/audit/send-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url,
          email,
          subject: finalSubject,
          pdf: pdfPayload // tu API puede ignorarlo si no lo usa
        })
      });

      const text = await resp.text();
      let payload;
      try { payload = JSON.parse(text); } catch { payload = { message: text }; }
      if (!resp.ok) throw new Error(payload.error || payload.message || `Error ${resp.status}`);

      setSentMsg(`✅ ${payload.message || "Correo enviado con éxito."}`);
    } catch (e) {
      setSentMsg(`❌ ${e.message || e}`);
    } finally {
      setSending(false);
    }
  }

  return (
    <div style={{ marginTop: '1.5rem', textAlign: 'right' }}>
      <div style={{ display:'inline-flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
        <input
          type="email"
          placeholder="cliente@correo.com"
          value={email}
          onChange={(e)=>setEmail(e.target.value)}
          style={{ padding:'8px 10px', border:'1px solid #e5e7eb', borderRadius:10, minWidth:240 }}
        />
        <button
          className="btn-primary"
          disabled={sending}
          onClick={handleSend}
          title="Enviar informe al correo"
        >
          {sending ? 'Enviando…' : 'Enviar informe por correo ✉️'}
        </button>
      </div>

      {sentMsg && (
        <p style={{
          marginTop: '0.5rem',
          fontSize: '0.9rem',
          color: sentMsg.startsWith('❌') ? '#dc2626' : '#047857'
        }}>
          {sentMsg}
        </p>
      )}
    </div>
  );
}