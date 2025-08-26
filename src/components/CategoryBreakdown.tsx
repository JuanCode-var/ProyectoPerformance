import React, { useMemo } from "react"
import { Card, CardContent } from "../shared/ui/card"

import {
  tTitle as i18nTitle,
  tRich as i18nRich,
  tSavings as i18nSavings,
} from "../../microPagespeed/src/lib/lh-i18n-es"

type RawItem = {
  id?: string
  title?: string
  subtitle?: string
  description?: string
  recommendation?: string
  displayValue?: string
  savingsLabel?: string
  details?: any
  score?: number | null
  status?: "info" | "pass" | "warn" | "fail" | "na" | "manual" | string
}

type Props = { label: string; items: RawItem[] | any }

function pillColor(status?: string, score?: number | null) {
  if (status === "fail") return "#ef4444"
  if (status === "warn") return "#f59e0b"
  if (status === "pass") return "#22c55e"
  if (typeof score === "number") {
    const s = score <= 1 && score >= 0 ? Math.round(score * 100) : score
    if (s >= 90) return "#22c55e"
    if (s >= 50) return "#f59e0b"
    return "#ef4444"
  }
  return "#94a3b8"
}

export default function CategoryBreakdown({ label, items }: Props) {
  const list = useMemo(() => {
    const arr: RawItem[] = Array.isArray(items) ? items : []
    return arr.map((a, i) => {
      const title = i18nTitle(a.title ?? a.id ?? "Hallazgo") || (a.title ?? a.id ?? "")
      const subtitle = i18nTitle(a.subtitle || "") || a.subtitle || ""
      const description = i18nRich(a.description ?? a.recommendation ?? "")
      const savings =
        i18nSavings(a.savingsLabel || a.displayValue || "") ||
        a.savingsLabel || a.displayValue || ""
      return {
        key: a.id || `i-${i}`,
        title, subtitle, description, savings,
        status: a.status,
        score: typeof a.score === "number" ? a.score : null,
      }
    })
  }, [items])

  return (
    <Card className="mt-3">
      <CardContent>
        <h3 className="section-title mb-4">{label}</h3>
        <div className="diagnostico-grid" style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))" }}>
          {list.map((it) => (
            <div
              key={it.key}
              className="item"
              style={{
                position: "relative",
                borderRadius: 12,
                border: "1px solid #e5e7eb",
                padding: 16,
                background: "#fff",
                boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
              }}
            >
              <span
                style={{ position: "absolute", right: 12, top: 12, width: 10, height: 10, borderRadius: "999px", background: pillColor(it.status, it.score) }}
                title={String(it.status || "")}
                aria-label={String(it.status || "")}
              />
              <div style={{ fontWeight: 600, fontSize: 14, color: "#0f172a" }}>{it.title}</div>
              {it.subtitle ? (
                <div style={{ fontSize: 12, color: "#64748b", marginTop: 2, lineHeight: 1.2 }}>{it.subtitle}</div>
              ) : null}
              <div className="desc" style={{ fontSize: 13, color: "#334155", marginTop: 10 }}>
                {typeof it.description === "string" ? <span>{it.description}</span> : it.description}
              </div>
              {it.savings ? (
                <div style={{ fontSize: 12, color: "#0f172a", marginTop: 12, fontWeight: 600 }}>{it.savings}</div>
              ) : null}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}