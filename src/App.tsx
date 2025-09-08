// src/App.tsx
import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import Navbar from "./components/Navbar";

// Wrappers FSD
import RunAuditPage from "./pages/run-audit";
import DiagnosticsPage from "./pages/diagnostics";
import HistoryPage from "./pages/history";
import SecurityHistoryPage from "./pages/security-history";

export default function App() {
  return (
    <>
      <Navbar />
      <main className="main">
        <div className="container">
          <Routes>
            {/* Home = página FSD con shadcn */}
            <Route path="/" element={<RunAuditPage />} />
            {/* Detalle del diagnóstico */}
            <Route path="/diagnostico/:id" element={<DiagnosticsPage />} />
            {/* Histórico */}
            <Route path="/historico" element={<HistoryPage />} />
            {/* Histórico de Seguridad */}
            <Route path="/security-history" element={<SecurityHistoryPage />} />
            {/* Fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </main>
    </>
  );
}