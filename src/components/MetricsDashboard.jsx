// src/components/MetricsDashboard.jsx
import React, { useEffect, useState } from "react";
import { ArrowUp, ArrowDown, Minus, CheckSquare, Square } from "lucide-react";
import { fetchProcessedByUrl } from "../services/diagnostics.api";
import CircularGauge from "./CircularGauge"; // ya lo tienes

const colorClasses = { green: "text-green-600", amber: "text-yellow-600", red: "text-red-600", gray: "text-gray-500" };
const bgPill =      { green: "bg-green-500",   amber: "bg-yellow-500",    red: "bg-red-500",    gray: "bg-gray-400" };

const TrendIcon = ({ trend }) => trend === "up" ? <ArrowUp className="w-4 h-4" /> :
  trend === "down" ? <ArrowDown className="w-4 h-4" /> : <Minus className="w-4 h-4" />;

function MetricCard({ m }) {
  const isPerf = m.key === "performance";
  return (
    <div className="p-4 rounded-2xl border shadow-sm flex items-center justify-between">
      <div className="flex flex-col">
        <span className="text-sm text-neutral-500 uppercase">{m.key}</span>
        <div className="flex items-center gap-2 mt-1">
          <span className={`px-2.5 py-1 text-white rounded-full text-sm ${bgPill[m.color]}`}>
            {m.display ?? "—"}
          </span>
          <span className={colorClasses[m.color]}>
            <TrendIcon trend={m.trend} />
          </span>
        </div>
      </div>
      {isPerf && typeof m.raw === "number" && (
        <div className="w-24 h-24">
          <CircularGauge value={Math.round(m.raw)} max={100} />
        </div>
      )}
    </div>
  );
}

export default function MetricsDashboard({ url }) {
  const [data, setData] = useState(null);
  const [checks, setChecks] = useState({});

  useEffect(() => {
    let mounted = true;
    fetchProcessedByUrl(url).then(d => mounted && setData(d)).catch(console.error);
    return () => { mounted = false; };
  }, [url]);

  if (!data) return <div className="p-6">Cargando diagnóstico…</div>;

  const toggle = (id) => setChecks(s => ({ ...s, [id]: !s[id] }));

  const perf = data.metrics.find(m => m.key === "performance");
  const perfColor = perf?.color === "green" ? "Verde" : perf?.color === "amber" ? "Ámbar" : perf?.color === "red" ? "Rojo" : "—";

  return (
    <div className="space-y-6">
      <header>
        <h2 className="text-xl font-semibold">Diagnóstico para <span className="font-mono">{data.url}</span></h2>
        <p className="text-sm text-neutral-500">
          Actual: {data.currentDate ? new Date(data.currentDate).toLocaleString() : "—"}
          {data.previousDate && <> · Anterior: {new Date(data.previousDate).toLocaleString()}</>}
        </p>
      </header>

      <section>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {data.metrics.map((m) => <MetricCard key={m.key} m={m} />)}
        </div>
      </section>

      <section>
        <h3 className="text-lg font-semibold mb-2">⚠ Problemas detectados</h3>
        {data.opportunities.length === 0 ? (
          <p className="text-sm text-neutral-500">Sin oportunidades relevantes detectadas.</p>
        ) : (
          <ul className="space-y-2">
            {data.opportunities.map((o) => (
              <li key={o.id} className="p-3 rounded-xl border">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div>
                    <div className="font-medium">{o.title}</div>
                    <div className="text-sm text-neutral-600">Ahorro estimado: <b>{o.savingsLabel}</b></div>
                    {o.recommendation && (
                      <div className="text-sm text-neutral-700 mt-1">Sugerencia: {o.recommendation}</div>
                    )}
                  </div>
                  <button
                    onClick={() => toggle(o.id)}
                    className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border hover:bg-neutral-50"
                  >
                    {checks[o.id] ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
                    <span className="text-sm">Marcar</span>
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="p-4 rounded-2xl border">
        <div className="font-semibold mb-2">Resumen</div>
        <div className="space-y-1 text-sm">
          <div>📊 Performance: {perf?.display} ({perfColor})</div>
          {data.opportunities.length > 0 && <div>⚠ Problemas detectados:</div>}
          <ul className="list-disc ml-6">
            {data.opportunities.slice(0, 5).map((o) => (
              <li key={o.id}>{o.title} (ahorro estimado: {o.savingsLabel})</li>
            ))}
          </ul>
          {data.opportunities.length > 0 && <div className="mt-3">✅ Plan de acción sugerido:</div>}
          <ul className="ml-0">
            {data.opportunities.slice(0, 5).map((o) => (
              <li key={o.id} className="flex items-center gap-2">
                {checks[o.id] ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
                <span>{o.recommendation || o.title}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  );
}
