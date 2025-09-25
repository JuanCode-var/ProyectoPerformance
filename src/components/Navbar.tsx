// src/components/Navbar.tsx
import React, { useCallback } from "react";
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { LayoutDashboard, Shield, LogOut, User, Play } from 'lucide-react';

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Detect if we are on the Formulario route (home with ?form=true)
  const isOnForm = (() => {
    try {
      if (location.pathname !== '/') return false;
      const params = new URLSearchParams(location.search || '');
      return params.get('form') === 'true';
    } catch {
      return false;
    }
  })();

  // onLogout memorizado y protegido contra propagación/submit accidental
  const onLogout = useCallback(async (e?: React.MouseEvent<HTMLButtonElement>) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }

    console.log('[Navbar] onLogout invoked');
    const confirmed = window.confirm('¿Seguro que quieres salir?');
    if (!confirmed) {
      console.log('[Navbar] logout cancelled by user');
      return;
    }

    try {
      // FORZAMOS el logout porque viene del usuario
      await logout({ force: true } as any);
      // blur para evitar Enter/focus residuals que puedan activar otros controles
      try { (document.activeElement as HTMLElement | null)?.blur(); } catch (err) { /* noop */ }
      navigate('/login', { replace: true });
    } catch (err) {
      console.error('[Navbar] logout error', err);
    }
  }, [logout, navigate]);

  const role = user?.role;
  const isCliente = role === 'cliente';
  const isAdmin = role === 'admin';
  const isTecnico = role === 'tecnico' || role === 'otro_tecnico';

  return (
    <header className="fixed top-0 left-0 right-0 z-50 w-full border-b bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80">
      <div className="w-full max-w-none h-16 flex items-center px-4 sm:px-6 lg:px-8">
        {/* Make brand link role-aware: admins -> /admin, others -> / */}
        <Link to={isAdmin ? '/admin' : '/'} className="inline-flex items-center">
          <img
            src="/LogoChoucair.png"
            alt="Choucair Business Centric Testing"
            className="h-8 w-auto"
          />
        </Link>

        <div className="ml-auto flex items-center gap-4 text-sm">
          {user ? (
            <>
              {/* Volver al Dashboard: visible solo en el formulario */}
              {isOnForm && (
                <Link
                  to="/"
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-green-700 to-black text-white hover:from-green-800 hover:to-black transition-all duration-200 transform hover:scale-105 shadow-md hover:shadow-lg"
                >
                  ← Volver al Dashboard
                </Link>
              )}

              {/* Admin: mostrar Panel de control */}
              {isAdmin && (
                <Link 
                  to="/admin" 
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-gray-800 to-black text-white hover:from-black hover:to-gray-700 transition-all duration-200 transform hover:scale-105 shadow-md hover:shadow-lg"
                >
                  <LayoutDashboard size={16} />
                  <span className="hidden sm:inline">Panel de control</span>
                </Link>
              )}

              {/* Información del usuario */}
              <div className="hidden sm:flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-100 text-gray-700">
                <User size={16} />
                <span className="font-medium">{user.name}</span>
                <span className="text-xs px-2 py-1 bg-gray-200 rounded-full">{user.role}</span>
              </div>
              
              {/* Botón de salir */}
              <button
                type="button"
                onClick={onLogout}
                aria-label="Cerrar sesión"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-red-600 to-red-700 text-white hover:from-red-700 hover:to-red-800 transition-all duration-200 transform hover:scale-105 shadow-md hover:shadow-lg"
              >
                <LogOut size={16} />
                <span className="hidden sm:inline">Salir</span>
              </button>
            </>
          ) : (
            <>
              <Link 
                to="/login" 
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-gray-600 to-gray-700 text-white hover:from-gray-700 hover:to-gray-800 transition-all duration-200 transform hover:scale-105 shadow-md hover:shadow-lg"
              >
                <User size={16} />
                <span>Entrar</span>
              </Link>
              <Link 
                to="/register" 
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-blue-600 to-blue-700 text-white hover:from-blue-700 hover:to-blue-800 transition-all duration-200 transform hover:scale-105 shadow-md hover:shadow-lg"
              >
                <User size={16} />
                <span>Registro</span>
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
