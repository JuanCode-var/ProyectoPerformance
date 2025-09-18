// src/components/Formulario.tsx
import React, { useState, type ChangeEvent, type FormEvent } from 'react';
import { Globe, Mail, User, ArrowRight, Info, CheckCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { z } from 'zod';

// shadcn/ui (asegúrate que existan en src/shared/ui)
import { Card, CardContent, CardHeader, CardTitle } from '../shared/ui/card';
import { Input } from '../shared/ui/input';
import { Button } from '../shared/ui/button';
import { Checkbox } from '../shared/ui/checkbox';

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
type FormData = { url: string; name: string; email: string };
type FormErrors = Partial<Record<'url' | 'name' | 'email' | 'type' | 'submit', string>>;

type ApiResponse = {
  _id?: string;
  error?: string;
  [k: string]: unknown;
};

// --- Zod schemas (valida payload antes de enviar) ---
const TestKeySchema = z.enum(['pagespeed', 'unlighthouse', 'security']);
const RunAuditFormSchema = z.object({
  url: z.string().url('URL inválida'),
  name: z.string().min(1, 'El nombre es requerido'),
  email: z.string().email('Correo inválido'),
  type: z.array(TestKeySchema).min(1, 'Selecciona al menos una prueba'),
});

export default function Formulario() {
  const [formData, setFormData] = useState<FormData>({ url: '', name: '', email: '' });
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

  // Al menos una prueba seleccionada
  const hasAnySelected = Object.values(tests).some(Boolean);

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
    if (!formData.name.trim()) newErrors.name = 'El nombre es requerido';
    if (!formData.email) newErrors.email = 'El correo es requerido';
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

      // Validación con Zod ANTES de enviar
      const candidate = {
        url: formData.url,
        name: formData.name,
        email: formData.email,
        type: tipos,
      };

      const parsed = RunAuditFormSchema.safeParse(candidate);
      if (!parsed.success) {
        const zErr: FormErrors = {};
        for (const issue of parsed.error.issues) {
          const field = issue.path[0];
          if (field === 'url' || field === 'name' || field === 'email' || field === 'type') {
            zErr[field] = issue.message;
          } else {
            zErr.submit = issue.message;
          }
        }
        setErrors(zErr);
        setIsLoading(false);
        return;
      }

      // Construir payload compatible con backend
      const strategy = 'mobile';
      const categories = ['performance'];
      const payload = {
        url: parsed.data.url,
        name: parsed.data.name,
        email: parsed.data.email,
        strategy,
        categories,
        type: parsed.data.type,
      };

      let response: Response;
      try {
        response = await fetch('/api/audit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      } catch (fetchErr) {
        console.error('[frontend] fetch failed:', fetchErr);
        throw new Error('No se pudo conectar con el backend (/api/audit)');
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

      if (apiPayload._id?.startsWith("temp_")) {
        throw new Error("El diagnóstico no pudo ser persistido. Por favor, inténtalo nuevamente más tarde.");
      }

      // Determinar tipo de diagnóstico para mostrar
      const types = parsed.data.type;
      const initType = types.includes('pagespeed') && types.includes('security')
        ? 'both'
        : types.includes('security')
        ? 'security'
        : 'performance';
      navigate(`/diagnostico/${apiPayload._id}?type=${initType}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error desconocido';
      setErrors({ submit: msg });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <motion.div initial="hidden" animate="visible" variants={containerVariants}>
      {/* Card padre de shadcn */}
      <motion.div variants={itemVariants}>
        <Card className="rounded-2xl shadow-sm form-card">
          <CardHeader>
            <div className="form-header">
              <motion.div className="logo-container" whileHover={{ rotate: 2, scale: 1.02 }}>
                <img
                  src="/LogoChoucair.png"
                  alt="Choucair Business Centric Testing"
                  className="logo-img-form"
                />
              </motion.div>
              <CardTitle className="form-title">Diagnóstico de Rendimiento</CardTitle>
              <p className="form-subtitle">
                Aplicaciones Web • <span className="brand-highlight">Choucair Testing</span>
              </p>
            </div>
          </CardHeader>

          <CardContent>
            {/* Formulario */}
            <motion.form className="modern-form" onSubmit={handleSubmit} variants={itemVariants}>
              {/* URL */}
              <motion.div className="form-field" variants={itemVariants}>
                <label className="field-label">URL del Sitio Web</label>
                <div className="input-container">
                  <Globe className={`input-icon ${focusedField === 'url' ? 'focused' : ''}`} size={20} />
                  <Input
                    type="url"
                    name="url"
                    value={formData.url}
                    onChange={handleInputChange}
                    onFocus={() => setFocusedField('url')}
                    onBlur={() => setFocusedField('')}
                    placeholder="https://ejemplo.com"
                    className={`form-input ${focusedField === 'url' ? 'focused' : ''}`}
                  />
                </div>
                {errors.url && <span className="field-error">{errors.url}</span>}
              </motion.div>

              {/* Nombre */}
              <motion.div className="form-field" variants={itemVariants}>
                <label className="field-label">Nombre Completo</label>
                <div className="input-container">
                  <User className={`input-icon ${focusedField === 'name' ? 'focused' : ''}`} size={20} />
                  <Input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    onFocus={() => setFocusedField('name')}
                    onBlur={() => setFocusedField('')}
                    placeholder="Tu nombre completo"
                    className={`form-input ${focusedField === 'name' ? 'focused' : ''}`}
                  />
                </div>
                {errors.name && <span className="field-error">{errors.name}</span>}
              </motion.div>

              {/* Email */}
              <motion.div className="form-field" variants={itemVariants}>
                <label className="field-label">Correo Electrónico</label>
                <div className="input-container">
                  <Mail className={`input-icon ${focusedField === 'email' ? 'focused' : ''}`} size={20} />
                  <Input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    onFocus={() => setFocusedField('email')}
                    onBlur={() => setFocusedField('')}
                    placeholder="tu@correo.com"
                    className={`form-input ${focusedField === 'email' ? 'focused' : ''}`}
                  />
                </div>
                {errors.email && <span className="field-error">{errors.email}</span>}
              </motion.div>

              {/* Selección de APIs (Checkbox de shadcn) */}
              <motion.div className="form-field" variants={itemVariants}>
                <label className="field-label tests-label">¿Qué pruebas quieres ejecutar?</label>
                <motion.div className="checkbox-group" variants={itemVariants}>
                  {Object.entries(testInfos).map(([key, info], idx) => {
                    const k = key as keyof typeof testInfos; // 'pagespeed' | 'security'
                    const checked = !!tests[k as keyof Tests];

                    // Habilitar opción de seguridad
                    const disabled = false;

                    return (
                      <motion.div
                        key={k}
                        className={`checkbox-item ${checked ? 'checked' : ''} ${
                          ''
                        }`}
                        variants={itemVariants}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.1 }}
                        aria-disabled={disabled}
                      >
                        <label className="checkbox-label">
                          <Checkbox
                            checked={checked}
                            onCheckedChange={(v) => handleTestChange(k as keyof Tests, Boolean(v))}
                            aria-label={`Seleccionar ${info.title}`}
                          />
                          <div className="checkbox-content">
                            <div className="checkbox-icon">{info.icon}</div>
                            <div className="checkbox-title">
                              {info.title}
                            </div>
                          </div>
                        </label>

                        <motion.button
                          type="button"
                          className="info-toggle"
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
                              className="api-info"
                              initial="hidden"
                              animate="visible"
                              exit="hidden"
                              variants={infoVariants}
                            >
                              <p>{info.description}</p>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </motion.div>
                    );
                  })}
                </motion.div>
                {!hasAnySelected && (
                  <div className="field-hint field-hint--danger">
                    Selecciona al menos una prueba para continuar.
                  </div>
                )}
                {errors.type && <span className="field-error">{errors.type}</span>}
              </motion.div>

              {/* Botón submit (Button de shadcn) */}
              <motion.div whileTap={{ scale: 0.98 }}>
                <Button
                  type="submit"
                  disabled={isLoading || !hasAnySelected}
                  className={`submit-button ${isLoading ? 'loading' : ''}`}
                >
                  {isLoading ? (
                    <>
                      <motion.div
                        className="loading-spinner"
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                      />
                      Ejecutando...
                    </>
                  ) : (
                    <>
                      <span>Iniciar Diagnóstico</span>
                      <ArrowRight size={18} />
                    </>
                  )}
                </Button>
              </motion.div>
            </motion.form>

            {/* Mensaje de error */}
            {errors.submit && (
              <motion.div className="error-alert" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <strong>Error:</strong> {errors.submit}
              </motion.div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
}