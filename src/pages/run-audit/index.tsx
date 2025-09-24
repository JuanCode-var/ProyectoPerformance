import React, { useState } from "react"
import { useSearchParams } from 'react-router-dom'
import Formulario from "../../components/Formulario"
import Dashboard from "../../components/Dashboard"

/**
 * Página FSD: Ejecutar diagnóstico (usa el componente Formulario limpio).
 * Ahora incluye un dashboard de bienvenida personalizado por rol.
 */
export default function RunAuditPage() {
  const [searchParams] = useSearchParams();
  const showForm = searchParams.get('form') === 'true';
  
  // Si hay parámetro form=true en la URL, mostrar directamente el formulario
  if (showForm) {
    return <Formulario />
  }
  
  // Por defecto, mostrar el dashboard
  return <Dashboard />
}
