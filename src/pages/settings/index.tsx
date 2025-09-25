import React, { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '../../shared/ui/card'
import { Button } from '../../shared/ui/button'
import { Checkbox } from '../../shared/ui/checkbox'
import { useAuth } from '../../auth/AuthContext'
import { useNavigate, useLocation } from 'react-router-dom'
import { DEFAULT_SETTINGS, loadSettings, saveSettings, type SettingsModel } from '../../shared/settings'

export default function SettingsPage() {
  const { user } = useAuth();
  const [settings, setSettings] = useState<SettingsModel>(DEFAULT_SETTINGS)
  const [status, setStatus] = useState<string>('')
  const navigate = useNavigate()
  const location = useLocation()

  useEffect(()=>{ setSettings(loadSettings()) }, [])

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

          {/* UI y Permisos */}
          <div className="mt-2">
            <div className="text-sm font-semibold mb-2">UI y Permisos</div>
            <div className="space-y-6">
              {/* Clientes */}
              <div>
                <div className="text-xs font-medium text-slate-500 mb-2">Clientes</div>
                <div className="space-y-3">
                  <label className="flex items-center gap-3">
                    <Checkbox
                      checked={settings.ui.showSecurityHistoryToClients}
                      onCheckedChange={(checked)=> onUiChange('showSecurityHistoryToClients', Boolean(checked))}
                    />
                    <span className="text-sm">Permitir que clientes vean el histórico (seguridad y performance)</span>
                  </label>
                  <label className="flex items-center gap-3">
                    <Checkbox
                      checked={settings.ui.showRisksAndImprovementsToClients}
                      onCheckedChange={(checked)=> onUiChange('showRisksAndImprovementsToClients', Boolean(checked))}
                    />
                    <span className="text-sm">Permitir que clientes vean riesgos y mejoras</span>
                  </label>
                  <label className="flex items-center gap-3">
                    <Checkbox
                      checked={settings.ui.enableActionPlanDetailsForClients}
                      onCheckedChange={(checked)=> onUiChange('enableActionPlanDetailsForClients', Boolean(checked))}
                    />
                    <span className="text-sm">Mostrar detalles completos del plan de acción a clientes</span>
                  </label>
                  <label className="flex items-center gap-3">
                    <Checkbox
                      checked={settings.ui.allowRunDiagnosticsByClients}
                      onCheckedChange={(checked)=> onUiChange('allowRunDiagnosticsByClients', Boolean(checked))}
                    />
                    <span className="text-sm">Permitir que clientes ejecuten diagnósticos</span>
                  </label>
                </div>
              </div>

              {/* Técnicos */}
              <div>
                <div className="text-xs font-medium text-slate-500 mb-2">Técnicos</div>
                <div className="space-y-3">
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
                  <label className="flex items-center gap-3">
                    <Checkbox
                      checked={settings.ui.allowRunDiagnosticsByTechnicians}
                      onCheckedChange={(checked)=> onUiChange('allowRunDiagnosticsByTechnicians', Boolean(checked))}
                    />
                    <span className="text-sm">Permitir que técnicos ejecuten diagnósticos</span>
                  </label>
                </div>
              </div>

              {/* Operarios */}
              <div>
                <div className="text-xs font-medium text-slate-500 mb-2">Operarios</div>
                <div className="space-y-3">
                  <label className="flex items-center gap-3">
                    <Checkbox
                      checked={settings.ui.showSecurityHistoryToOperators}
                      onCheckedChange={(checked)=> onUiChange('showSecurityHistoryToOperators', Boolean(checked))}
                    />
                    <span className="text-sm">Permitir que operarios vean el histórico de seguridad</span>
                  </label>
                  <label className="flex items-center gap-3">
                    <Checkbox
                      checked={settings.ui.enableActionPlanDetailsForOperators}
                      onCheckedChange={(checked)=> onUiChange('enableActionPlanDetailsForOperators', Boolean(checked))}
                    />
                    <span className="text-sm">Mostrar detalles completos del plan de acción a operarios</span>
                  </label>
                  <label className="flex items-center gap-3">
                    <Checkbox
                      checked={settings.ui.allowRunDiagnosticsByOperators}
                      onCheckedChange={(checked)=> onUiChange('allowRunDiagnosticsByOperators', Boolean(checked))}
                    />
                    <span className="text-sm">Permitir que operarios ejecuten diagnósticos</span>
                  </label>
                </div>
              </div>

              <p className="text-xs text-slate-500">El rol Admin siempre tiene acceso a todo.</p>
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
