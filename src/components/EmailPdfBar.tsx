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

  // Espera estable: 2x rAF, fuentes e imágenes
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

  // Copia CSS (link y style) al iframe
  function copyStylesTo(doc: Document) {
    const head = doc.head;
    const srcDoc = document;

    // NOTE: avoid copying external <link rel="stylesheet"> into the iframe because
    // those stylesheets may contain modern color functions (color(), oklab(), ...)
    // that html2canvas can't parse. We will rely on inlining computed styles
    // for visual fidelity and only copy/clean <style> blocks.

    // Helper to sanitize CSS content by removing modern color functions
    const sanitizeCss = (cssText: string) =>
      cssText.replace(/\b(color|oklab|oklch|lab|lch|color-mix)\([^)]*\)/gi, 'transparent');

    // Copy and sanitize <style> elements
    srcDoc.querySelectorAll('style').forEach((st) => {
      try {
        const el = doc.createElement('style');
        el.textContent = sanitizeCss(st.textContent || '');
        head.appendChild(el);
      } catch (e) {
        // ignore problematic style blocks
      }
    });
  }

  // Zonas a evitar (no cortar dentro de …)
  function computeAvoidRects(root: HTMLElement): Array<[number, number]> {
    // cards, items, etc. (¡siéntete libre de añadir selectores tuyos!)
    const sel = [
      ".diagnostico-grid .item",
      ".card",
      ".issues-list .item",
      ".opportunities-list .item",
    ].join(",");
    const rootTop = root.getBoundingClientRect().top;
    const rects: Array<[number, number]> = [];
    Array.from(root.querySelectorAll(sel)).forEach((el) => {
      const r = (el as HTMLElement).getBoundingClientRect();
      const top = Math.max(0, r.top - rootTop);
      const bottom = top + r.height;
      if (bottom - top > 24) rects.push([top, bottom]);
    });
    rects.sort((a, b) => a[0] - b[0]);
    const merged: Array<[number, number]> = [];
    for (const [t, b] of rects) {
      if (!merged.length || t > merged[merged.length - 1][1] + 4) merged.push([t, b]);
      else merged[merged.length - 1][1] = Math.max(merged[merged.length - 1][1], b);
    }
    return merged;
  }

    // Puntos seguros para cortar: se generan AUTOMÁTICAMENTE
    function computeSafeStops(root: HTMLElement): number[] {
      const rootTop = root.getBoundingClientRect().top;
      const selectors = [
        // listas y bullets (lo más importante)
        "li", "[role='listitem']",
        // párrafos y encabezados dentro de tarjetas/secciones
        ".plan p", ".plan h3", ".plan .item",
        ".issues-list .item", ".opportunities-list .item",
        ".card > *", ".card p", ".card li",
        ".diagnostico-grid .item",
        "p", "h2", "h3",
        // marcas manuales, si algún día quieres usarlas
        "[data-pdf-stop]"
      ].join(",");

      const stops: number[] = [];
      Array.from(root.querySelectorAll(selectors)).forEach((el) => {
        const r = (el as HTMLElement).getBoundingClientRect();
        const bottom = Math.max(0, r.bottom - rootTop);
        if (bottom > 0 && Number.isFinite(bottom)) stops.push(Math.round(bottom));
      });

      // únicos y ordenados
      return Array.from(new Set(stops)).sort((a, b) => a - b);
    }


  // Captura en iframe con cortes inteligentes
  async function makePdfFromRef(): Promise<PdfAttachment> {
    const src = captureRef?.current;
    if (!src) return null;

    // 1) iframe invisible
    const iframe = document.createElement("iframe");
    Object.assign(iframe.style, {
      position: "fixed",
      left: "-99999px",
      top: "0",
      // Do NOT use 0x0 — make iframe have a real layout size so getBoundingClientRect
      // on cloned nodes returns useful values. Keep it visually hidden.
      width: "1200px",
      height: "100vh",
      border: "0",
      opacity: "0",
      pointerEvents: "none",
      visibility: "hidden",
    } as CSSStyleDeclaration);
    document.body.appendChild(iframe);

    const idoc = iframe.contentDocument!;
    idoc.open();
    idoc.write("<!doctype html><html><head></head><body></body></html>");
    idoc.close();
    copyStylesTo(idoc);

    // Force a desktop viewport inside the iframe so media queries and layout
    // compute as for a desktop (prevents mobile layout when running on wide screens).
    try {
      const vw = Math.max(1200, window.innerWidth || 1200);
      const meta = idoc.createElement('meta');
      meta.name = 'viewport';
      meta.content = `width=${vw}`;
      idoc.head.appendChild(meta);
      if (idoc.documentElement) idoc.documentElement.style.width = `${vw}px`;
      if (idoc.body) idoc.body.style.width = `${vw}px`;
      try { iframe.style.width = `${vw}px`; } catch (e) {}
    } catch (e) {
      // ignore
    }

    // 2) clon
    const clone = src.cloneNode(true) as HTMLElement;
    if (applyPdfClass && !clone.classList.contains(pdfClassName)) clone.classList.add(pdfClassName);
    clone.setAttribute("data-pdf", "true");
    clone.style.background = "#ffffff";
    clone.style.boxSizing = "border-box";

    const wrapper = idoc.createElement("div");
    Object.assign(wrapper.style, { position: "relative", margin: "0", padding: "0", background: "#ffffff" } as CSSStyleDeclaration);
    wrapper.appendChild(clone);
    idoc.body.appendChild(wrapper);

    // --- NEW: inline computed styles from the original document into the cloned nodes ---
    // html2canvas can fail parsing modern CSS color functions (e.g. color(), oklab()),
    // so we copy computed styles from the source elements and apply them as inline styles
    // on the clone. This preserves appearance while avoiding problematic stylesheet rules.
    const sanitizeCss = (cssText: string) =>
      cssText.replace(/\b(color|oklab|oklch|lab|lch|color-mix)\([^)]*\)/gi, 'transparent');

    function inlineComputedStyles(srcEl: HTMLElement, dstEl: HTMLElement) {
      try {
        const cs = window.getComputedStyle(srcEl);
        // Prefer cssText when available, otherwise build from properties
        if ((cs as any).cssText) {
          dstEl.style.cssText = sanitizeCss((cs as any).cssText);
        } else {
          let text = "";
          for (let i = 0; i < cs.length; i++) {
            const prop = cs[i];
            try {
              const val = cs.getPropertyValue(prop);
              if (val) text += `${prop}: ${val}; `;
            } catch (e) {}
          }
          dstEl.style.cssText = sanitizeCss(text);
        }
      } catch (e) {
        // ignore
      }

      // Recurse children in parallel only when counts match, otherwise try best-effort
      const srcChildren = Array.from(srcEl.children) as HTMLElement[];
      const dstChildren = Array.from(dstEl.children) as HTMLElement[];
      const n = Math.min(srcChildren.length, dstChildren.length);
      for (let i = 0; i < n; i++) {
        inlineComputedStyles(srcChildren[i] as HTMLElement, dstChildren[i] as HTMLElement);
      }
    }

    try {
      // Run inlining on the top node; this is potentially expensive but necessary to avoid
      // html2canvas parsing CSS functions not supported by its parser.
      inlineComputedStyles(src, clone);
    } catch (e) {
      // noop
    }

    try {
      // 3) ancho/alto objetivo
      const rect = src.getBoundingClientRect();
      // Prefer an explicit captureWidthPx, then the current window.width (to capture desktop layout),
      // then the source element sizes, falling back to 1280.
      const viewportPrefer = Math.max(window.innerWidth || 1280, src.scrollWidth || 0, rect.width || 0, 1280);
      const targetW = Math.ceil(captureWidthPx ?? viewportPrefer);
      clone.style.width = `${targetW}px`;
      clone.style.maxWidth = `${targetW}px`;
      clone.style.overflow = "visible";

      // Ensure the iframe and its document are forced to the desktop width so the cloned DOM
      // lays out as on desktop (prevents responsive/mobile CSS from taking effect).
      try {
        iframe.style.width = `${targetW}px`;
        iframe.style.minWidth = `${targetW}px`;

        // Insert or update a meta viewport tag to lock the layout width inside the iframe.
        let meta = idoc.querySelector('meta[name="viewport"]') as HTMLMetaElement | null;
        if (!meta) {
          meta = idoc.createElement('meta');
          meta.name = 'viewport';
          idoc.head.appendChild(meta);
        }
        meta.content = `width=${targetW}, initial-scale=1`;

        // Force documentElement/body widths to match the target capture width.
        idoc.documentElement.style.width = `${targetW}px`;
        idoc.documentElement.style.maxWidth = `${targetW}px`;
        idoc.body.style.width = `${targetW}px`;
        idoc.body.style.maxWidth = `${targetW}px`;
        idoc.documentElement.style.boxSizing = 'border-box';
        idoc.body.style.boxSizing = 'border-box';
      } catch (e) {
        // best-effort — ignore failures here
      }

      await waitForReady(idoc, clone, extraWaitMs);
      const targetH = clone.scrollHeight;

      // --- NEW: Ensure no canvas element inside the clone has 0 width/height ---
      function fixZeroSizeCanvases(root: HTMLElement) {
        try {
          const canvases = Array.from(root.querySelectorAll('canvas')) as HTMLCanvasElement[];
          canvases.forEach((c) => {
            try {
              // Try multiple ways to get a usable CSS size (bounding rect may be 0 inside hidden iframe)
              const rect = (c as HTMLElement).getBoundingClientRect();
              const fallbackW = (c as any).offsetWidth || (c as any).clientWidth || 0;
              const fallbackH = (c as any).offsetHeight || (c as any).clientHeight || 0;
              const cssWraw = rect.width || fallbackW || 1;
              const cssHraw = rect.height || fallbackH || 1;
              const cssW = Math.max(1, Math.round(cssWraw));
              const cssH = Math.max(1, Math.round(cssHraw));

              // Ensure internal bitmap has at least 1px in both dims
              if (!c.width || c.width < 1) c.width = cssW;
              if (!c.height || c.height < 1) c.height = cssH;

              // If internal bitmap is smaller than desired CSS size, enlarge it
              if (c.width < cssW) c.width = cssW;
              if (c.height < cssH) c.height = cssH;

              // Ensure CSS size is non-zero so html2canvas won't treat it as empty
              try {
                const sW = parseFloat(c.style.width as any) || 0;
                const sH = parseFloat(c.style.height as any) || 0;
                if (sW < 1) c.style.width = `${cssW}px`;
                if (sH < 1) c.style.height = `${cssH}px`;
              } catch (e) {}

              // Clear the canvas to avoid patterns referencing empty bitmaps
              const ctx = c.getContext('2d');
              if (ctx) ctx.clearRect(0, 0, c.width, c.height);
            } catch (e) {
              // ignore per-canvas failures
            }
          });
        } catch (e) {
          // noop
        }
      }

      // Run the fix before rendering to canvas
      fixZeroSizeCanvases(clone);

      // NEW: replace all <canvas> elements with <img> to avoid html2canvas pattern errors
      function replaceCanvasesWithImages(root: HTMLElement) {
        const canvases = Array.from(root.querySelectorAll('canvas')) as HTMLCanvasElement[];
        canvases.forEach((c) => {
          try {
            const dataUrl = c.toDataURL('image/png');
            const img = idoc.createElement('img');
            img.src = dataUrl;
            img.width = c.width;
            img.height = c.height;
            img.style.width = c.style.width || c.width + 'px';
            img.style.height = c.style.height || c.height + 'px';
            c.parentNode?.replaceChild(img, c);
          } catch (e) {
            // ignore per-canvas failures
          }
        });
      }
      replaceCanvasesWithImages(clone);

      // Remove any remaining <canvas> elements to avoid createPattern errors
      Array.from(clone.querySelectorAll('canvas')).forEach(c => c.remove());

      // 4) canvas
      const canvas = await html2canvas(clone, {
        // use SVG foreignObject to avoid CanvasRenderingContext2D.createPattern errors
        foreignObjectRendering: true,
         // skip any canvas elements
         ignoreElements: (el) => el.tagName.toLowerCase() === 'canvas',
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

      // 5) PDF con cortes inteligentes en px del CANVAS
      const pdf = new jsPDF({ orientation: "p", unit: "pt", format: "a4" });
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();

      const cw = canvas.width;
      const ch = canvas.height;

      // DOM→CANVAS
      const domToCanvas = cw / (clone.getBoundingClientRect().width || targetW);

      const imgW = pageW - marginPt * 2;
      const canvasPxToPt = imgW / cw; // escala para addImage
      const visiblePerPagePt = pageH - marginPt * 2;
      const visiblePerPageCanvasPx = Math.floor(visiblePerPagePt / canvasPxToPt);

      // spans a evitar y paradas seguras (convertidos a px del canvas)
      const avoidSpansDom = computeAvoidRects(clone);
      const avoidSpans = avoidSpansDom.map(([t, b]) => [t * domToCanvas, b * domToCanvas] as [number, number]);
      const safeStopsDom = computeSafeStops(clone);
      const safeStops = safeStopsDom.map((y) => y * domToCanvas);

      const pad = Math.round(12 * domToCanvas);
      const minSlice = Math.round(220 * domToCanvas); // no páginas “enanas”
      const lookAhead = Math.round(80 * domToCanvas); // margen extra para encontrar buen corte

      const insideSpan = (y: number) => avoidSpans.some(([t, b]) => y > t && y < b);

      let yPx = 0;
      let first = true;

      while (yPx < ch) {
        // límite deseado
        const desired = Math.min(yPx + visiblePerPageCanvasPx, ch);

        // candidato: último punto seguro <= desired+lookAhead y >= yPx+minSlice
        const candidates = safeStops.filter((s) => s >= yPx + minSlice && s <= desired + lookAhead);
        let boundary = candidates.length ? Math.max(...candidates) : desired;

        // si boundary cae en medio de un span, muévelo al final del span (+pad)
        if (insideSpan(boundary)) {
          for (const [t, b] of avoidSpans) {
            if (boundary > t && boundary < b) {
              boundary = Math.min(b + pad, ch);
            }
          }
        }

        // fallback por seguridad
        if (boundary - yPx < minSlice && yPx + minSlice < ch) {
          boundary = Math.min(yPx + minSlice, ch);
        }

        const sliceH = boundary - yPx;
        const slice = idoc.createElement("canvas");
        slice.width = cw;
        slice.height = sliceH;

        const sctx = slice.getContext("2d")!;
        sctx.drawImage(canvas, 0, yPx, cw, sliceH, 0, 0, cw, sliceH);

        const img = slice.toDataURL("image/png");
        const hPt = sliceH * canvasPxToPt;

        if (!first) pdf.addPage();
        first = false;
        pdf.addImage(img, "PNG", marginPt, marginPt, imgW, hPt, undefined, "FAST");

        yPx = boundary;
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
          cursor: "pointer",
          boxShadow: "0 1px 2px rgba(0,0,0,.08)",
          fontWeight: 600,
          transition: "all 0.3s ease",
        }}
        onMouseEnter={(e) => {
          if (!sending) {
            e.currentTarget.style.background = "#1d4ed8";
            e.currentTarget.style.transform = "translateY(-1px)";
            e.currentTarget.style.boxShadow = "0 4px 12px rgba(59, 130, 246, 0.4)";
          }
        }}
        onMouseLeave={(e) => {
          if (!sending) {
            e.currentTarget.style.background = "#2563EB";
            e.currentTarget.style.transform = "translateY(0)";
            e.currentTarget.style.boxShadow = "0 1px 2px rgba(0,0,0,.08)";
          }
        }}
      >
        {sending ? "Enviando…" : "Enviar informe (PDF) ✉️"}
      </button>

      {errorMsg && <span style={{ color: "#dc2626", fontSize: ".95rem" }}>❌ {errorMsg}</span>}
      {sentMsg && <span style={{ color: "#059669", fontSize: ".95rem" }}>✅ {sentMsg}</span>}
    </div>
  );
}