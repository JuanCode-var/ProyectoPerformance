// src/components/Formulario.tsx
import React, { useState, type ChangeEvent, type FormEvent } from 'react';
import { Globe, ArrowRight, Info } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { z } from 'zod';

// shadcn/ui (asegúrate que existan en src/shared/ui)
import { Card, CardContent, CardHeader, CardTitle } from '../shared/ui/card';
import { Input } from '../shared/ui/input';
import { Button } from '../shared/ui/button';
import { Checkbox } from '../shared/ui/checkbox';
import { useAuth } from '../auth/AuthContext';

// --- Animations ---
const containerVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { staggerChildren: 0.1 } },
} as const;

const itemVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0 },
} as const;

const infoVariants = {
  hidden: { height: 0, opacity: 0 },
  visible: { height: 'auto', opacity: 1, transition: { duration: 0.3 } },
} as const;

// --- API Info ---
type TestInfo = { title: string; description: string; icon: string };
const testInfos: Record<'pagespeed' | 'security', TestInfo> = {
  pagespeed: {
    title: 'Performance',
    description: 'Lighthouse audita rendimiento, accesibilidad, SEO y mejores prácticas.',
    icon: '🚀',
  },
  security: {
    title: 'Seguridad',
    description: 'Analiza cabeceras HTTP y cookies para detectar configuraciones inseguras; no realiza escaneos intrusivos de vulnerabilidades.',
    icon: '🛡️',
  },
};

type Tests = { pagespeed: boolean; unlighthouse: boolean; security: boolean };
type InfoKeys = keyof Tests;
type FormData = { url: string };
type FormErrors = Partial<Record<'url' | 'type' | 'submit', string>>;

type ApiResponse = {
  _id?: string;
  error?: string;
  [k: string]: unknown;
};

// --- Zod schemas ---
const TestKeySchema = z.enum(['pagespeed', 'unlighthouse', 'security']);
const RunAuditFormSchema = z.object({
  url: z.string().url('URL inválida'),
  type: z.array(TestKeySchema).min(1, 'Selecciona al menos una prueba'),
});

