import React, { useMemo, useState } from "react"
import {
  AlertTriangle, AlertCircle, Info, CheckCircle2,
  ChevronDown, ChevronUp, ListChecks, SortDesc, Eye, EyeOff
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "../shared/ui/card"
import { Button } from "../shared/ui/button"
import { useAuth } from "../auth/AuthContext"

/* ==== Tipos ==== */
type SeverityLevel = "high" | "mid" | "low"
type IconComp = React.ComponentType<{ size?: number; color?: string }>

type PlanItem = {
  id: string
  title: string
  recommendation?: string
  savingsLabel?: string
  type: "error" | "improvement"
  severity?: "critical" | "info"
  impactScore?: number
}
type ExtendedPlanItem = PlanItem & { _k: string; sev: { lvl: SeverityLevel; Icon: IconComp; bar: number } }
type FilterKind = "all" | "pending" | "done"
type SortKind = "impact_desc" | "impact_asc"

type Props = { opportunities?: PlanItem[]; performance?: number | null; summaryOnly?: boolean }

export default function ActionPlanPanel({ opportunities = [], performance = null }: Props) {
  const { user, loading } = useAuth();
  const [done, setDone] = useState<Record<string, boolean>>({})
  const [filter, setFilter] = useState<FilterKind>("all")
  const [sort, setSort] = useState<SortKind>("impact_desc")
  const [open, setOpen] = useState<Record<string, boolean>>({})
  const [errOpen, setErrOpen] = useState<boolean>(true)
  const [impOpen, setImpOpen] = useState<boolean>(true)

  const hasFullPermission = (user?.permissions || []).includes('performance.view_action_plan');

  const toggleOpen  = (k: string) => setOpen((s) => ({ ...s, [k]: !s[k] }))

  const parseSeverity = (o: PlanItem): { lvl: SeverityLevel; Icon: IconComp; bar: number } => {
    const label = o.savingsLabel || ""
    let bar = 0
    if (label.endsWith("s")) {
      const secs = parseFloat(label) || 0
      bar = Math.min(100, Math.round((secs / 6) * 100))
      if (secs >= 3) return { lvl: "high", Icon: AlertTriangle, bar }
      if (secs >= 1) return { lvl: "mid",  Icon: AlertCircle,   bar }
      return { lvl: "low", Icon: Info, bar }
    }
    if (/(KB|MB|B)$/.test(label)) {
      const n = parseFloat(label) || 0
      const kb = label.endsWith("MB") ? n * 1024 : label.endsWith("KB") ? n : label.endsWith("B") ? n / 1024 : 0
      bar = Math.min(100, Math.round((kb / 300) * 100))
      if (kb >= 300) return { lvl: "high", Icon: AlertTriangle, bar }
      if (kb >= 100) return { lvl: "mid",  Icon: AlertCircle,   bar }
      return { lvl: "low", Icon: Info, bar }
    }
    const impact = o.impactScore || 0
    bar = Math.min(100, Math.round((impact / 3000) * 100))
    if (impact >= 2000) return { lvl: "high", Icon: AlertTriangle, bar }
    if (impact >= 800)  return { lvl: "mid",  Icon: AlertCircle,   bar }
    return { lvl: "low", Icon: Info, bar }
  }

  const base: ExtendedPlanItem[] = useMemo(
    () => opportunities.map((o, i) => ({ ...o, _k: `${o.id}-${i}`, sev: parseSeverity(o) })),
    [opportunities]
  )

  const data: ExtendedPlanItem[] = useMemo(() => {
    let arr = [...base]
    if (filter === "pending") arr = arr.filter((o) => !done[o._k])
    if (filter === "done")    arr = arr.filter((o) => done[o._k])
    if (sort === "impact_desc") arr.sort((a, b) => (b.impactScore || 0) - (a.impactScore || 0))
    if (sort === "impact_asc")  arr.sort((a, b) => (a.impactScore || 0) - (b.impactScore || 0))
    return arr
  }, [base, filter, sort, done])

  const errors = data.filter((o) => o.sev.lvl === "high")
  const improvements = data.filter((o) => o.sev.lvl !== "high")

  if (loading) {
    return (
      <Card className="ap-panel">
        <CardHeader>
          <CardTitle>⚠ Problemas detectados</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8 text-slate-600">Verificando permisos…</div>
        </CardContent>
      </Card>
    )
  }

  // Hide completely only if lacking permission (role no longer blocks if permission present)
  if (!hasFullPermission) {
    return null;
  }

  const pendingMarkdown = (): string => {
    const lines = data
      .filter((o) => !done[o._k])
      .map((o) => `- [ ] ${o.recommendation || o.title}${o.savingsLabel ? ` (ahorro: ${o.savingsLabel})` : ""}`)
    return `## Plan de acción\n\n${lines.join("\n")}\n`
  }

  const copyChecklist = async () => {
    try { await navigator.clipboard.writeText(pendingMarkdown()); alert("✅ Checklist copiado") }
    catch { alert("No se pudo copiar. Copia manualmente.") }
  }

  const CardItem: React.FC<{ o: ExtendedPlanItem }> = ({ o }) => {
    const { lvl, Icon, bar } = o.sev
    const isOpenItem = !!open[o._k]
    const leftClass = `ap-leftbar ${lvl}`
    const badgeClass = lvl === "high" ? "ap-badge high" : lvl === "mid" ? "ap-badge mid" : "ap-badge low"
    const barClass = `ap-impact-bar ${lvl}`

    return (
      <li className="ap-card">
        <div className="ap-card-row">
          <div className={leftClass} />
          <div className="ap-card-body">
            <div style={{display:"flex", gap:12, alignItems:"flex-start", justifyContent:"space-between"}}>
              <div style={{minWidth:0}}>
                <div className="ap-badges">
                  <span className={badgeClass}><Icon size={14}/> {lvl==="high"?"Crítico":lvl==="mid"?"Medio":"Bajo"}</span>
                  {o.savingsLabel && <span className="ap-badge muted">Ahorro: {o.savingsLabel}</span>}
                </div>
                <div className="ap-title2">{o.title}</div>
              </div>
              <div className="ap-actions">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="ap-btn"
                  onMouseDown={(e)=>{ e.preventDefault() }}
                  onClickCapture={(e)=>{ e.preventDefault(); e.stopPropagation(); toggleOpen(o._k) }}
                  aria-expanded={isOpenItem}
                >
                  {isOpenItem ? <ChevronUp size={16}/> : <ChevronDown size={16}/>} Detalles
                </Button>
              </div>
            </div>

            <div className="ap-impact-wrap">
              <div className={barClass} style={{ width: `${Math.max(8, bar)}%` }} />
            </div>

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
    )
  }

  const showAll = () => { setErrOpen(true); setImpOpen(true) }
  const hideAll = () => { setErrOpen(false); setImpOpen(false) }

  return (
    <Card className="ap-panel">
      <CardHeader>
        <CardTitle>⚠ Problemas detectados</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="ap-header">
          <div>
            <div className="ap-title">⚠ Problemas detectados</div>
            {typeof performance === "number" && (
              <div className="ap-subtle">Contexto: Performance {performance}% — prioriza acciones de alto impacto.</div>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="ap-btn" onClick={showAll} title="Mostrar todo"><Eye size={16}/> Mostrar</Button>
            <Button variant="outline" size="sm" className="ap-btn" onClick={hideAll} title="Ocultar todo"><EyeOff size={16}/> Ocultar</Button>
            <Button variant="outline" size="sm" className="ap-btn" onClick={copyChecklist} title="Copiar checklist (pendientes)">
              <ListChecks size={16}/> Copiar checklist
            </Button>
          </div>
        </div>

        <div className="ap-controls">
          <div className="ap-ctl">
            <SortDesc size={16}/> Orden:
            <select value={sort} onChange={(e)=>setSort(e.target.value as SortKind)}>
              <option value="impact_desc">Impacto (alto→bajo)</option>
              <option value="impact_asc">Impacto (bajo→alto)</option>
            </select>
          </div>
        </div>

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
                <ul className="ap-list">{errors.map((o)=><CardItem key={o._k} o={o}/>)}</ul>
              )}
            </div>
          )}
        </div>

        <div className="ap-acc imp">
          <div
            className="ap-acc-header"
            onMouseDown={(e)=>e.preventDefault()}
            onClick={(e)=>{ e.preventDefault(); e.stopPropagation(); setImpOpen(v=>!v) }}
          >
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
                <ul className="ap-list">{improvements.map((o)=><CardItem key={o._k} o={o}/>)}</ul>
              )}
            </div>
          )}
        </div>

        <div className="ap-summary">
          <div className="ap-summary-title"><CheckCircle2 size={18} color="#059669" /> Plan de acción sugerido</div>
          <ul className="ap-summary-list">
            {[...errors, ...improvements].slice(0,5).map((o)=>(
              <li key={`sum-${o._k}`} className="flex gap-2">
                <span className="ap-dot" />
                <span>
                  {o.recommendation || o.title}
                  {o.savingsLabel ? <span className="ap-muted"> (ahorro: {o.savingsLabel})</span> : null}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </CardContent>
    </Card>
  )
}