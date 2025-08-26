import React, { useState, type RefObject, type ChangeEvent } from "react"
import html2canvas from "html2canvas"
import jsPDF from "jspdf"
import { z } from "zod"
import { Input } from "../shared/ui/input"
import { Button } from "../shared/ui/button"
import { Card, CardContent } from "../shared/ui/card"

type PdfAttachment = {
  filename: string
  base64: string
  contentType: "application/pdf"
} | null

type Props = {
  captureRef: RefObject<HTMLElement | null>
  url?: string
  subject?: string
  endpoint?: string
  includePdf?: boolean
  email?: string
  hideEmailInput?: boolean
  id?: string | null
  filenameBase?: string
  marginPt?: number
  captureWidthPx?: number
  extraWaitMs?: number
  applyPdfClass?: boolean
  pdfClassName?: string
}

const EmailSchema = z.object({
  email: z.string().email("Correo inválido").min(5, "Correo inválido"),
})

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
  const [emailState, setEmailState] = useState<string>(email || "")
  const [sending, setSending] = useState(false)
  const [sentMsg, setSentMsg] = useState("")
  const [errorMsg, setErrorMsg] = useState("")

  async function safeParse(res: Response): Promise<any> {
    const txt = await res.text()
    try { return JSON.parse(txt || "{}") } catch { return { _raw: txt } }
  }

  // Esperas y helpers (idénticos a tu versión)
  const waitForReady = async (doc: Document, root: HTMLElement, msExtra = 0) => {
    await new Promise<void>((r) => doc.defaultView?.requestAnimationFrame(() =>
      doc.defaultView?.requestAnimationFrame(() => r())
    ))
    const fonts: any = (doc as any).fonts
    if (fonts?.ready) { try { await fonts.ready } catch {} }
    const imgs = Array.from(root.querySelectorAll("img")) as HTMLImageElement[]
    await Promise.all(imgs.map(img => new Promise<void>((resolve) => {
      if (img.complete && img.naturalWidth) return resolve()
      img.addEventListener("load", () => resolve(), { once: true })
      img.addEventListener("error", () => resolve(), { once: true })
    })))
    if (msExtra > 0) await new Promise<void>((r) => setTimeout(r, msExtra))
  }

  function copyStylesTo(doc: Document) {
    const head = doc.head
    const srcDoc = document
    srcDoc.querySelectorAll('link[rel="stylesheet"]').forEach((lnk) => {
      const el = doc.createElement("link")
      el.rel = "stylesheet"
      el.href = (lnk as HTMLLinkElement).href
      head.appendChild(el)
    })
    srcDoc.querySelectorAll("style").forEach((st) => {
      const el = doc.createElement("style")
      el.textContent = st.textContent || ""
      head.appendChild(el)
    })
  }

  function computeAvoidRects(root: HTMLElement): Array<[number, number]> {
    const sel = [
      ".diagnostico-grid .item",
      ".card",
      ".issues-list .item",
      ".opportunities-list .item",
    ].join(",")
    const rootTop = root.getBoundingClientRect().top
    const rects: Array<[number, number]> = []
    Array.from(root.querySelectorAll(sel)).forEach((el) => {
      const r = (el as HTMLElement).getBoundingClientRect()
      const top = Math.max(0, r.top - rootTop)
      const bottom = top + r.height
      if (bottom - top > 24) rects.push([top, bottom])
    })
    rects.sort((a, b) => a[0] - b[0])
    const merged: Array<[number, number]> = []
    for (const [t, b] of rects) {
      if (!merged.length || t > merged[merged.length - 1][1] + 4) merged.push([t, b])
      else merged[merged.length - 1][1] = Math.max(merged[merged.length - 1][1], b)
    }
    return merged
  }

  function computeSafeStops(root: HTMLElement): number[] {
    const rootTop = root.getBoundingClientRect().top
    const selectors = [
      "li", "[role='listitem']",
      ".plan p", ".plan h3", ".plan .item",
      ".issues-list .item", ".opportunities-list .item",
      ".card > *", ".card p", ".card li",
      ".diagnostico-grid .item",
      "p", "h2", "h3",
      "[data-pdf-stop]"
    ].join(",")
    const stops: number[] = []
    Array.from(root.querySelectorAll(selectors)).forEach((el) => {
      const r = (el as HTMLElement).getBoundingClientRect()
      const bottom = Math.max(0, r.bottom - rootTop)
      if (bottom > 0 && Number.isFinite(bottom)) stops.push(Math.round(bottom))
    })
    return Array.from(new Set(stops)).sort((a, b) => a - b)
  }

  async function makePdfFromRef(): Promise<PdfAttachment> {
    const src = captureRef?.current
    if (!src) return null

    const iframe = document.createElement("iframe")
    Object.assign(iframe.style, {
      position: "fixed", left: "-99999px", top: "0", width: "0", height: "0",
      border: "0", opacity: "0", pointerEvents: "none"
    } as CSSStyleDeclaration)
    document.body.appendChild(iframe)

    const idoc = iframe.contentDocument!
    idoc.open()
    idoc.write("<!doctype html><html><head></head><body></body></html>")
    idoc.close()
    copyStylesTo(idoc)

    const clone = src.cloneNode(true) as HTMLElement
    if (applyPdfClass && !clone.classList.contains(pdfClassName)) clone.classList.add(pdfClassName)
    clone.setAttribute("data-pdf", "true")
    clone.style.background = "#ffffff"
    clone.style.boxSizing = "border-box"

    const wrapper = idoc.createElement("div")
    Object.assign(wrapper.style, { position: "relative", margin: "0", padding: "0", background: "#ffffff" } as CSSStyleDeclaration)
    wrapper.appendChild(clone)
    idoc.body.appendChild(wrapper)

    try {
      const rect = src.getBoundingClientRect()
      const targetW = Math.ceil(captureWidthPx ?? Math.max(src.scrollWidth, rect.width, 1280))
      clone.style.width = `${targetW}px`
      clone.style.maxWidth = `${targetW}px`
      clone.style.overflow = "visible"

      await waitForReady(idoc, clone, extraWaitMs)
      const targetH = clone.scrollHeight

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
      })

      const pdf = new jsPDF({ orientation: "p", unit: "pt", format: "a4" })
      const pageW = pdf.internal.pageSize.getWidth()
      const pageH = pdf.internal.pageSize.getHeight()
      const cw = canvas.width
      const ch = canvas.height

      const domToCanvas = cw / (clone.getBoundingClientRect().width || targetW)
      const imgW = pageW - marginPt * 2
      const canvasPxToPt = imgW / cw
      const visiblePerPagePt = pageH - marginPt * 2
      const visiblePerPageCanvasPx = Math.floor(visiblePerPagePt / canvasPxToPt)

      const avoidSpansDom = computeAvoidRects(clone)
      const avoidSpans = avoidSpansDom.map(([t, b]) => [t * domToCanvas, b * domToCanvas] as [number, number])
      const safeStopsDom = computeSafeStops(clone)
      const safeStops = safeStopsDom.map((y) => y * domToCanvas)

      const pad = Math.round(12 * domToCanvas)
      const minSlice = Math.round(220 * domToCanvas)
      const lookAhead = Math.round(80 * domToCanvas)
      const insideSpan = (y: number) => avoidSpans.some(([t, b]) => y > t && y < b)

      let yPx = 0
      let first = true

      while (yPx < ch) {
        const desired = Math.min(yPx + visiblePerPageCanvasPx, ch)
        const candidates = safeStops.filter((s) => s >= yPx + minSlice && s <= desired + lookAhead)
        let boundary = candidates.length ? Math.max(...candidates) : desired
        if (insideSpan(boundary)) {
          for (const [t, b] of avoidSpans) if (boundary > t && boundary < b) boundary = Math.min(b + pad, ch)
        }
        if (boundary - yPx < minSlice && yPx + minSlice < ch) boundary = Math.min(yPx + minSlice, ch)

        const sliceH = boundary - yPx
        const slice = idoc.createElement("canvas")
        slice.width = cw
        slice.height = sliceH
        const sctx = slice.getContext("2d")!
        sctx.drawImage(canvas, 0, yPx, cw, sliceH, 0, 0, cw, sliceH)

        const img = slice.toDataURL("image/png")
        const hPt = sliceH * canvasPxToPt

        if (!first) pdf.addPage()
        first = false
        pdf.addImage(img, "PNG", marginPt, marginPt, imgW, hPt, undefined, "FAST")

        yPx = boundary
      }

      const base64 = pdf.output("datauristring").split(",")[1]!
      const safeBase =
        (filenameBase ||
          (url || "sitio").replace(/[^a-z0-9]+/gi, "_").replace(/^_+|_+$/g, "").slice(0, 60)) ||
        "diagnostico"

      return {
        filename: `diagnostico_${safeBase}.pdf`,
        base64,
        contentType: "application/pdf",
      }
    } finally {
      try { document.body.removeChild(iframe) } catch {}
    }
  }

  async function handleSend() {
    setSentMsg(""); setErrorMsg(""); setSending(true)
    try {
      // Validación de correo si el input está visible
      if (!hideEmailInput) {
        const ok = EmailSchema.safeParse({ email: emailState.trim() })
        if (!ok.success) {
          throw new Error(ok.error.issues[0]?.message ?? "Correo inválido")
        }
      }

      let pdf: PdfAttachment = null
      if (includePdf) {
        pdf = await makePdfFromRef()
        if (!pdf) console.warn("No se pudo generar el PDF; se enviará sin adjunto.")
      }

      const payload = {
        id,
        url,
        subject: subject || (url ? `Diagnóstico de ${url}` : "Diagnóstico"),
        email: hideEmailInput ? undefined : (emailState || "").trim(),
        pdf,
      }

      const res = await fetch(endpoint || "/api/audit/send-diagnostic", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const data = await safeParse(res)
      if (!res.ok) {
        const msg = data.error || data.message || data.detail || data._raw || `Error ${res.status}`
        throw new Error(msg)
      }
      setSentMsg(data.message || "Informe enviado correctamente")
    } catch (e: any) {
      setErrorMsg(e?.message || "Error al enviar el informe")
    } finally {
      setSending(false)
      setTimeout(() => setSentMsg(""), 5000)
    }
  }

return (
  <div className="pdf-actions">
    {!hideEmailInput && (
      <input
        type="email"
        placeholder="cliente@correo.com"
        value={emailState}
        onChange={(e: ChangeEvent<HTMLInputElement>) => setEmailState(e.target.value)}
        className="pdf-email-input"
      />
    )}

    <button
      type="button"
      onClick={handleSend}
      disabled={sending}
      aria-busy={sending || undefined}
      aria-label="Enviar informe al correo (PDF)"
      title="Enviar informe al correo (PDF)"
      className="btn-primary pdf-send-btn"
    >
      {sending ? (
        <>
          <span className="btn-spinner" aria-hidden="true" />
          Enviando…
        </>
      ) : (
        <>
          Enviar informe (PDF)
          <span aria-hidden="true">✉️</span>
        </>
      )}
    </button>

    {errorMsg && <p className="pdf-msg is-error">❌ {errorMsg}</p>}
    {sentMsg &&  <p className="pdf-msg is-ok">✅ {sentMsg}</p>}
  </div>
)
}