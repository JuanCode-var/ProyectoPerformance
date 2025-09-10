## Project Structure

```
PulseChoukairPerformanceRT # 
├── microPagespeed # 
│   ├── src # 
│   │   ├── lib # 
│   │   │   └── lh-i18n-es.ts # 
│   │   ├── index.ts # 
│   │   └── pagespeed.service.ts # 
│   ├── .env # 
│   ├── package-lock.json # 
│   ├── package.json # 
│   ├── tsconfig.json # 
│   └── tsconfig.microPagespeed.json # 
├── public # 
│   ├── Alta-automatizacion-768x260.jpg # 
│   ├── banca1.jpg # 
│   ├── BCT.jpg # 
│   ├── BCTII.jpg # 
│   ├── industrias.jpg # 
│   ├── industriasDos.jpg # 
│   ├── industriaSimple.jpg # 
│   ├── LogoChoucair.png # 
│   ├── parnerts.jpg # 
│   ├── portada copy.jpg # 
│   ├── portada.jpg # 
│   ├── servicios-choucair.jpg # 
│   ├── study.jpg # 
│   ├── test-performance.jpg # 
│   ├── tipos-pruebas.jpg #                                         
│   └── vite.svg # 
├── scripts # 
│   ├── detener-podman.sh # 
│   ├── levantar-podman.sh # 
│   └── start-local.sh # 
├── security-service # 
│   ├── src # 
│   │   ├── controllers # 
│   │   │   └── analyzeController.ts # 
│   │   ├── services # 
│   │   │   ├── observatoryService.ts # 
│   │   │   └── securityAnalyzer.ts # 
│   │   ├── utils # 
│   │   ├── index.ts # 
│   │   └── routes.ts # 
│   ├── .env # 
│   ├── package-lock.json # 
│   ├── package.json # 
│   ├── README.md # 
│   └── tsconfig.json # 
├── server # 
│   ├── controllers # 
│   │   ├── auditHistory.controller.ts # 
│   │   ├── diagnostic.controller.ts # 
│   │   └── FormController.ts # 
│   ├── database # 
│   │   ├── esquemaBD.ts # 
│   │   ├── mongo.ts # 
│   │   ├── mongoDrivers.ts # 
│   │   └── securitySchema.ts # 
│   ├── routes # 
│   │   ├── diagnostic.routes.ts # 
│   │   ├── formRoutes.ts # 
│   │   ├── securityRoutes.ts # 
│   │   └── send-diagnostic.ts # 
│   ├── utils # 
│   │   ├── lh.ts # 
│   │   └── lighthouseColors.ts # 
│   ├── .env # 
│   ├── index.ts # 
│   ├── package-lock.json # 
│   ├── package.json # 
│   ├── test-axios.js # 
│   └── tsconfig.server.json # 
├── src # 
│   ├── assets # 
│   │   ├── img-indicadores # 
│   │   │   ├── circulo-azul.jpg # 
│   │   │   ├── circulo-rojo.png # 
│   │   │   └── circulo-verde.jpg # 
│   │   └── react.svg # 
│   ├── components # 
│   │   ├── ActionPlanPanel.tsx # 
│   │   ├── CategoryBreakdown.tsx # 
│   │   ├── CircularGauge.tsx # 
│   │   ├── DiagnosticoView.tsx # 
│   │   ├── EmailPdfBar.tsx # 
│   │   ├── Formulario.tsx # 
│   │   ├── HistoricoView.tsx # 
│   │   ├── MetricsDashboard.tsx # 
│   │   ├── Navbar.tsx # 
│   │   ├── SecurityDiagnosticoPanel.tsx # 
│   │   ├── SecurityHistoricoView.tsx # 
│   │   └── SecurityScoreWidget.tsx # 
│   ├── entities # 
│   │   └── audit # 
│   │       └── model # 
│   │           ├── schema.ts # 
│   │           └── store.ts # 
│   ├── features # 
│   │   └── run-audit # 
│   │       ├── api # 
│   │       │   └── index.ts # 
│   │       ├── model # 
│   │       │   └── useRunAudit.ts # 
│   │       └── ui # 
│   │           └── RunAuditCard.tsx # 
│   ├── hooks # 
│   │   └── useAudits.ts # 
│   ├── pages # 
│   │   ├── diagnostics # 
│   │   │   └── index.tsx # 
│   │   ├── history # 
│   │   │   └── index.tsx # 
│   │   ├── run-audit # 
│   │   │   └── index.tsx # 
│   │   └── security-history # 
│   │       └── index.tsx # 
│   ├── processes # 
│   │   └── audit-run-flow # 
│   │       └── RunAuditFlow.tsx # 
│   ├── services # 
│   │   ├── audit.service.ts # 
│   │   ├── auditClient.ts # 
│   │   └── diagnostics.api.ts # 
│   ├── shared # 
│   │   ├── api # 
│   │   │   └── base.ts # 
│   │   ├── lib # 
│   │   │   └── utils.ts # 
│   │   ├── model # 
│   │   │   └── slices # 
│   │   │       ├── audit-history.ts # 
│   │   │       └── ui.ts # 
│   │   ├── ui # 
│   │   │   ├── button.tsx # 
│   │   │   ├── card.tsx # 
│   │   │   ├── checkbox.tsx # 
│   │   │   ├── input.tsx # 
│   │   │   ├── select.tsx # 
│   │   │   ├── table.tsx # 
│   │   │   └── tabs.tsx # 
│   │   └── validation # 
│   │       └── index.ts # 
│   ├── styles # 
│   │   ├── action-plan-panel.tw.css # 
│   │   ├── diagnostico.tw.css # 
│   │   ├── formulario.tw.css # 
│   │   ├── historico.tw.css # 
│   │   ├── navbar.tw.css # 
│   │   └── pdf-scope.css # 
│   ├── workers # 
│   │   └── securityWorker.ts # 
│   ├── App.css # 
│   ├── App.tsx # 
│   ├── cacheKey.ts # 
│   ├── env.d.ts # 
│   ├── index.css # 
│   ├── index.ts # 
│   ├── main.tsx # 
│   ├── pagespeed.worker.ts # 
│   ├── queue.ts # 
│   ├── redisClient.ts # 
│   ├── setupSafeFetch.ts # 
│   └── tsconfig.json # 
├── .eslintignore # 
├── .gitignore # 
├── audit_raw.json # 
├── audit_raw.pretty.json # 
├── components.json # 
├── DEPENDENCIAS.md # 
├── eslint.config.js # 
├── history.json # 
├── index.html # 
├── package-lock.json # 
├── package.json # 
├── postcss.config.cjs # 
├── processed.json # 
├── README.md # 
├── tailwind.config.cjs # 
├── tsconfig.json # 
├── tsconfig.worker.json # 
└── vite.config.ts # 
```