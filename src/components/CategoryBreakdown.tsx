// src/components/CategoryBreakdown.tsx
import React, { useMemo } from "react";

// ⚠️ Usa el mismo path que ya venías usando para tus helpers de i18n:
import {
  tTitle as i18nTitle,
  tRich as i18nRich,
  tSavings as i18nSavings,
} from "../../microPagespeed/src/lib/lh-i18n-es"; // ajusta si tu path difiere

type RawItem = {
  id?: string;
  title?: string;
  subtitle?: string;
  description?: string;
  recommendation?: string;
  displayValue?: string;
  savingsLabel?: string;
  details?: any;
  score?: number | null;
  status?: "info" | "pass" | "warn" | "fail" | "na" | "manual" | string;
};

type Props = {
  label: string;
  items: RawItem[] | any; // acepta crudo de la API
};

function pillColor(status?: string, score?: number | null) {
  // Heurística simple para la “pastilla” a la derecha
  if (status === "fail") return "#ef4444";
  if (status === "warn") return "#f59e0b";
  if (status === "pass") return "#22c55e";
  // si viene score en 0..1
  if (typeof score === "number") {
    const s = score <= 1 && score >= 0 ? Math.round(score * 100) : score;
    if (s >= 90) return "#22c55e";
    if (s >= 50) return "#f59e0b";
    return "#ef4444";
  }
  return "#94a3b8";
}

export default function CategoryBreakdown({ label, items }: Props) {
  const list = useMemo(() => {
    const arr: RawItem[] = Array.isArray(items) ? items : [];

    return arr.map((a, i) => {
      // Traducciones robustas
      const title =
        i18nTitle(a.title ?? a.id ?? "Hallazgo") || (a.title ?? a.id ?? "");
      const subtitle = i18nTitle(a.subtitle || "") || a.subtitle || "";
      const description = i18nRich(
        a.description ??
          a.recommendation ??
          "" // preserva markdown/links y aplica reemplazos
      );
      const savings =
        i18nSavings(a.savingsLabel || a.displayValue || "") ||
        a.savingsLabel ||
        a.displayValue ||
        "";

      return {
        key: a.id || `i-${i}`,
        title,
        subtitle,
        description,
        savings,
        status: a.status,
        score: typeof a.score === "number" ? a.score : null,
        raw: a,
      };
    });
  }, [items]);

  return (
    <div className="card" style={{ marginTop: 12 }}>
      <h3 className="section-title" style={{ marginBottom: 16 }}>
        {label}
      </h3>

      <div
        className="diagnostico-grid"
        style={{
          display: "grid",
          gap: 16,
          gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
        }}
      >
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
            {/* pastilla de estado */}
            <span
              style={{
                position: "absolute",
                right: 12,
                top: 12,
                width: 10,
                height: 10,
                borderRadius: "999px",
                background: pillColor(it.status, it.score),
              }}
              title={String(it.status || "")}
              aria-label={String(it.status || "")}
            />

            <div style={{ fontWeight: 600, fontSize: 14, color: "#0f172a" }}>
              {it.title}
            </div>

            {it.subtitle ? (
              <div
                style={{
                  fontSize: 12,
                  color: "#64748b",
                  marginTop: 2,
                  lineHeight: 1.2,
                }}
              >
                {it.subtitle}
              </div>
            ) : null}

            <div
              className="desc"
              style={{ fontSize: 13, color: "#334155", marginTop: 10 }}
            >
              {/* description puede traer markdown simple (links) → lo dejamos como texto plano seguro */}
              {typeof it.description === "string" ? (
                <span>{it.description}</span>
              ) : (
                it.description
              )}
            </div>

            {it.savings ? (
              <div
                style={{
                  fontSize: 12,
                  color: "#0f172a",
                  marginTop: 12,
                  fontWeight: 600,
                }}
              >
                {it.savings}
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}