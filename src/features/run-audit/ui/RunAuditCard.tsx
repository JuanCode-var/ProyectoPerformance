import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '../../../shared/ui/card'
import { Input } from '../../../shared/ui/input'
import { Button } from '../../../shared/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../shared/ui/select'
import { useRunAudit } from '../model/useRunAudit'

export function RunAuditCard() {
  const [url, setUrl] = useState('')
  const [strategy, setStrategy] = useState<'mobile' | 'desktop'>('mobile')
  const { loading, error, result, submit } = useRunAudit()

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    await submit({ url, strategy })
  }

  return (
    <Card className="rounded-2xl shadow-sm">
      <CardHeader>
        <CardTitle>Ejecutar auditoría</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="grid gap-3 md:grid-cols-[1fr_auto_auto] items-end">
          <div className="grid gap-2">
            <label className="text-sm">URL del sitio</label>
            <Input placeholder="https://example.com" value={url} onChange={(e) => setUrl(e.target.value)} required />
          </div>
          <div className="grid gap-2">
            <label className="text-sm">Estrategia</label>
            <Select value={strategy} onValueChange={(v) => setStrategy(v as 'mobile' | 'desktop')}>
              <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="mobile">Mobile</SelectItem>
                <SelectItem value="desktop">Desktop</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button type="submit" disabled={loading} className="md:ml-2">
            {loading ? 'Ejecutando…' : 'Auditar'}
          </Button>
        </form>

        {error && <p className="text-sm text-red-600 mt-3">{error}</p>}

        {result && (
          <div className="mt-4 grid gap-2">
            <div className="text-sm text-muted-foreground">
              {result.url} · {result.strategy} · {new Date(result.createdAt).toLocaleString()}
            </div>
            <div className="text-2xl font-semibold">Score: {(result.score * 100).toFixed(0)}</div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
