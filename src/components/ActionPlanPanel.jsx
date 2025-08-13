import React, { useMemo, useState } from "react";
import {
  AlertTriangle, AlertCircle, Info, CheckCircle2,
  ChevronDown, ChevronUp, Filter, ListChecks, SortDesc,
  CheckSquare, Square, Eye, EyeOff
} from "lucide-react";
import "../styles/ActionPlanPanel.css";

export default function ActionPlanPanel({ opportunities = [], performance = null }) {
  const [done, setDone] = useState({});
  const [filter, setFilter] = useState("all");         // all | pending | done
  const [sort, setSort] = useState("impact_desc");     // impact_desc | impact_asc
  const [open, setOpen] = useState({});                // acordeón por item
  const [errOpen, setErrOpen] = useState(true);        // sección "Errores detectados"
  const [impOpen, setImpOpen] = useState(true);        // sección "Mejoras"

  const toggleDone  = (k) => setDone((s) => ({ ...s, [k]: !s[k] }));
  const toggleOpen  = (k) => setOpen((s) => ({ ...s, [k]: !s[k] }));

  // --- Severidad / impacto ---
  const parseSeverity = (o) => {
    const label = o.savingsLabel || "";
    let bar = 0;
    if (label.endsWith("s")) {
      const secs = parseFloat(label) || 0;
      bar = Math.min(100, Math.round((secs / 6) * 100));
      if (secs >= 3) return { lvl: "high", Icon: AlertTriangle, bar };
      if (secs >= 1) return { lvl: "mid",  Icon: AlertCircle,   bar };
      return { lvl: "low", Icon: Info, bar };
    }
    if (/(KB|MB|B)$/.test(label)) {
      const n = parseFloat(label) || 0;
      const kb = label.endsWith("MB") ? n * 1024 : label.endsWith("KB") ? n : label.endsWith("B") ? n / 1024 : 0;
      bar = Math.min(100, Math.round((kb / 300) * 100));
      if (kb >= 300) return { lvl: "high", Icon: AlertTriangle, bar };
      if (kb >= 100) return { lvl: "mid",  Icon: AlertCircle,   bar };
      return { lvl: "low", Icon: Info, bar };
    }
    const impact = o.impactScore || 0;
    bar = Math.min(100, Math.round((impact / 3000) * 100));
    if (impact >= 2000) return { lvl: "high", Icon: AlertTriangle, bar };
    if (impact >= 800)  return { lvl: "mid",  Icon: AlertCircle,   bar };
    return { lvl: "low", Icon: Info, bar };
  };

  // dataset con key único + severidad precalculada
  const base = useMemo(() => {
    return opportunities.map((o, i) => {
      const sev = parseSeverity(o);
      return { ...o, _k: `${o.id}-${i}`, sev };
    });
  }, [opportunities]);

  // filtros y orden
  const data = useMemo(() => {
    let arr = [...base];
    if (filter === "pending") arr = arr.filter((o) => !done[o._k]);
    if (filter === "done")    arr = arr.filter((o) => done[o._k]);
    if (sort === "impact_desc") arr.sort((a, b) => (b.impactScore || 0) - (a.impactScore || 0));
    if (sort === "impact_asc")  arr.sort((a, b) => (a.impactScore || 0) - (b.impactScore || 0));
    return arr;
  }, [base, filter, sort, done]);

  // división en secciones: Errores (Crítico) vs. Mejoras (Medio/Bajo)
  const errors = data.filter((o) => o.sev.lvl === "high");
  const improvements = data.filter((o) => o.sev.lvl !== "high");

  const pendingMarkdown = () => {
    const lines = data
      .filter((o) => !done[o._k])
      .map((o) => `- [ ] ${o.recommendation || o.title}${o.savingsLabel ? ` (ahorro: ${o.savingsLabel})` : ""}`);
    return `## Plan de acción\n\n${lines.join("\n")}\n`;
  };

  const copyChecklist = async () => {
    try { await navigator.clipboard.writeText(pendingMarkdown()); alert("✅ Checklist copiado"); }
    catch { alert("No se pudo copiar. Copia manualmente."); }
  };

  const Card = ({ o }) => {
    const { lvl, Icon, bar } = o.sev;
    const isOpenItem = !!open[o._k];
    const isDone = !!done[o._k];

    const leftClass = `ap-leftbar ${lvl}`;
    const badgeClass =
      lvl === "high" ? "ap-badge high" : lvl === "mid" ? "ap-badge mid" : "ap-badge low";
    const barClass = `ap-impact-bar ${lvl}`;

    return (
      <li className="ap-card">
        <div className="ap-card-row">
          <div className={leftClass} />
          <div className="ap-card-body">
            {/* header */}
            <div style={{display:"flex", gap:12, alignItems:"flex-start", justifyContent:"space-between"}}>
              <div style={{minWidth:0}}>
                <div className="ap-badges">
                  <span className={badgeClass}><Icon size={14}/> {lvl==="high"?"Crítico":lvl==="mid"?"Medio":"Bajo"}</span>
                  {o.savingsLabel && <span className="ap-badge muted">Ahorro: {o.savingsLabel}</span>}
                </div>
                <div className="ap-title2">{o.title}</div>
              </div>
              <div className="ap-actions">
                {/* <button className={`ap-btn ${isDone ? "on":""}`} onClick={()=>toggleDone(o._k)}>
                  {isDone ? <CheckSquare size={16}/> : <Square size={16}/>}
                  {isDone ? "Marcado":"Marcar"}
                </button> */}
                <button className="ap-btn" onClick={()=>toggleOpen(o._k)} aria-expanded={isOpenItem}>
                  {isOpenItem ? <ChevronUp size={16}/> : <ChevronDown size={16}/>} Detalles
                </button>
              </div>
            </div>

            {/* barra */}
            <div className="ap-impact-wrap">
              <div className={barClass} style={{ width: `${Math.max(8, bar)}%` }} />
            </div>

            {/* detalle */}
            {isOpenItem && (
              <div className="ap-detail">
                {o.recommendation
                  ? <p>{o.recommendation}</p>
                  : <p className="ap-subtle">Sin recomendación específica. Prioriza este ítem por su impacto.</p>}
              </div>
            )}
          </div>
        </div>
      </li>
    );
  };

  // Mostrar/ocultar todo
  const showAll = () => { setErrOpen(true); setImpOpen(true); };
  const hideAll = () => { setErrOpen(false); setImpOpen(false); };

  return (
    <section className="ap-panel">
      {/* Header */}
      <div className="ap-header">
        <div>
          <div className="ap-title">⚠ Problemas detectados</div>
          {typeof performance === "number" && (
            <div className="ap-subtle">Contexto: Performance {performance}% — prioriza acciones de alto impacto.</div>
          )}
        </div>
        <div style={{display:"flex", gap:8}}>
          <button className="ap-btn" onClick={showAll} title="Mostrar todo"><Eye size={16}/> Mostrar</button>
          <button className="ap-btn" onClick={hideAll} title="Ocultar todo"><EyeOff size={16}/> Ocultar</button>
          <button className="ap-btn" onClick={copyChecklist} title="Copiar checklist (pendientes)">
            <ListChecks size={16}/> Copiar checklist
          </button>
        </div>
      </div>

      {/* Controles */}
      <div className="ap-controls">
        {/* <div className="ap-ctl">
          <Filter size={16}/> Filtro:
          <select value={filter} onChange={(e)=>setFilter(e.target.value)}>
            <option value="all">Todos</option>
            <option value="pending">Pendientes</option>
            <option value="done">Marcados</option>
          </select>
        </div> */}
        <div className="ap-ctl">
          <SortDesc size={16}/> Orden:
          <select value={sort} onChange={(e)=>setSort(e.target.value)}>
            <option value="impact_desc">Impacto (alto→bajo)</option>
            <option value="impact_asc">Impacto (bajo→alto)</option>
          </select>
        </div>
      </div>

      {/* ====== Sección: Errores detectados ====== */}
      <div className="ap-acc err">
        <div className="ap-acc-header" onClick={()=>setErrOpen(v=>!v)}>
          <div className="ap-acc-title">
            <AlertTriangle size={18} color="#b91c1c" />
            Errores detectados
            <span className="ap-chip">{errors.length}</span>
          </div>
          {errOpen ? <ChevronUp size={18}/> : <ChevronDown size={18}/>}
        </div>
        {errOpen && (
          <div className="ap-acc-body">
            {errors.length === 0 ? (
              <div className="ap-muted">No hay errores críticos.</div>
            ) : (
              <ul className="ap-list">{errors.map((o)=><Card key={o._k} o={o}/>)}</ul>
            )}
          </div>
        )}
      </div>

      {/* ====== Sección: Mejoras ====== */}
      <div className="ap-acc imp">
        <div className="ap-acc-header" onClick={()=>setImpOpen(v=>!v)}>
          <div className="ap-acc-title">
            <AlertCircle size={18} color="#92400e" />
            Mejoras
            <span className="ap-chip">{improvements.length}</span>
          </div>
          {impOpen ? <ChevronUp size={18}/> : <ChevronDown size={18}/>}
        </div>
        {impOpen && (
          <div className="ap-acc-body">
            {improvements.length === 0 ? (
              <div className="ap-muted">Sin mejoras pendientes.</div>
            ) : (
              <ul className="ap-list">{improvements.map((o)=><Card key={o._k} o={o}/>)}</ul>
            )}
          </div>
        )}
      </div>

      {/* Resumen final */}
      <div className="ap-summary">
        <div className="ap-summary-title"><CheckCircle2 size={18} color="#059669" /> Plan de acción sugerido</div>
        <ul className="ap-summary-list">
          {[...errors, ...improvements].slice(0,5).map((o)=>(
            <li key={`sum-${o._k}`} style={{display:'flex', gap:8}}>
              <span className="ap-dot" />
              <span>
                {o.recommendation || o.title}
                {o.savingsLabel ? <span className="ap-muted"> (ahorro: {o.savingsLabel})</span> : null}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}