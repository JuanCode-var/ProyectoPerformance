// src/App.tsx
import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import Navbar from "./components/Navbar";

// Wrappers FSD
import RunAuditPage from "./pages/run-audit";
import DiagnosticsPage from "./pages/diagnostics";
import HistoryPage from "./pages/history";
import SecurityHistoryPage from "./pages/security-history";
import LoginPage from "./pages/auth/Login";
import RegisterPage from "./pages/auth/Register";
import { useAuth } from './auth/AuthContext';
import ForgotPasswordPage from './pages/auth/ForgotPassword';
import ResetPasswordPage from './pages/auth/ResetPassword';
import VerifyEmailPage from './pages/auth/VerifyEmail';

function Protected({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to={`/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`} replace />;
  return <>{children}</>;
}

function NonClienteOnly({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to={`/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`} replace />;
  if (user.role === 'cliente') return <Navigate to="/historico" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <div className="min-h-screen w-full bg-gray-50">
      <Navbar />
      <main className="w-full">
        <div className="w-full">
          <Routes>
            {/* Home = página FSD con shadcn */}
            {/* Permitir a todos los roles autenticados abrir el formulario. El componente Formulario ya deshabilita acciones para 'cliente'. */}
            <Route path="/" element={<Protected><RunAuditPage /></Protected>} />
            {/* Auth */}
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />
            <Route path="/verify-email" element={<VerifyEmailPage />} />
            {/* Detalle del diagnóstico */}
            <Route path="/diagnostico/:id" element={<Protected><DiagnosticsPage /></Protected>} />
            {/* Histórico */}
            <Route path="/historico" element={<Protected><HistoryPage /></Protected>} />
            {/* Histórico de Seguridad */}
            <Route path="/security-history" element={<Protected><SecurityHistoryPage /></Protected>} />
            {/* Fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </main>
    </div>
  );
}