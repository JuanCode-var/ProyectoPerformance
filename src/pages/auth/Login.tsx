import React, { useMemo } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Button } from '../../shared/ui/button';
import { Input } from '../../shared/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '../../shared/ui/card';
import { useAuth } from '../../auth/AuthContext';
import { Eye, EyeOff, Mail, Lock, ArrowRight, CheckCircle, XCircle } from 'lucide-react';

export default function LoginPage() {
  const { login, initialized, refresh } = useAuth();
  const navigate = useNavigate();
  const loc = useLocation();
  const params = useMemo(() => new URLSearchParams(loc.search), [loc.search]);

  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [showPassword, setShowPassword] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [focusedField, setFocusedField] = React.useState<string | null>(null);

  const submittingRef = React.useRef(false);

  // Validation states
  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const passwordValid = password.length >= 6;

  // Verifica que la sesión está efectiva (cookie aplicada o Bearer activo) antes de navegar
  const verifySession = async (retries = 5, delayMs = 120) => {
    for (let i = 0; i < retries; i++) {
      try {
        const u = await refresh();
        if (u) return true;
      } catch {}
      await new Promise((res) => setTimeout(res, delayMs));
    }
    return false;
  };

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (loading || submittingRef.current) return;
    submittingRef.current = true;
    setLoading(true);
    setError(null);

    try {
      console.trace('[Login] onSubmit trace - invoked by:');

      // Leer valores desde el DOM (soporta autofill del navegador)
      const fd = new FormData(e.currentTarget);
      const emailDom = String(fd.get('email') || '').trim();
      const passwordDom = String(fd.get('password') || '');

      // Sincroniza estado si difiere (solo para UI/validaciones visuales)
      if (emailDom && emailDom !== email) setEmail(emailDom);
      if (passwordDom && passwordDom !== password) setPassword(passwordDom);

      const user = await login(emailDom || email, passwordDom || password);

      // blur element focused to avoid residual Enter/clicks
      try { (document.activeElement as HTMLElement | null)?.blur(); } catch (err) {}

      // Confirmar sesión antes de navegar (evita rebote si la cookie tarda en aplicarse)
      await verifySession();

      const next = params.get('next');
      if (user?.role === 'admin') {
        // navegación SPA para preservar estado y evitar problemas de cookie/refresh
        navigate('/admin', { replace: true });
      } else if (next) {
        navigate(next, { replace: true });
      } else {
        navigate('/', { replace: true });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Credenciales incorrectas';
      setError(msg);
    } finally {
      submittingRef.current = false;
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-0 m-0">
      {/* Subtle animated background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <motion.div
          animate={{ 
            x: [0, 50, 0],
            y: [0, -50, 0],
            rotate: [0, 90, 180]
          }}
          transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
          className="absolute top-1/4 left-1/4 w-24 h-24 bg-gray-100 rounded-full opacity-20"
        />
        <motion.div
          animate={{ 
            x: [0, -30, 0],
            y: [0, 50, 0],
            rotate: [0, -90, -180]
          }}
          transition={{ duration: 35, repeat: Infinity, ease: "linear" }}
          className="absolute bottom-1/4 right-1/4 w-16 h-16 bg-gray-200 rounded-full opacity-20"
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
            <CardTitle className="text-3xl font-bold mb-3">Bienvenido</CardTitle>
            <p className="text-gray-200 text-base">Accede a tu panel de control</p>
          </CardHeader>
          <CardContent className="p-10">
            {/* Icon moved to content area, centered */}
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
              className="mx-auto w-24 h-24 bg-gray-900/10 rounded-full flex items-center justify-center mb-10"
            >
              <Lock className="w-12 h-12 text-gray-900" />
            </motion.div>
            <form
              onSubmit={onSubmit}
              onKeyDown={(e) => {
                // evita que Enter dispare otro submit si ya estamos procesando
                if (e.key === 'Enter' && (loading || submittingRef.current)) {
                  e.preventDefault();
                  e.stopPropagation();
                }
              }}
              className="space-y-8"
            >
              {/* Email Field */}
              <motion.div
                initial={{ x: -20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: 0.3 }}
              >
                <label className="block text-base font-medium text-gray-700 mb-3">
                  Correo electrónico
                </label>
                <div className="relative">
                  <Mail className={`absolute left-4 top-1/2 transform -translate-y-1/2 w-6 h-6 transition-colors ${
                    focusedField === 'email' ? 'text-slate-600' : 'text-gray-400'
                  }`} />
                  <Input
                    name="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onBlur={() => { setFocusedField(null); }}
                    onFocus={() => setFocusedField('email')}
                    className="pl-12 pr-12 h-14 text-base border-2 rounded-xl transition-all duration-200 focus:border-slate-500 focus:ring-slate-500"
                    placeholder="tu@email.com"
                    required
                    autoComplete="email"
                  />
                  {email && (
                    <div className="absolute right-4 top-1/2 transform -translate-y-1/2">
                      {emailValid ? (
                        <CheckCircle className="w-6 h-6 text-green-500" />
                      ) : (
                        <XCircle className="w-6 h-6 text-red-500" />
                      )}
                    </div>
                  )}
                </div>
              </motion.div>

              {/* Password Field */}
              <motion.div
                initial={{ x: -20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: 0.4 }}
              >
                <label className="block text-base font-medium text-gray-700 mb-3">
                  Contraseña
                </label>
                <div className="relative">
                  <Lock className={`absolute left-4 top-1/2 transform -translate-y-1/2 w-6 h-6 transition-colors ${
                    focusedField === 'password' ? 'text-slate-600' : 'text-gray-400'
                  }`} />
                  <Input
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onFocus={() => setFocusedField('password')}
                    onBlur={() => setFocusedField(null)}
                    className="pl-12 pr-12 h-14 text-base border-2 rounded-xl transition-all duration-200 focus:border-slate-500 focus:ring-slate-500"
                    placeholder="••••••••"
                    required
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                    className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-6 h-6" /> : <Eye className="w-6 h-6" />}
                  </button>
                </div>
              </motion.div>

              {/* Error Message */}
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

              {/* Submit Button */}
              <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.5 }}
              >
                <Button
                  type="submit"
                  disabled={loading || !emailValid || !passwordValid}
                  className="w-full h-14 text-base bg-gradient-to-r from-gray-900 to-black hover:from-black hover:to-gray-800 text-white font-semibold rounded-xl transition-all duration-200 transform hover:scale-[1.02] disabled:opacity-50 disabled:scale-100"
                >
                  {loading ? (
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                      Iniciando sesión...
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      Iniciar sesión
                      <ArrowRight className="w-5 h-5" />
                    </div>
                  )}
                </Button>
              </motion.div>
            </form>

            {/* Links */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6 }}
              className="mt-10 space-y-4 text-base text-center"
            >
              <div className="text-gray-600">
                ¿No tienes cuenta?{' '}
                <Link to="/register" className="text-gray-900 hover:text-black font-medium hover:underline transition-colors">
                  Regístrate aquí
                </Link>
              </div>
              <div className="text-gray-600">
                ¿Olvidaste tu contraseña?{' '}
                <Link to="/forgot-password" className="text-gray-900 hover:text-black font-medium hover:underline transition-colors">
                  Recupérala
                </Link>
              </div>
              {email && (
                <div className="text-gray-600">
                  ¿No recibiste verificación?{' '}
                  <Link
                    to={`/verify-email?email=${encodeURIComponent(email)}`}
                    className="text-gray-900 hover:text-black font-medium hover:underline transition-colors"
                  >
                    Reenviar verificación
                  </Link>
                </div>
              )}
            </motion.div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}