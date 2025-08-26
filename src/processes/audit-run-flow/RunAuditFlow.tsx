import { RunAuditCard } from '../../features/run-audit/ui/RunAuditCard'
import { useAppStore } from '../../entities/audit/model/store'

export default function RunAuditFlow() {
  const last = useAppStore((s) => s.lastResults[0])
  return (
    <div className="grid gap-4">
      <RunAuditCard />
      {last && (
        <div className="text-sm text-muted-foreground">
          Último: {last.url} · {(last.score * 100).toFixed(0)}
        </div>
      )}
    </div>
  )
}
