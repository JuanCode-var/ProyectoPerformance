import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '../../../shared/ui/card'
import { Input } from '../../../shared/ui/input'
import { Button } from '../../../shared/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../shared/ui/select'
import { Checkbox } from '../../../shared/ui/checkbox'
import { useRunAudit } from '../model/useRunAudit'
import { CheckedState } from '@radix-ui/react-checkbox'

export function RunAuditCard() {
  const [url, setUrl] = useState('')
  const [strategy, setStrategy] = useState<'mobile' | 'desktop'>('mobile')
  const [runPerformance, setRunPerformance] = useState<boolean>(true)
  const [runSecurity, setRunSecurity] = useState<boolean>(false)
  const { loading, error, result, submit } = useRunAudit()

  const handleCheckboxChange = (setter: React.Dispatch<React.SetStateAction<boolean>>) => (checked: CheckedState) => {
    setter(checked === true) // Convertir el estado "CheckedState" a booleano
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()

    const results: any[] = []

    if (runPerformance) {
      try {
        const performancePayload: { url: string; strategy: 'mobile' | 'desktop'; type: 'performance' } = { url, strategy, type: 'performance' }
        console.log('Enviando payload de rendimiento:', performancePayload)
        const performanceResult = await submit(performancePayload)
        results.push({ type: 'performance', data: performanceResult })
      } catch (error) {
        console.error('Error en la auditoría de rendimiento:', error)
      }
    }

    if (runSecurity) {
      try {
        const securityPayload: { url: string; strategy: 'mobile' | 'desktop'; type: 'security' } = { url, strategy, type: 'security' }
        console.log('Enviando payload de seguridad:', securityPayload)
        const securityResult = await submit(securityPayload)
        results.push({ type: 'security', data: securityResult })
      } catch (error) {
        console.error('Error en la auditoría de seguridad:', error)
      }
    }

    console.log('Resultados:', results)
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
          <div className="grid gap-2">
            <label className="text-sm">Opciones de auditoría</label>
            <div className="flex items-center gap-4">
              <Checkbox checked={runPerformance} onCheckedChange={handleCheckboxChange(setRunPerformance)} /> Rendimiento
              <Checkbox checked={runSecurity} onCheckedChange={handleCheckboxChange(setRunSecurity)} /> Seguridad
            </div>
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
