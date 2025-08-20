// src/components/Formulario.tsx
import React, { useState, type ChangeEvent, type FormEvent } from 'react';
import { Globe, Mail, User, ArrowRight, Info, CheckCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';

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
    description: 'La API de seguridad detecta vulnerabilidades y analiza cabeceras seguras.',
    icon: '🛡️',
  },
};

type Tests = { pagespeed: boolean; unlighthouse: boolean; security: boolean };
type InfoKeys = keyof Tests;
type FormData = { url: string; name: string; email: string };
type FormErrors = Partial<Record<'url' | 'name' | 'email' | 'submit', string>>;

type ApiResponse = {
  _id?: string;
  error?: string;
  [k: string]: unknown;
};

export default function Formulario() {
  const [formData, setFormData] = useState<FormData>({ url: '', name: '', email: '' });
  const [tests, setTests] = useState<Tests>({ pagespeed: true, unlighthouse: false, security: false });
  const [infoOpen, setInfoOpen] = useState<Record<InfoKeys, boolean>>({
    pagespeed: false,
    unlighthouse: false,
    security: false,
  });
  const [focusedField, setFocusedField] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errors, setErrors] = useState<FormErrors>({});

  const navigate = useNavigate();

  // --- Handlers ---
  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value } as FormData));
    if (errors[name as keyof FormErrors]) {
      setErrors(prev => ({ ...prev, [name]: '' } as FormErrors));
    }
  };

  const handleTestChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, checked } = e.target;
    const key = name as keyof Tests;
    setTests(prev => ({ ...prev, [key]: checked }));
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

      const response = await fetch('/api/audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url:   formData.url,
          type:  tipos,
          name:  formData.name,
          email: formData.email,
        }),
      });

      /* ------------- BLOQUE ORIGINAL PRESERVADO (no ejecutado) -------------
      // Utilidad: parseo seguro (evita Unexpected end of JSON input)
      async function safeParse(res) {
        const text = await res.text();
        try { return JSON.parse(text || '{}'); }
        catch { return { _raw: text }; }
      }

      async function onSubmit(e) {
        e.preventDefault();
        setError(null);
        setLoading(true);

        try {
          const body = {
            url,                        // <-- el valor del input URL
            type: 'pagespeed',          // o lo que uses (pagespeed|unlighthouse|all)
            strategy: estrategia || 'mobile',
            name,
            email,                      // el del formulario
            nocache: false
          };

          const res = await fetch('/api/audit', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
          });

          const data = await safeParse(res);

          if (!res.ok || data.ok === false) {
            const msg =
              data.error ||
              data.message ||
              data.detail ||
              data._raw ||
              `HTTP ${res.status}`;
            throw new Error(msg);
          }

          // ✅ éxito: usa el _id o el objeto como lo hacías antes
          // por ejemplo:
          // navigate(`/diagnostico/${data._id}`);

          setLoading(false);
        } catch (err) {
          setLoading(false);
          setError(err.message || 'Error inesperado');
        }
      }
      ---------------------------------------------------------------------- */

      // Leer cuerpo como texto y parsear con control de errores
      const text = await response.text();
      let payload: ApiResponse;
      try {
        payload = text ? (JSON.parse(text) as ApiResponse) : {};
      } catch {
        throw new Error('Respuesta no válida del servidor');
      }

      if (!response.ok) {
        throw new Error((payload && (payload.error as string)) || `Error ${response.status}`);
      }

      navigate(`/diagnostico/${payload._id}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error desconocido';
      setErrors({ submit: msg });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <motion.div initial="hidden" animate="visible" variants={containerVariants}>
      <motion.div className="form-card" whileHover={{ scale: 1.02, boxShadow: '0 12px 24px rgba(0,0,0,0.12)' }}>
        {/* Header */}
        <motion.div className="form-header" variants={itemVariants}>
          <motion.div className="logo-container" whileHover={{ rotate: 2, scale: 1.02 }}>
            <img
              src="../../public/LogoChoucair.png"
              alt="Choucair Business Centric Testing"
              className="logo-img-form"
            />
          </motion.div>
          <motion.h1 className="form-title" variants={itemVariants}>
            Diagnóstico de Rendimiento
          </motion.h1>
          <motion.p className="form-subtitle" variants={itemVariants}>
            Aplicaciones Web • <span className="brand-highlight">Choucair Testing</span>
          </motion.p>
        </motion.div>

        {/* Formulario */}
        <motion.form className="modern-form" onSubmit={handleSubmit} variants={itemVariants}>
          {/* URL */}
          <motion.div className="form-field" variants={itemVariants}>
            <label className="field-label">URL del Sitio Web</label>
            <div className="input-container">
              <Globe className={`input-icon ${focusedField === 'url' ? 'focused' : ''}`} size={20} />
              <motion.input
                type="url"
                name="url"
                value={formData.url}
                onChange={handleInputChange}
                onFocus={() => setFocusedField('url')}
                onBlur={() => setFocusedField('')}
                placeholder="https://ejemplo.com"
                className={`form-input ${focusedField === 'url' ? 'focused' : ''}`}
                whileFocus={{ borderColor: '#1d4ed8', boxShadow: '0 0 0 3px rgba(59,130,246,0.2)' }}
              />
            </div>
            {errors.url && <span className="field-error">{errors.url}</span>}
          </motion.div>

          {/* Nombre */}
          <motion.div className="form-field" variants={itemVariants}>
            <label className="field-label">Nombre Completo</label>
            <div className="input-container">
              <User className={`input-icon ${focusedField === 'name' ? 'focused' : ''}`} size={20} />
              <motion.input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                onFocus={() => setFocusedField('name')}
                onBlur={() => setFocusedField('')}
                placeholder="Tu nombre completo"
                className={`form-input ${focusedField === 'name' ? 'focused' : ''}`}
                whileFocus={{ borderColor: '#1d4ed8', boxShadow: '0 0 0 3px rgba(59,130,246,0.2)' }}
              />
            </div>
            {errors.name && <span className="field-error">{errors.name}</span>}
          </motion.div>

          {/* Email */}
          <motion.div className="form-field" variants={itemVariants}>
            <label className="field-label">Correo Electrónico</label>
            <div className="input-container">
              <Mail className={`input-icon ${focusedField === 'email' ? 'focused' : ''}`} size={20} />
              <motion.input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleInputChange}
                onFocus={() => setFocusedField('email')}
                onBlur={() => setFocusedField('')}
                placeholder="tu@correo.com"
                className={`form-input ${focusedField === 'email' ? 'focused' : ''}`}
                whileFocus={{ borderColor: '#1d4ed8', boxShadow: '0 0 0 3px rgba(59,130,246,0.2)' }}
              />
            </div>
            {errors.email && <span className="field-error">{errors.email}</span>}
          </motion.div>

          {/* Selección de APIs */}
          <motion.div className="form-field" variants={itemVariants}>
            <label className="field-label tests-label">¿Qué pruebas quieres ejecutar?</label>
            <motion.div className="checkbox-group" variants={itemVariants}>
              {Object.entries(testInfos).map(([key, info], idx) => {
                const k = key as keyof typeof testInfos; // 'pagespeed' | 'security'
                return (
                  <motion.div
                    key={k}
                    className={`checkbox-item ${tests[k as keyof Tests] ? 'checked' : ''}`}
                    variants={itemVariants}
                    whileHover={{ scale: 1.05, boxShadow: '0 10px 25px rgba(29, 78, 216, 0.15)' }}
                    whileTap={{ scale: 0.95 }}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.1 }}
                  >
                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        name={k}
                        checked={!!tests[k as keyof Tests]}
                        onChange={handleTestChange}
                      />
                      <span className="checkbox-custom" />
                      <div className="checkbox-content">
                        <div className="checkbox-icon">{info.icon}</div>
                        <div className="checkbox-title">{info.title}</div>
                      </div>
                      <motion.div
                        className="checkbox-check"
                        animate={{
                          scale: tests[k as keyof Tests] ? 1.1 : 1,
                          backgroundColor: tests[k as keyof Tests] ? '#1d4ed8' : 'rgba(0,0,0,0)',
                        }}
                      >
                        {tests[k as keyof Tests] && <CheckCircle size={16} color="white" />}
                      </motion.div>
                    </label>
                    <motion.button
                      type="button"
                      className="info-toggle"
                      onClick={() => toggleInfo(k as InfoKeys)}
                      whileHover={{ scale: 1.1 }}
                      transition={{ type: 'spring', stiffness: 300 }}
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
          </motion.div>

          {/* Botón submit */}
          <motion.button
            type="submit"
            className={`submit-button ${isLoading ? 'loading' : ''}`}
            disabled={isLoading}
            whileTap={{ scale: 0.98 }}
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
          </motion.button>
        </motion.form>

        {/* Mensaje de error */}
        {errors.submit && (
          <motion.div className="error-alert" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <strong>Error:</strong> {errors.submit}
          </motion.div>
        )}
      </motion.div>
    </motion.div>
  );
}