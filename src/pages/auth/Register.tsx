// src/pages/auth/Register.tsx
import React, { useMemo, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Button } from '../../shared/ui/button';
import { Input } from '../../shared/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '../../shared/ui/card';
import { useAuth } from '../../auth/AuthContext';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../shared/ui/select';

export default function RegisterPage() {
  const { register, user } = useAuth();
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [title, setTitle] = useState('');
  const [role, setRole] = useState<'admin' | 'operario' | 'tecnico' | 'otro_tecnico' | 'cliente'>('cliente');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [showWelcome, setShowWelcome] = useState(false);
  const [welcomeName, setWelcomeName] = useState('');

  const isPrivileged = user && user.role !== 'cliente';

  // --- Mejora de legibilidad del selector de roles ---
  const rolesData: Array<{ value: typeof role; label: string; desc: string; icon: React.ReactNode }> = [
    {
      value: 'cliente',
      label: 'Cliente',
      desc: 'Consulta diagnósticos y resultados. (Por ahora acceso total)',
      icon: (
        <svg viewBox="0 0 24 24" width="18" height="18" className="text-slate-500">
          <path fill="currentColor" d="M12 12a5 5 0 100-10 5 5 0 000 10zm-7 9a7 7 0 0114 0v1H5v-1z" />
        </svg>
      ),
    },
    {
      value: 'operario',
      label: 'Operario',
      desc: 'Ejecución de pruebas y operación diaria. (Acceso total temporal)',
      icon: (
        <svg viewBox="0 0 24 24" width="18" height="18" className="text-slate-500">
          <path fill="currentColor" d="M4 4h16v2H4V4zm2 4h12v2H6V8zm-2 4h16v2H4v-2zm2 4h8v2H6v-2z" />
        </svg>
      ),
    },
    {
      value: 'tecnico',
      label: 'Técnico',
      desc: 'Análisis técnico y configuración. (Acceso total temporal)',
      icon: (
        <svg viewBox="0 0 24 24" width="18" height="18" className="text-slate-500">
          <path fill="currentColor" d="M7 14l5-5 5 5-1.4 1.4L12 11.8l-3.6 3.6L7 14z" />
        </svg>
      ),
    },
    {
      value: 'otro_tecnico',
      label: 'Otro técnico',
      desc: 'Soporte/roles técnicos adicionales. (Acceso total temporal)',
      icon: (
        <svg viewBox="0 0 24 24" width="18" height="18" className="text-slate-500">
          <path fill="currentColor" d="M12 2l4 4-8 8H4V10L12 2zM4 18h16v2H4v-2z" />
        </svg>
      ),
    },
    {
      value: 'admin',
      label: 'Admin',
      desc: 'Administración y control total. (Acceso total)',
      icon: (
        <svg viewBox="0 0 24 24" width="18" height="18" className="text-slate-500">
          <path fill="currentColor" d="M12 1l9 4v6c0 5-3.8 9.7-9 11-5.2-1.3-9-6-9-11V5l9-4zm0 6a3 3 0 100 6 3 3 0 000-6z" />
        </svg>
      ),
    },
  ];

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
      setError(e?.message || 'Error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full flex justify-center pt-24 px-4">
      <Card className="w-full max-w-md rounded-2xl">
        <CardHeader>
          <CardTitle>Crear cuenta</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <label className="block text-sm mb-1">Nombre</label>
              <Input type="text" value={name} onChange={e => setName(e.target.value)} required />
            </div>
            <div>
              <label className="block text-sm mb-1">Correo</label>
              <Input type="email" value={email} onChange={e => setEmail(e.target.value)} required />
            </div>
            <div>
              <label className="block text-sm mb-1">Contraseña</label>
              <Input type="password" value={password} onChange={e => setPassword(e.target.value)} required />
            </div>
            <div>
              <label className="block text-sm mb-1">Título/Cargo (opcional)</label>
              <Input type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g., QA, Líder" />
            </div>
            <div>
              <div className="flex items-center justify-between">
                <label className="block text-sm mb-1">Rol</label>
                <span className="text-[11px] text-slate-500">Todos los roles tienen acceso completo por ahora</span>
              </div>
              <Select value={role} onValueChange={(v) => setRole(v as any)}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Selecciona un rol (acceso completo temporal)" />
                </SelectTrigger>
                <SelectContent className="min-w-[320px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-md shadow-xl z-[70]">
                  {/* Encabezado ligero */}
                  <div className="px-3 pt-2 pb-1 text-[11px] uppercase tracking-wide text-slate-500">Roles disponibles</div>
                  {/* Items con icono + descripción */}
                  {rolesData.map((r) => (
                    <SelectItem
                      key={r.value}
                      value={r.value}
                      className="py-2 data-[highlighted]:bg-slate-100 data-[highlighted]:outline-none data-[state=checked]:bg-slate-100 dark:data-[highlighted]:bg-slate-800"
                    >
                      <div className="flex items-start gap-3">
                        <span className="mt-0.5 shrink-0">{r.icon}</span>
                        <div className="min-w-0">
                          <div className="font-medium leading-5 text-slate-800 dark:text-slate-100">{r.label}</div>
                          <div className="text-xs text-slate-500 dark:text-slate-400 leading-4">{r.desc}</div>
                        </div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {error && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-red-600 text-sm">
                {error}
              </motion.div>
            )}
            <Button type="submit" disabled={loading} className="w-full">
              {loading ? 'Creando...' : 'Crear cuenta'}
            </Button>
          </form>
          <div className="text-sm mt-4">
            ¿Ya tienes cuenta? <Link to="/login" className="text-blue-600 hover:underline">Inicia sesión</Link>
          </div>
        </CardContent>
      </Card>

      {showWelcome && (
        <WelcomeOverlay name={welcomeName} />
      )}
    </div>
  );
}

function WelcomeOverlay({ name }: { name: string }) {
  const colors = ['#6366f1', '#22c55e', '#ef4444', '#eab308', '#06b6d4', '#f97316'];
  const confetti = useMemo(() => Array.from({ length: 48 }).map((_, i) => ({
    id: i,
    left: Math.random() * 100,
    delay: Math.random() * 0.6,
    rotate: Math.random() * 360,
    color: colors[i % colors.length],
    scale: 0.8 + Math.random() * 0.8,
  })), []);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      <div className="absolute inset-0 bg-white/70 backdrop-blur-sm" />

      {/* Confetti */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {confetti.map((c) => (
          <motion.span
            key={c.id}
            initial={{ y: -20, x: 0, rotate: c.rotate, opacity: 0 }}
            animate={{ y: '100vh', x: [0, 15, -15, 0], rotate: c.rotate + 180, opacity: [0, 1, 1, 0] }}
            transition={{ duration: 1.8 + Math.random() * 0.8, delay: c.delay, ease: 'easeOut' }}
            style={{
              position: 'absolute',
              left: `${c.left}%`,
              top: -10,
              width: 8,
              height: 12,
              backgroundColor: c.color,
              borderRadius: 2,
              transformOrigin: 'center',
              scale: c.scale as any,
            }}
          />
        ))}
      </div>

      {/* Card central */}
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 180, damping: 18 }}
        className="relative w-[92%] max-w-md rounded-2xl border bg-white shadow-2xl p-8 text-center"
      >
        <motion.div
          initial={{ scale: 0, rotate: -90 }}
          animate={{ scale: [0, 1.1, 1], rotate: 0 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className="mx-auto mb-4 h-16 w-16 rounded-full bg-green-100 flex items-center justify-center"
        >
          <svg viewBox="0 0 24 24" width="32" height="32" className="text-green-600">
            <path fill="currentColor" d="M9 16.17l-3.88-3.88a1 1 0 10-1.41 1.41l4.59 4.59a1 1 0 001.41 0l9.59-9.59a1 1 0 10-1.41-1.41L9 16.17z" />
          </svg>
        </motion.div>
        <motion.h3
          initial={{ y: 10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.15 }}
          className="text-xl font-semibold"
        >
          ¡Bienvenido{ name ? `, ${name}` : '' }!
        </motion.h3>
        <motion.p
          initial={{ y: 10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.25 }}
          className="text-sm text-slate-600 mt-1"
        >
          Tu cuenta se creó correctamente. Preparando tu entorno…
        </motion.p>
      </motion.div>
    </div>
  );
}
