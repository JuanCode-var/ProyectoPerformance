// src/components/Dashboard.tsx
import React from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '../auth/AuthContext';
import { useNavigate } from 'react-router-dom';
import { 
  Globe, 
  Shield, 
  BarChart3, 
  Users, 
  Settings, 
  FileText, 
  Play, 
  Activity,
  Lock,
  UserCog,
  Database,
  AlertTriangle
} from 'lucide-react';

interface RoleInfo {
  title: string;
  description: string;
  capabilities: string[];
  primaryAction: {
    text: string;
    icon: React.ComponentType<any>;
    onClick: () => void;
    color: string;
  };
  secondaryActions: Array<{
    text: string;
    icon: React.ComponentType<any>;
    onClick: () => void;
    color: string;
  }>;
}

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();

  if (!user) return null;

  const getRoleInfo = (): RoleInfo => {
    switch (user.role) {
      case 'admin':
        return {
          title: 'Panel de Administración',
          description: 'Como administrador, tienes control total sobre la plataforma y puedes gestionar usuarios, configuraciones y monitorear el sistema.',
          capabilities: [
            'Gestionar usuarios y permisos',
            'Configurar parámetros del sistema',
            'Acceder a logs y telemetría',
            'Ejecutar diagnósticos de performance y seguridad',
            'Visualizar reportes completos'
          ],
          primaryAction: {
            text: 'Ejecutar Diagnóstico',
            icon: Play,
            onClick: () => navigate('/?form=true'),
            color: 'from-green-500 to-black hover:from-green-900 hover:to-black'
          },
          secondaryActions: [
            {
              text: 'Panel de Control',
              icon: Settings,
              onClick: () => navigate('/admin'),
              color: 'from-gray-800 to-black hover:from-black hover:to-gray-700'
            },
            {
              text: 'Gestionar Usuarios',
              icon: Users,
              onClick: () => navigate('/admin/users'),
              color: 'from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800'
            },
            {
              text: 'Ver Logs',
              icon: FileText,
              onClick: () => navigate('/admin/logs'),
              color: 'from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800'
            }
          ]
        };

      case 'tecnico':
      case 'otro_tecnico':
        return {
          title: 'Panel Técnico',
          description: 'Como técnico, puedes realizar pruebas de performance y de seguridad con todos sus permisos, ver los historicos, y enviar PDF de los resultados. Ademas de eso tendrás acceso a herramientas técnicas.',
          capabilities: [
            'Ejecutar diagnósticos',
            'Ver históricos',
            'Análisis de performance y seguridad',
            'Enviar diagnósticos por email en PDF',
            'Acceso a herramientas técnicas'
          ],
          primaryAction: {
            text: 'Ejecutar Diagnóstico',
            icon: Play,
            onClick: () => navigate('/?form=true'),
            color: 'from-green-500 to-black hover:from-green-900 hover:to-black'
          },
          secondaryActions: [
            {
              text: 'Herramientas Técnicas',
              icon: UserCog,
              onClick: () => navigate('/otros'),
              color: 'from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800'
            },
         ]
        };

      case 'operario':
        return {
          title: 'Panel de Operaciones',
          description: 'Como operario, puedes realizar pruebas de performance y de seguridad con todos sus permisos, ver los historicos, y enviar PDF de los resultados.',
          capabilities: [
            'Ejecutar diagnósticos',
            'Ver históricos',
            'Análisis de performance y seguridad',
            'Enviar diagnósticos por email en PDF'
          ],
          primaryAction: {
            text: 'Ejecutar Diagnóstico',
            icon: Play,
            onClick: () => navigate('/?form=true'),
            color: 'from-green-500 to-black hover:from-green-900 hover:to-black'
          },
          secondaryActions: []
        };

      case 'cliente':
      default:
        return {
          title: 'Bienvenido a tu Panel',
          description: 'Como cliente, puedes ejecutar diagnósticos de performance y seguridad para cualquier sitio web. Ademas, tendrás acceso a un plan de accion sugerido que varia dependiendo de las necesidades del sitio web para mejorar el rendimiento y la seguridad.',
          capabilities: [
            'Ejecutar diagnósticos de performance y seguridad',
            'Visualizar métricas detalladas',
            'Acceso a un plan de acción sugerido',
            'Enviar diagnósticos por email en PDF'
          ],
          primaryAction: {
            text: 'Ejecutar Diagnóstico',
            icon: Play,
            onClick: () => navigate('/?form=true'),
            color: 'from-green-500 to-black hover:from-green-900 hover:to-black'
          },
          secondaryActions: []
        };
    }
  };

  const roleInfo = getRoleInfo();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-gray-100">
      {/* Header Section */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6 }}
        className="bg-gradient-to-r from-green-700 to-black text-white pb-12"
      >
        <div className="max-w-4xl mx-auto px-6 pt-[calc(3rem+env(safe-area-inset-top))]">
          <div className="flex items-center gap-4 mb-4">
            <img
              src="/LogoChoucair.png"
              alt="Choucair Business Centric Testing"
              className="h-12 w-auto"
            />
            <div className="text-[10px] tracking-[0.25em] text-gray-300 font-medium">
              BUSINESS CENTRIC TESTING
            </div>
          </div>
          <h1 className="text-4xl font-bold mb-4">
            Bienvenido, {user.name}
          </h1>
          <p className="text-xl text-gray-300 leading-relaxed">
            {roleInfo.description}
          </p>
        </div>
      </motion.div>

      {/* Main Dashboard Content */}
      <div className="max-w-6xl mx-auto px-6 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Capabilities Card */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="lg:col-span-2"
          >
            <div className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden">
              <div className="bg-gradient-to-r from-gray-100 to-gray-200 px-6 py-4 border-b">
                <h2 className="text-xl font-bold text-gray-800 flex items-center gap-3">
                  <Activity className="w-6 h-6 text-gray-600" />
                  {roleInfo.title}
                </h2>
              </div>
              <div className="p-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">
                  ¿Qué puedes hacer?
                </h3>
                <ul className="space-y-3">
                  {roleInfo.capabilities.map((capability, index) => (
                    <motion.li
                      key={index}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.4, delay: 0.3 + index * 0.1 }}
                      className="flex items-start gap-3"
                    >
                      <div className="mt-1 w-2 h-2 bg-blue-500 rounded-full flex-shrink-0"></div>
                      <span className="text-gray-700 leading-relaxed">{capability}</span>
                    </motion.li>
                  ))}
                </ul>
              </div>
            </div>
          </motion.div>

          {/* Actions Card */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
          >
            <div className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden">
              <div className="bg-gradient-to-r from-gray-100 to-gray-200 px-6 py-4 border-b">
                <h2 className="text-xl font-bold text-gray-800 flex items-center gap-3">
                  <Globe className="w-6 h-6 text-gray-600" />
                  Acciones Rápidas
                </h2>
              </div>
              <div className="p-6 space-y-4">
                {/* Primary Action */}
                <motion.button
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: 0.5 }}
                  onClick={roleInfo.primaryAction.onClick}
                  className={`w-full flex items-center justify-center gap-3 px-6 py-4 rounded-xl bg-gradient-to-r ${roleInfo.primaryAction.color} text-white font-semibold transition-all duration-200 transform hover:scale-105 shadow-md hover:shadow-lg`}
                >
                  <roleInfo.primaryAction.icon className="w-5 h-5" />
                  {roleInfo.primaryAction.text}
                </motion.button>

                {/* Secondary Actions */}
                <div className="space-y-3">
                  {roleInfo.secondaryActions.map((action, index) => (
                    <motion.button
                      key={index}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.4, delay: 0.6 + index * 0.1 }}
                      onClick={action.onClick}
                      className={`w-full flex items-center justify-center gap-3 px-4 py-3 rounded-xl bg-gradient-to-r ${action.color} text-white font-medium transition-all duration-200 transform hover:scale-105 shadow-sm hover:shadow-md text-sm`}
                    >
                      <action.icon className="w-4 h-4" />
                      {action.text}
                    </motion.button>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Role Badge */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.8 }}
          className="mt-12 text-center"
        >
          <div className="inline-flex items-center gap-2 px-6 py-3 bg-white rounded-full shadow-md border border-gray-200">
            <Lock className="w-4 h-4 text-gray-500" />
            <span className="text-sm text-gray-600 font-medium">
              Conectado como <strong className="text-gray-800 capitalize">{user.role}</strong>
            </span>
            {user.title && (
              <>
                <span className="text-gray-400">•</span>
                <span className="text-sm text-gray-600">{user.title}</span>
              </>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
