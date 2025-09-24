// src/pages/auth/Register.tsx
import React, { useMemo, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Button } from '../../shared/ui/button';
import { Input } from '../../shared/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '../../shared/ui/card';
import { useAuth } from '../../auth/AuthContext';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../shared/ui/select';
import { Eye, EyeOff, Mail, Lock, User, Briefcase, UserPlus, CheckCircle, XCircle, Shield, Settings, Crown } from 'lucide-react';

export default function RegisterPage() {
  const { register, user } = useAuth();
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [title, setTitle] = useState('');
  const [role, setRole] = useState<'admin' | 'operario' | 'tecnico' | 'otro_tecnico' | 'cliente'>('cliente');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [focusedField, setFocusedField] = useState<string | null>(null);

  const [showWelcome, setShowWelcome] = useState(false);
  const [welcomeName, setWelcomeName] = useState('');

  // Validation states
  const nameValid = name.trim().length >= 2;
  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const passwordValid = password.length >= 6;
  const formValid = nameValid && emailValid && passwordValid;

  const isPrivileged = user && user.role !== 'cliente';

  // Enhanced roles data with better icons and descriptions
  const rolesData: Array<{ value: typeof role; label: string; desc: string; icon: React.ReactNode; color: string }> = [
    {
      value: 'cliente',
      label: 'Cliente',
      desc: 'Consulta diagnósticos y resultados',
      color: 'text-blue-600',
      icon: <User className="w-5 h-5" />,
    },
    {
      value: 'operario',
      label: 'Operario',
      desc: 'Ejecución de pruebas y operación diaria',
      color: 'text-green-600',
      icon: <Briefcase className="w-5 h-5" />,
    },
    {
      value: 'tecnico',
      label: 'Técnico',
      desc: 'Análisis técnico y configuración',
      color: 'text-purple-600',
      icon: <Settings className="w-5 h-5" />,
    },
    {
      value: 'otro_tecnico',
      label: 'Técnico Especializado',
      desc: 'Análisis técnico especializado',
      color: 'text-indigo-600',
      icon: <Settings className="w-5 h-5" />,
    },
    {
      value: 'admin',
      label: 'Admin',
      desc: 'Administración y control total',
      color: 'text-red-600',
      icon: <Crown className="w-5 h-5" />,
    },
  ];

  const selectedRole = rolesData.find(r => r.value === role);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const newUser = await register(name, email, password, role, title || undefined);
      setWelcomeName(newUser?.name || name);
      setShowWelcome(true);
      // Redirigir tras animación de bienvenida
      setTimeout(() => navigate('/', { replace: true }), 2200);
    } catch (e: any) {
      setError(e?.message || 'Error al crear la cuenta');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-0 m-0">
      {/* Logo superior eliminado para evitar duplicado; el logo queda solo dentro del Card */}
      {/* Elementos de fondo animados */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <motion.div
          animate={{ 
            x: [0, -40, 0],
            y: [0, 60, 0],
            rotate: [0, 135, 270]
          }}
          transition={{ duration: 28, repeat: Infinity, ease: "linear" }}
          className="absolute top-1/3 right-1/3 w-20 h-20 bg-gray-100 rounded-full opacity-20"
        />
        <motion.div
          animate={{ 
            x: [0, 30, 0],
            y: [0, -40, 0],
            rotate: [0, -135, -270]
          }}
          transition={{ duration: 32, repeat: Infinity, ease: "linear" }}
          className="absolute bottom-1/3 left-1/3 w-16 h-16 bg-gray-200 rounded-full opacity-20"
        />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="w-full max-w-2xl relative z-10 px-4"
      >
        <Card className="backdrop-blur-lg bg-white/95 border border-gray-300 shadow-2xl rounded-2xl overflow-hidden">
          <CardHeader className="text-center pb-6 pt-8 bg-gradient-to-r from-gray-900 to-black text-white rounded-t-2xl">
            <div className="mx-auto mb-4 flex flex-col items-center gap-2">
              <img src="/LogoChoucair.png" alt="Choucair" className="h-14 w-auto" />
              <span className="text-[10px] tracking-[0.25em] text-gray-300 font-medium">BUSINESS CENTRIC TESTING</span>
            </div>
            <CardTitle className="text-3xl font-bold mb-3">Crear nueva cuenta</CardTitle>
            <p className="text-gray-200 text-base">Únete a nuestra plataforma</p>
          </CardHeader>
          <CardContent className="p-10">
            {/* Icon moved to content area, centered */}
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
              className="mx-auto w-24 h-24 bg-gray-900/10 rounded-full flex items-center justify-center mb-10"
            >
              <UserPlus className="w-12 h-12 text-gray-900" />
            </motion.div>
            <form onSubmit={onSubmit} className="space-y-8">
              {/* Campo de nombre */}
              <motion.div
                initial={{ x: -20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: 0.3 }}
              >
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nombre completo
                </label>
                <div className="relative">
                  <User className={`absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 transition-colors ${
                    focusedField === 'name' ? 'text-slate-600' : 'text-gray-400'
                  }`} />
                  <Input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    onFocus={() => setFocusedField('name')}
                    onBlur={() => setFocusedField(null)}
                    className="pl-10 pr-10 h-12 border-2 rounded-xl transition-all duration-200 focus:border-slate-500 focus:ring-slate-500"
                    placeholder="Tu nombre completo"
                    required
                  />
                  {name && (
                    <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                      {nameValid ? (
                        <CheckCircle className="w-5 h-5 text-green-500" />
                      ) : (
                        <XCircle className="w-5 h-5 text-red-500" />
                      )}
                    </div>
                  )}
                </div>
              </motion.div>

              {/* Campo de correo */}
              <motion.div
                initial={{ x: -20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: 0.35 }}
              >
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Correo electrónico
                </label>
                <div className="relative">
                  <Mail className={`absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 transition-colors ${
                    focusedField === 'email' ? 'text-slate-600' : 'text-gray-400'
                  }`} />
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onFocus={() => setFocusedField('email')}
                    onBlur={() => setFocusedField(null)}
                    className="pl-10 pr-10 h-12 border-2 rounded-xl transition-all duration-200 focus:border-slate-500 focus:ring-slate-500"
                    placeholder="tu@email.com"
                    required
                  />
                  {email && (
                    <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                      {emailValid ? (
                        <CheckCircle className="w-5 h-5 text-green-500" />
                      ) : (
                        <XCircle className="w-5 h-5 text-red-500" />
                      )}
                    </div>
                  )}
                </div>
              </motion.div>

              {/* Campo de contraseña */}
              <motion.div
                initial={{ x: -20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: 0.4 }}
              >
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Contraseña
                </label>
                <div className="relative">
                  <Lock className={`absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 transition-colors ${
                    focusedField === 'password' ? 'text-slate-600' : 'text-gray-400'
                  }`} />
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onFocus={() => setFocusedField('password')}
                    onBlur={() => setFocusedField(null)}
                    className="pl-10 pr-10 h-12 border-2 rounded-xl transition-all duration-200 focus:border-slate-500 focus:ring-slate-500"
                    placeholder="Mínimo 6 caracteres"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
                {password && (
                  <div className="mt-2 text-xs">
                    <div className={`transition-colors ${passwordValid ? 'text-green-600' : 'text-red-600'}`}>
                      {passwordValid ? '✓ Contraseña válida' : '✗ Mínimo 6 caracteres'}
                    </div>
                  </div>
                )}
              </motion.div>

              {/* Campo de título */}
              <motion.div
                initial={{ x: -20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: 0.45 }}
              >
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Título/Cargo <span className="text-gray-400">(opcional)</span>
                </label>
                <div className="relative">
                  <Briefcase className={`absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 transition-colors ${
                    focusedField === 'title' ? 'text-slate-600' : 'text-gray-400'
                  }`} />
                  <Input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    onFocus={() => setFocusedField('title')}
                    onBlur={() => setFocusedField(null)}
                    className="pl-10 h-12 border-2 rounded-xl transition-all duration-200 focus:border-slate-500 focus:ring-slate-500"
                    placeholder="ej. QA Engineer, Líder de Proyecto"
                  />
                </div>
              </motion.div>

              {/* Campo de rol */}
              <motion.div
                initial={{ x: -20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: 0.5 }}
              >
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Rol en la organización
                </label>
                <Select value={role} onValueChange={(v) => setRole(v as any)}>
                  <SelectTrigger className="h-12 border-2 rounded-xl transition-all duration-200 focus:border-slate-500">
                    <SelectValue placeholder="Selecciona tu rol" />
                  </SelectTrigger>
                  <SelectContent className="bg-white border-2 border-gray-200 rounded-xl shadow-xl z-[70]">
                    <div className="px-3 pt-2 pb-1 text-[11px] uppercase tracking-wide text-gray-500 font-medium">
                      Roles disponibles
                    </div>
                    {rolesData.map((r) => (
                      <SelectItem
                        key={r.value}
                        value={r.value}
                        className="py-3 px-3 data-[highlighted]:bg-gray-50 data-[state=checked]:bg-slate-50 rounded-lg mx-1 my-1"
                      >
                        <div className="flex items-start gap-3">
                          <span className={`mt-0.5 shrink-0 ${r.color}`}>{r.icon}</span>
                          <div className="min-w-0">
                            <div className="font-medium leading-5 text-gray-800">{r.label}</div>
                            <div className="text-xs text-gray-500 leading-4">{r.desc}</div>
                          </div>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </motion.div>

              {/* Mensaje de error */}
              {error && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2 text-red-700"
                >
                  <XCircle className="w-5 h-5" />
                  <span className="text-sm">{error}</span>
                </motion.div>
              )}

              {/* Botón de enviar */}
              <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.55 }}
              >
                <Button
                  type="submit"
                  disabled={loading || !formValid}
                  className="w-full h-12 bg-gradient-to-r from-gray-900 to-black hover:from-black hover:to-gray-800 text-white font-semibold rounded-xl transition-all duration-200 transform hover:scale-[1.02] disabled:opacity-50 disabled:scale-100"
                >
                  {loading ? (
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                      Creando cuenta...
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <UserPlus className="w-5 h-5" />
                      Crear cuenta
                    </div>
                  )}
                </Button>
              </motion.div>
            </form>

            {/* Enlace para iniciar sesión */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6 }}
              className="mt-6 text-sm text-center text-gray-600"
            >
              ¿Ya tienes cuenta?{' '}
              <Link to="/login" className="text-gray-900 hover:text-black font-medium hover:underline transition-colors">
                Inicia sesión aquí
              </Link>
            </motion.div>
          </CardContent>
        </Card>
      </motion.div>

      {showWelcome && (
        <WelcomeOverlay name={welcomeName} />
      )}
    </div>
  );
}

