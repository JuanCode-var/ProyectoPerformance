import React from 'react';
import { Globe, Clock, Eye, Download } from 'lucide-react';
import { motion } from 'framer-motion';
import '../styles/historico.css';

export default function DashboardHistorico() {
  const mockData = [
    {
      id: 1,
      url: 'https://ejemplo1.com',
      date: '2025-01-15',
      status: 'Completado',
      performance: 85,
      accessibility: 92,
      seo: 78
    },
    {
      id: 2,
      url: 'https://ejemplo2.com',
      date: '2025-01-14',
      status: 'Completado',
      performance: 76,
      accessibility: 88,
      seo: 82
    },
    {
      id: 3,
      url: 'https://ejemplo3.com',
      date: '2025-01-13',
      status: 'En progreso',
      performance: 0,
      accessibility: 0,
      seo: 0
    },
    {
      id: 4,
      url: 'https://ejemplo4.com',
      date: '2025-01-12',
      status: 'Completado',
      performance: 94,
      accessibility: 96,
      seo: 88
    },
    {
      id: 5,
      url: 'https://ejemplo5.com',
      date: '2025-01-11',
      status: 'Error',
      performance: 0,
      accessibility: 0,
      seo: 0
    }
  ];

  const getStatusColor = (status) => {
    switch (status) {
      case 'Completado':
        return '#10b981';
      case 'En progreso':
        return '#f59e0b';
      case 'Error':
        return '#ef4444';
      default:
        return '#6b7280';
    }
  };

  const getScoreColor = (score) => {
    if (score >= 80) return '#10b981';
    if (score >= 60) return '#f59e0b';
    return '#ef4444';
  };

  const handleViewDetails = (id) => {
    console.log('Ver detalles del diagnóstico:', id);
    // Navegar a los detalles del diagnóstico
    window.location.href = `/diagnostico/${id}`;
  };

  const handleDownloadReport = (id) => {
    console.log('Descargar reporte del diagnóstico:', id);
    // Lógica de descarga del reporte
  };

  return (
    <motion.div 
      className="history-container"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
    >
      <motion.div 
        className="history-card"
        initial={{ scale: 0.95 }}
        animate={{ scale: 1 }}
        transition={{ delay: 0.2 }}
      >
        <motion.div 
          className="history-header"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <h1 className="history-title">
            Histórico de Diagnósticos
          </h1>
          <p className="history-subtitle">
            Revisa todos tus análisis anteriores
          </p>
        </motion.div>

        <motion.div 
          className="table-container"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <table className="history-table">
            <thead>
              <tr>
                <th>
                  <div className="header-content">
                    <Globe size={18} />
                    URL
                  </div>
                </th>
                <th>
                  <div className="header-content">
                    <Clock size={18} />
                    Fecha
                  </div>
                </th>
                <th>Estado</th>
                <th>Performance</th>
                <th>Accesibilidad</th>
                <th>SEO</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {mockData.map((item, index) => (
                <motion.tr 
                  key={item.id}
                  className="table-row"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.5 + index * 0.1 }}
                  whileHover={{
                    backgroundColor: 'rgba(14, 165, 233, 0.05)',
                    scale: 1.01
                  }}
                >
                  <td className="url-cell">
                    <div className="url-content">
                      <span className="url-text" title={item.url}>{item.url}</span>
                    </div>
                  </td>
                  <td className="date-cell">
                    {new Date(item.date).toLocaleDateString('es-ES')}
                  </td>
                  <td>
                    <span 
                      className="status-badge"
                      style={{
                        background: `${getStatusColor(item.status)}15`,
                        color: getStatusColor(item.status),
                        border: `1px solid ${getStatusColor(item.status)}30`
                      }}
                    >
                      <div 
                        className="status-dot"
                        style={{
                          background: getStatusColor(item.status)
                        }}
                      />
                      {item.status}
                    </span>
                  </td>
                  <td className="score-cell">
                    <span 
                      className="score-value"
                      style={{
                        color: item.performance > 0 ? getScoreColor(item.performance) : '#9ca3af'
                      }}
                    >
                      {item.performance > 0 ? `${item.performance}%` : '-'}
                    </span>
                  </td>
                  <td className="score-cell">
                    <span 
                      className="score-value"
                      style={{
                        color: item.accessibility > 0 ? getScoreColor(item.accessibility) : '#9ca3af'
                      }}
                    >
                      {item.accessibility > 0 ? `${item.accessibility}%` : '-'}
                    </span>
                  </td>
                  <td className="score-cell">
                    <span 
                      className="score-value"
                      style={{
                        color: item.seo > 0 ? getScoreColor(item.seo) : '#9ca3af'
                      }}
                    >
                      {item.seo > 0 ? `${item.seo}%` : '-'}
                    </span>
                  </td>
                  <td>
                    <div className="actions-cell">
                      <motion.button
                        className="action-button view-button"
                        onClick={() => handleViewDetails(item.id)}
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        title="Ver detalles"
                      >
                        <Eye size={14} />
                      </motion.button>
                      {item.status === 'Completado' && (
                        <motion.button
                          className="action-button download-button"
                          onClick={() => handleDownloadReport(item.id)}
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.9 }}
                          title="Descargar reporte"
                        >
                          <Download size={14} />
                        </motion.button>
                      )}
                    </div>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </motion.div>

        {/* Estadísticas rápidas */}
        <motion.div 
          className="stats-section"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 }}
        >
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-number">{mockData.length}</div>
              <div className="stat-label">Total Diagnósticos</div>
            </div>
            <div className="stat-card">
              <div className="stat-number">
                {mockData.filter(item => item.status === 'Completado').length}
              </div>
              <div className="stat-label">Completados</div>
            </div>
            <div className="stat-card">
              <div className="stat-number">
                {mockData.filter(item => item.status === 'En progreso').length}
              </div>
              <div className="stat-label">En Progreso</div>
            </div>
            <div className="stat-card">
              <div className="stat-number">
                {Math.round(
                  mockData
                    .filter(item => item.performance > 0)
                    .reduce((acc, item) => acc + item.performance, 0) /
                  mockData.filter(item => item.performance > 0).length
                ) || 0}%
              </div>
              <div className="stat-label">Promedio Performance</div>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </motion.div>
  );
}