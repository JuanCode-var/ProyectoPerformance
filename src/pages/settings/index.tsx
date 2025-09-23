import React, { useEffect, useState, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '../../shared/ui/card'
import { Button } from '../../shared/ui/button'
import { Input } from '../../shared/ui/input'
import { Checkbox } from '../../shared/ui/checkbox'
import { Select, SelectTrigger, SelectContent, SelectItem } from '../../shared/ui/select'
import { useAuth } from '../../auth/AuthContext'
import { useNavigate, useLocation } from 'react-router-dom'
import { DEFAULT_SETTINGS, loadSettings, saveSettings, type SettingsModel } from '../../shared/settings'

export default function SettingsPage() {
  const { user } = useAuth();
  const [settings, setSettings] = useState<SettingsModel>(DEFAULT_SETTINGS)
  const [status, setStatus] = useState<string>('')
  const fileRef = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()
  const location = useLocation()

  useEffect(()=>{ setSettings(loadSettings()) }, [])

  const onChange = <K extends keyof SettingsModel>(key: K, value: SettingsModel[K]) => {
    setSettings((s)=> ({ ...s, [key]: value }))
  }

  const onUiChange = <K extends keyof SettingsModel['ui']>(key: K, value: SettingsModel['ui'][K]) => {
    setSettings((s)=> ({ ...s, ui: { ...s.ui, [key]: value } }))
  }

  const onSave = () => {
    saveSettings(settings)
    setStatus('guardado')
    setTimeout(()=>setStatus(''), 1500)
  }

  const onReset = () => {
    setSettings(DEFAULT_SETTINGS)
    saveSettings(DEFAULT_SETTINGS)
    setStatus('restablecido')
    setTimeout(()=>setStatus(''), 1500)
  }

  const quickTimeouts = [30000, 45000, 60000]

  const goBack = () => {
    const params = new URLSearchParams(location.search)
    const back = params.get('back')
    if (back) {
      navigate(back)
      return
    }
    if (window.history.length > 1) {
      navigate(-1)
    }
    // else: do nothing (permanece en Configuraciones)
  }

  return (
    <div className="pt-16 px-4 max-w-4xl mx-auto">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <div>
            <CardTitle>Configuraciones</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={goBack}>Cerrar</Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-slate-600 mb-6">
            Panel para que el admin edite configuraciones generales. Esta versión guarda en el navegador.
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Rol por defecto</label>
              <Select
                value={settings.defaultRole}
                onValueChange={(val)=> onChange('defaultRole', val as SettingsModel['defaultRole'])}
              >
                <SelectTrigger className="w-full"/>
                <SelectContent>
                  <SelectItem value="cliente">Cliente</SelectItem>
                  <SelectItem value="tecnico">Técnico</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-slate-500 mt-1">Se usa como sugerencia en el registro.</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">PSI API Key</label>
              <Input
                type="text"
                value={settings.psiApiKey || ''}
                onChange={(e)=> onChange('psiApiKey', e.target.value)}
                placeholder="AIza..."
              />
              <p className="text-xs text-slate-500 mt-1">Se usará para PageSpeed Insights cuando esté configurado.</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Timeout Seguridad (ms)</label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  value={settings.securityTimeoutMs}
                  onChange={(e)=> onChange('securityTimeoutMs', Number(e.target.value||0))}
                  min={1000}
                  step={500}
                  className="w-full"
                />
                {quickTimeouts.map((t)=> (
                  <Button key={t} variant="outline" onClick={()=> onChange('securityTimeoutMs', t)}>{t/1000}s</Button>
                ))}
              </div>
              <p className="text-xs text-slate-500 mt-1">Tiempo máximo para el microservicio de seguridad.</p>
            </div>
          </div>

          <div className="mt-8">
            <div className="text-sm font-semibold mb-2">UI y Permisos</div>
            <div className="space-y-3">
              {/* Clientes */}
              <div className="text-xs font-medium text-slate-500 mt-2">Clientes</div>
              <label className="flex items-center gap-3">
                <Checkbox
                  checked={settings.ui.showSecurityHistoryToClients}
                  onCheckedChange={(checked)=> onUiChange('showSecurityHistoryToClients', Boolean(checked))}
                />
                <span className="text-sm">Permitir que clientes vean el histórico de seguridad</span>
              </label>
              <label className="flex items-center gap-3">
                <Checkbox
                  checked={settings.ui.enableActionPlanDetailsForClients}
                  onCheckedChange={(checked)=> onUiChange('enableActionPlanDetailsForClients', Boolean(checked))}
                />
                <span className="text-sm">Mostrar detalles completos del plan de acción a clientes</span>
              </label>

              {/* Técnicos */}
              <div className="text-xs font-medium text-slate-500 mt-4">Técnicos</div>
              <label className="flex items-center gap-3">
                <Checkbox
                  checked={settings.ui.showSecurityHistoryToTechnicians}
                  onCheckedChange={(checked)=> onUiChange('showSecurityHistoryToTechnicians', Boolean(checked))}
                />
                <span className="text-sm">Permitir que técnicos vean el histórico de seguridad</span>
              </label>
              <label className="flex items-center gap-3">
                <Checkbox
                  checked={settings.ui.enableActionPlanDetailsForTechnicians}
                  onCheckedChange={(checked)=> onUiChange('enableActionPlanDetailsForTechnicians', Boolean(checked))}
                />
                <span className="text-sm">Mostrar detalles completos del plan de acción a técnicos</span>
              </label>

              <p className="text-xs text-slate-500">Estos flags permiten activar/desactivar rápidamente vistas por rol.</p>
            </div>
          </div>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Button onClick={onSave}>Guardar</Button>
            <Button variant="outline" onClick={onReset}>Restablecer</Button>
            {status === 'guardado' && <span className="text-green-600 text-sm">Cambios guardados</span>}
            {status === 'restablecido' && <span className="text-blue-600 text-sm">Valores restablecidos</span>}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