function WelcomeOverlay({ name }: { name: string }) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      <div className="absolute inset-0 bg-white/80 backdrop-blur-sm" />

      {/* Card central */}
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 180, damping: 18 }}
        className="relative w-[92%] max-w-md rounded-3xl border bg-white shadow-2xl p-8 text-center"
      >
        <motion.div
          initial={{ scale: 0, rotate: -90 }}
          animate={{ scale: [0, 1.1, 1], rotate: 0 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className="mx-auto mb-6 h-16 w-16 rounded-full bg-gradient-to-r from-gray-100 to-gray-200 flex items-center justify-center"
        >
          <CheckCircle className="w-8 h-8 text-gray-900" />
        </motion.div>
        <motion.h3
          initial={{ y: 10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.15 }}
          className="text-2xl font-bold text-gray-900"
        >
          ¡Bienvenido{name ? `, ${name}` : ''}!
        </motion.h3>
        <motion.p
          initial={{ y: 10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.25 }}
          className="text-gray-600 mt-2"
        >
          Tu cuenta se creó exitosamente. Preparando tu entorno...
        </motion.p>
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: "100%" }}
          transition={{ delay: 0.5, duration: 1.5 }}
          className="mt-6 h-1 bg-gradient-to-r from-gray-900 to-black rounded-full"
        />
      </motion.div>
    </div>
  );
}