export default function Formulario() {
  const [formData, setFormData] = useState<FormData>({ url: '' });
  const [tests, setTests] = useState<Tests>({ pagespeed: false, unlighthouse: false, security: false });
  const [infoOpen, setInfoOpen] = useState<Record<InfoKeys, boolean>>({
    pagespeed: false,
    unlighthouse: false,
    security: false,
  });
  const [focusedField, setFocusedField] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errors, setErrors] = useState<FormErrors>({});

  const navigate = useNavigate();
  const { user } = useAuth();

  const hasAnySelected = Object.values(tests).some(Boolean);
  const isCliente = user?.role === 'cliente';

  // --- Handlers ---
  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value } as FormData));
    if (errors[name as keyof FormErrors]) {
      setErrors(prev => ({ ...prev, [name]: '' } as FormErrors));
    }
  };

  const handleTestChange = (k: keyof Tests, v: boolean) => {
    setTests(prev => ({ ...prev, [k]: v }));
    if (errors.type) setErrors(prev => ({ ...prev, type: '' }));
  };

  const toggleInfo = (api: InfoKeys) => {
    setInfoOpen(prev => ({ ...prev, [api]: !prev[api] }));
  };

  const validateForm = () => {
    const newErrors: FormErrors = {};
    if (!formData.url) newErrors.url = 'La URL es requerida';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!validateForm()) return;

    setIsLoading(true);
    setErrors({});

    try {
      const tipos = (Object.keys(tests) as (keyof Tests)[]).filter(key => tests[key]);

      const candidate = {
        url: formData.url,
        type: tipos,
      };

      const parsed = RunAuditFormSchema.safeParse(candidate);
      if (!parsed.success) {
        const zErr: FormErrors = {};
        for (const issue of parsed.error.issues) {
          const field = issue.path[0];
          if (field === 'url' || field === 'type') {
            zErr[field] = issue.message;
          } else {
            zErr.submit = issue.message;
          }
        }
        setErrors(zErr);
        setIsLoading(false);
        return;
      }

      const strategy = 'mobile';
      const categories = ['performance'];
      const payload = {
        url: parsed.data.url,
        strategy,
        categories,
        type: parsed.data.type,
      };

      let response: Response;
      try {
        response = await fetch('/api/audit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(payload),
        });
      } catch (fetchErr) {
        console.error('[frontend] fetch failed:', fetchErr);
        throw new Error('No se pudo conectar con el backend (/api/audit)');
      }

      if (response.status === 401) {
        // Build safe login redirect
        try {
          const url = new URL(window.location.href);
          const AUTH_ROUTES = ['/login', '/register', '/forgot-password', '/reset-password']; // removido '/verify-email'
          const currentPath = url.pathname;
          if (AUTH_ROUTES.some((p) => currentPath.startsWith(p))) {
            navigate('/login');
            return;
          }
          const search = new URLSearchParams(url.search);
          search.delete('next');
          const qs = search.toString();
          const nextPath = currentPath + (qs ? `?${qs}` : '');
          const to = nextPath && nextPath !== '/' ? `/login?next=${encodeURIComponent(nextPath)}` : '/login';
          navigate(to);
        } catch {
          navigate('/login');
        }
        return;
      }
      if (response.status === 403) {
        console.error('[frontend] 403 error - Sin permisos para rol:', user?.role);
        setErrors({ submit: `Sin permisos para ejecutar diagnósticos. Tu rol actual: ${user?.role}. Contacta al administrador.` });
        return;
      }

      const text = await response.text();
      let apiPayload: ApiResponse;
      try {
        apiPayload = text ? (JSON.parse(text) as ApiResponse) : {};
      } catch {
        console.error('[frontend] invalid server response:', text);
        throw new Error('Respuesta no válida del servidor');
      }

      if (!response.ok) {
        console.error('[frontend] response error:', apiPayload);
        throw new Error((apiPayload && (apiPayload.error as string)) || `Error ${response.status}`);
      }

      if (apiPayload._id?.startsWith('temp_')) {
        throw new Error('El diagnóstico no pudo ser persistido. Por favor, inténtalo nuevamente más tarde.');
      }

      const types = parsed.data.type;
      const initType = types.includes('pagespeed') && types.includes('security')
        ? 'both'
        : types.includes('security')
        ? 'security'
        : 'performance';

      navigate(`/diagnostico/${apiPayload._id}?type=${initType}`);
    } catch (e: any) {
      console.error('[frontend] submit error:', e);
      setErrors({ submit: e?.message || 'Error inesperado' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-0 m-0">
      {/* Removed floating back button; now handled in Navbar only when on the form */}
      {/* Logo flotante eliminado: mantener branding solo dentro del Card para evitar duplicados */}
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
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="w-full max-w-2xl relative z-10 px-4"
      >
        <Card className="backdrop-blur-lg bg-white/95 border border-gray-300 shadow-2xl rounded-2xl overflow-hidden">
          <CardHeader className="relative text-center pb-6 pt-8 bg-gradient-to-r from-green-700 to-black hover:from-green-900 hover:to-black text-white rounded-t-2xl">
            <div className="mx-auto mb-4 flex flex-col items-center gap-2">
              <img src="/LogoChoucair.png" alt="Choucair" className="h-14 w-auto" />
              <span className="text-[10px] tracking-[0.25em] text-gray-300 font-medium">BUSINESS CENTRIC TESTING</span>
            </div>
            <CardTitle className="text-3xl font-bold mb-3">
              {isCliente ? `Bienvenido, ${user?.name}` : 'Diagnóstico de Performance'}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-10">
            {/* Icon moved to content area, centered */}
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
              className="mx-auto w-24 h-24 bg-gray-900/10 rounded-full flex items-center justify-center mb-10"
            >
              <Globe className="w-12 h-12 text-gray-900" />
            </motion.div>
            
            <motion.form onSubmit={handleSubmit} variants={containerVariants} className="space-y-8">
              {/* URL Field */}
              <motion.div variants={itemVariants} className="space-y-3">
                <label htmlFor="url" className="block text-base font-medium text-gray-700 mb-3">
                  URL del sitio web
                </label>
                <div className="relative">
                  <Globe className={`absolute left-4 top-1/2 transform -translate-y-1/2 w-6 h-6 transition-colors ${
                    focusedField === 'url' ? 'text-slate-600' : 'text-gray-400'
                  }`} />
                  <Input
                    id="url"
                    name="url"
                    type="url"
                    value={formData.url}
                    onChange={handleInputChange}
                    onFocus={() => setFocusedField('url')}
                    onBlur={() => setFocusedField('')}
                    placeholder="https://ejemplo.com"
                    className="pl-12 pr-4 h-14 text-base border-2 rounded-xl transition-all duration-200 focus:border-slate-500 focus:ring-slate-500"
                    required
                  />
                </div>
                {errors.url && <span className="text-red-500 text-sm font-medium">{errors.url}</span>}
              </motion.div>

              {/* Test Selection */}
              <motion.div variants={itemVariants} className="space-y-4">
                <div className="space-y-6">
                  <div className="text-center">
                    <h3 className="text-xl font-semibold text-gray-700 mb-2">Tipos de análisis</h3>
                    <p className="text-gray-500">
                      Selecciona los análisis que deseas ejecutar
                    </p>
                  </div>
                  <motion.div className="space-y-4" variants={containerVariants}>
                    {(Object.keys(testInfos) as Array<keyof typeof testInfos>).map((k) => {
                      const info = testInfos[k];
                      const checked = tests[k];
                      const disabled = false;

                      return (
                        <motion.div
                          key={k}
                          variants={itemVariants}
                          className={`relative group transition-all duration-200 ${
                            checked 
                              ? 'ring-2 ring-gray-500 bg-gray-50' 
                              : 'hover:ring-2 hover:ring-gray-200 bg-white'
                          } ${disabled ? 'opacity-60 pointer-events-none' : ''} rounded-xl border-2 border-gray-100 p-6`}
                        >
                          <label className={`flex items-center gap-4 cursor-pointer ${disabled ? 'opacity-60 pointer-events-none' : ''}`}>
                            <Checkbox
                              checked={checked}
                              onCheckedChange={(v) => !disabled && handleTestChange(k as keyof Tests, Boolean(v))}
                              aria-label={`Seleccionar ${info.title}`}
                              disabled={disabled}
                              className="w-5 h-5"
                            />
                            <div className="flex items-center gap-4 flex-1">
                              <div className="text-3xl">{info.icon}</div>
                              <div className="text-lg font-semibold text-gray-700">
                                {info.title}
                              </div>
                            </div>
                          </label>

                          <motion.button
                            type="button"
                            className="absolute top-6 right-6 flex items-center gap-2 text-sm text-gray-600 hover:text-gray-800 font-medium transition-colors"
                            onClick={() => toggleInfo(k as InfoKeys)}
                            transition={{ type: 'spring', stiffness: 300 }}
                            disabled={false}
                          >
                            <Info size={16} />
                            <span>{infoOpen[k as InfoKeys] ? 'Ocultar' : '¿Qué es?'}</span>
                          </motion.button>

                          <AnimatePresence>
                            {infoOpen[k as InfoKeys] && (
                              <motion.div
                                className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200"
                                initial="hidden"
                                animate="visible"
                                exit="hidden"
                                variants={infoVariants}
                              >
                                <p className="text-gray-600">{info.description}</p>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </motion.div>
                      );
                    })}
                  </motion.div>
                  {!hasAnySelected && (
                    <div className="text-center p-4 bg-red-50 border border-red-200 rounded-lg">
                      <span className="text-red-600 font-medium">
                        Selecciona al menos una prueba para continuar.
                      </span>
                    </div>
                  )}
                  {errors.type && <span className="text-red-500 text-sm font-medium">{errors.type}</span>}
                </div>
              </motion.div>

              {/* Submit Button */}
              <motion.div whileTap={{ scale: 0.98 }} className="pt-4">
                <Button
                  type="submit"
                  disabled={isLoading || !hasAnySelected}
                  className="w-full h-14 text-base bg-gradient-to-r from-green-700 to-black hover:from-green-900 hover:to-black text-white font-semibold rounded-xl transition-all duration-200 transform hover:scale-[1.02] disabled:opacity-50 disabled:scale-100"
                >
                  {isLoading ? (
                    <div className="flex items-center justify-center gap-3">
                      <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                      <span>Ejecutando...</span>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center gap-3">
                      <span>Iniciar Diagnóstico</span>
                      <ArrowRight size={20} />
                    </div>
                  )}
                </Button>
              </motion.div>
            </motion.form>

            {/* Error Message */}
            {errors.submit && (
              <motion.div 
                className="mt-6 p-4 bg-red-50 border border-red-200 rounded-xl"
                initial={{ opacity: 0, y: 10 }} 
                animate={{ opacity: 1, y: 0 }}
              >
                <div className="flex items-center gap-2 text-red-700">
                  <div className="w-5 h-5 bg-red-500 rounded-full flex items-center justify-center text-white text-xs font-bold">!</div>
                  <strong>Error:</strong> 
                  <span>{errors.submit}</span>
                </div>
              </motion.div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
