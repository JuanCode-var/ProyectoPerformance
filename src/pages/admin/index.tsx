import React from 'react'
import { Link } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '../../shared/ui/card'
import { Button } from '../../shared/ui/button'
import { Settings, History, Shield, FileText, Users, List, Activity } from 'lucide-react'

export default function AdminDashboardPage() {
  return (
    <div className="pt-16 px-4 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Panel de administrador</h1>
        <p className="text-slate-600">Accesos rápidos a configuración, históricos y utilidades. Ejecutar diagnósticos es opcional.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Settings size={18}/> Configuraciones</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-slate-600 mb-4">Editar flags de UI, permisos y parámetros generales.</p>
            <Link to="/settings" state={{ from: '/admin' }}>
              <Button className="w-full">Abrir configuraciones</Button>
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><History size={18}/> Históricos</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-slate-600 mb-4">Ver histórico de diagnósticos (requiere seleccionar URL).</p>
            <Link to="/historico" state={{ from: '/admin' }}>
              <Button variant="outline" className="w-full">Abrir histórico</Button>
            </Link>
          </CardContent>
        </Card>

        {/* <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Shield size={18}/> Histórico seguridad</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-slate-600 mb-4">Revisar tendencias de seguridad (requiere URL).</p>
            <Link to="/security-history" state={{ from: '/admin' }}>
              <Button variant="outline" className="w-full">Abrir histórico seguridad</Button>
            </Link>
          </CardContent>
        </Card> */}

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><FileText size={18}/> Ejecutar diagnóstico</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-slate-600 mb-4">Opcional: acceder al formulario para correr diagnósticos.</p>
            <Link to="/" state={{ from: '/admin' }}>
              <Button variant="outline" className="w-full">Abrir formulario</Button>
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Users size={18}/> Usuarios</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-slate-600 mb-4">Listado y gestión de usuarios.</p>
            <Link to="/admin/users" state={{ from: '/admin' }}>
              <Button className="w-full">Abrir usuarios</Button>
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><List size={18}/> Modo Trazabilidad</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-slate-600 mb-4">Cambios de rol, eliminaciones y sus fechas.</p>
            <Link to="/admin/logs" state={{ from: '/admin' }}>
              <Button className="w-full" variant="outline">Abrir trazabilidad</Button>
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Activity size={18}/> Telemetría</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-slate-600 mb-4">Visitas y uso de vistas para QA.</p>
            <Link to="/admin/telemetry" state={{ from: '/admin' }}>
              <Button className="w-full" variant="outline">Ver telemetría</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
