// src/App.tsx
import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import Navbar from "./components/Navbar";

// Wrappers FSD
import RunAuditPage from "./pages/run-audit";
import DiagnosticsPage from "./pages/diagnostics";
import HistoryPage from "./pages/history";
import SecurityHistoryPage from "./pages/security-history";
import SettingsPage from "./pages/settings";
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

function AdminOnly({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to={`/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`} replace />;
  if (user.role !== 'admin') return <Navigate to="/" replace />; // Solo los admins pueden acceder
  return <>{children}</>;
}

function TecnicoOnly({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to={`/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`} replace />;
  if (user.role !== 'tecnico') return <Navigate to="/" replace />; // Solo los técnicos pueden acceder
  return <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      {/* Auth routes without layout */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/verify-email" element={<VerifyEmailPage />} />
      
      {/* Main app routes with layout */}
      <Route path="/*" element={
        <div className="min-h-screen w-full bg-gray-50">
          <Navbar />
          <main className="w-full">
            <div className="w-full">
              <Routes>
                <Route path="/" element={<Protected><RunAuditPage /></Protected>} />
                <Route path="/diagnostico/:id" element={<Protected><DiagnosticsPage /></Protected>} />
                <Route path="/historico" element={<Protected><HistoryPage /></Protected>} />
                <Route path="/security-history" element={<Protected><SecurityHistoryPage /></Protected>} />
                <Route path="/settings" element={<AdminOnly><SettingsPage /></AdminOnly>} />
                <Route path="/otros" element={<TecnicoOnly><div className="p-8"><h1 className="text-2xl font-bold">Sección Técnicos</h1><p>Contenido exclusivo para técnicos.</p></div></TecnicoOnly>} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </div>
          </main>
        </div>
      } />
    </Routes>
  );
}