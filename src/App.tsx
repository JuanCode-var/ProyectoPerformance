// src/App.tsx
import React from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import Navbar from './components/Navbar'
import Formulario from './components/Formulario'
import DiagnosticoView from './components/DiagnosticoView'
import DashboardHistorico from './components/HistoricoView'

export default function App() {
  return (
    <>
      <Navbar />
      <main className="main">
        <div className="container">
          <Routes>
            <Route path="/" element={<Formulario />} />
            <Route path="/diagnostico/:id" element={<DiagnosticoView />} />
            <Route path="/historico" element={<DashboardHistorico />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </main>
    </>
  )
}

