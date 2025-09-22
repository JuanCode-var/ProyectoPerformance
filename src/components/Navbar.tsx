// src/components/Navbar.tsx
import React from "react";
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const onLogout = async () => {
    await logout();
    navigate('/login');
  };

  const isCliente = user?.role === 'cliente';

  return (
    <header className="fixed top-0 left-0 right-0 z-50 w-full border-b bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80">
      <div className="w-full max-w-none h-14 flex items-center px-4 sm:px-6 lg:px-8">
        <a href="/" className="inline-flex items-center">
          <img
            src="/LogoChoucair.png"
            alt="Choucair Business Centric Testing"
            className="h-8 w-auto"
          />
        </a>
        <div className="ml-auto flex items-center gap-3 text-sm">
          {user ? (
            <>
              {/* Solo mostrar Nuevo diagnóstico a roles permitidos */}
              {!isCliente && (
                <Link to="/" className="px-3 py-1 rounded bg-gray-100 hover:bg-gray-200">Nuevo diagnóstico</Link>
              )}
              <span className="hidden sm:inline">{user.name} · {user.role}</span>
              <button onClick={onLogout} className="px-3 py-1 rounded bg-gray-100 hover:bg-gray-200">Salir</button>
            </>
          ) : (
            <>
              <Link to="/login" className="px-3 py-1 rounded bg-gray-100 hover:bg-gray-200">Entrar</Link>
              <Link to="/register" className="px-3 py-1 rounded bg-blue-600 text-white hover:bg-blue-700">Registro</Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
