// src/components/Navbar.tsx
import React from "react";
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { Settings, FileText, Shield, LogOut, User } from 'lucide-react';

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const onLogout = async () => {
    await logout();
    navigate('/login');
  };

  const role = user?.role;
  const isCliente = role === 'cliente';
  const isAdmin = role === 'admin';
  const isTecnico = role === 'tecnico';

  return (
    <header className="fixed top-0 left-0 right-0 z-50 w-full border-b bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80">
      <div className="w-full max-w-none h-16 flex items-center px-4 sm:px-6 lg:px-8">
        <a href="/" className="inline-flex items-center">
          <img
            src="/LogoChoucair.png"
            alt="Choucair Business Centric Testing"
            className="h-8 w-auto"
          />
        </a>
        <div className="ml-auto flex items-center gap-4 text-sm">
          {user ? (
            <>
              {/* Admin: mostrar Configuraciones */}
              {isAdmin && (
                <Link 
                  to="/settings" 
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-gray-800 to-black text-white hover:from-black hover:to-gray-700 transition-all duration-200 transform hover:scale-105 shadow-md hover:shadow-lg"
                >
                  <Settings size={16} />
                  <span className="hidden sm:inline">Configuraciones</span>
                </Link>
              )}

              {/* Técnico: mostrar Nuevo diagnóstico y (Otros) */}
              {isTecnico && (
                <>
                  <Link 
                    to="/" 
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-blue-600 to-blue-700 text-white hover:from-blue-700 hover:to-blue-800 transition-all duration-200 transform hover:scale-105 shadow-md hover:shadow-lg"
                  >
                    <FileText size={16} />
                    <span className="hidden sm:inline">Nuevo diagnóstico</span>
                  </Link>
                  <Link 
                    to="/otros" 
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-purple-600 to-purple-700 text-white hover:from-purple-700 hover:to-purple-800 transition-all duration-200 transform hover:scale-105 shadow-md hover:shadow-lg"
                  >
                    <Shield size={16} />
                    <span className="hidden sm:inline">(Otros)</span>
                  </Link>
                </>
              )}

              {/* Información del usuario */}
              <div className="hidden sm:flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-100 text-gray-700">
                <User size={16} />
                <span className="font-medium">{user.name}</span>
                <span className="text-xs px-2 py-1 bg-gray-200 rounded-full">{user.role}</span>
              </div>
              
              {/* Botón de salir */}
              <button 
                onClick={onLogout} 
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
