## Project Structure

```
PulseChoukairPerformanceRT # 
├── microPagespeed # 
│   ├── src # 
│   │   ├── lib # 
│   │   │   └── lh-i18n-es.ts # 
│   │   ├── index.ts # 
│   │   └── pagespeed.service.ts # 
│   ├── .dockerignore # 
│   ├── .env # 
│   ├── Dockerfile # 
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
│   ├── bootstrap-servidor.sh # 
│   ├── build-and-push-all-podman.sh # 
│   ├── build-and-push-security.sh # 
│   ├── build-and-push-web.sh # 
│   ├── deploy-from-hub.sh # 
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
│   ├── Dockerfile # 
│   ├── package-lock.json # 
│   ├── package.json # 
│   ├── README.md # 
│   └── tsconfig.json # 
├── server # 
│   ├── controllers # 
│   │   ├── admin.controller.ts # 
│   │   ├── auditHistory.controller.ts # 
│   │   ├── auth.controller.ts # 
│   │   ├── diagnostic.controller.ts # 
│   │   └── FormController.ts # 
│   ├── database # 
│   │   ├── adminLog.ts # 
│   │   ├── adminVisit.ts # 
│   │   ├── esquemaBD.ts # 
│   │   ├── mongo.ts # 
│   │   ├── mongoDrivers.ts # 
│   │   ├── roleAudit.ts # 
│   │   ├── rolePermissions.ts # 
│   │   ├── securitySchema.ts # 
│   │   ├── telemetryEvent.ts # 
│   │   └── user.ts # 
│   ├── middleware # 
│   │   └── auth.ts # 
│   ├── routes # 
│   │   ├── admin.ts # 
│   │   ├── auth.ts # 
│   │   ├── diagnostic.routes.ts # 
│   │   ├── formRoutes.ts # 
│   │   ├── securityRoutes.ts # 
│   │   └── send-diagnostic.ts # 
│   ├── utils # 
│   │   ├── lh.ts # 
│   │   ├── lighthouseColors.ts # 
│   │   ├── permissionsCatalog.ts # 
│   │   └── telemetry.ts # 
│   ├── .env # 
│   ├── Dockerfile # 
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
│   ├── auth # 
│   │   └── AuthContext.tsx # 
│   ├── components # 
│   │   ├── ActionPlanPanel.tsx # 
│   │   ├── CategoryBreakdown.tsx # 
│   │   ├── CircularGauge.tsx # 
│   │   ├── Dashboard.tsx # 
│   │   ├── DiagnosticoView.tsx # 
│   │   ├── EmailPdfBar.tsx # 
│   │   ├── Formulario.tsx # 
│   │   ├── HistoricoView.tsx # 
│   │   ├── MetricsDashboard.tsx # 
│   │   ├── Navbar.tsx # 
│   │   ├── ScrollToTop.tsx # 
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
│   │   ├── useAudits.ts # 
│   │   └── useRolePermissions.ts # 
│   ├── pages # 
│   │   ├── admin # 
│   │   │   ├── logs # 
│   │   │   │   └── useLogSummary.ts # 
│   │   │   ├── telemetry # 
│   │   │   │   └── useTelemetrySummary.ts # 
│   │   │   ├── index.tsx # 
│   │   │   ├── Logs.tsx # 
│   │   │   ├── PermissionsManager.tsx # 
│   │   │   ├── Telemetry.tsx # 
│   │   │   ├── Traceability.tsx # 
│   │   │   ├── UserDetailOverrides.tsx # 
│   │   │   └── Users.tsx # 
│   │   ├── auth # 
│   │   │   ├── ForgotPassword.tsx # 
│   │   │   ├── Login.tsx # 
│   │   │   ├── Register.tsx # 
│   │   │   ├── ResetPassword.tsx # 
│   │   │   └── VerifyEmail.tsx # 
│   │   ├── diagnostics # 
│   │   │   └── index.tsx # 
│   │   ├── history # 
│   │   │   └── index.tsx # 
│   │   ├── run-audit # 
│   │   │   └── index.tsx # 
│   │   ├── security-history # 
│   │   │   └── index.tsx # 
│   │   └── settings # 
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
│   │   ├── validation # 
│   │   │   └── index.ts # 
│   │   ├── permissions.ts # 
│   │   ├── settings.ts # 
│   │   └── telemetry.ts # 
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
│   ├── Dockerfile.web # 
│   ├── env.d.ts # 
│   ├── index.css # 
│   ├── index.ts # 
│   ├── main.tsx # 
│   ├── nginx.conf # 
│   ├── pagespeed.worker.ts # 
│   ├── queue.js # 
│   ├── queue.ts # 
│   ├── redisClient.js # 
│   ├── redisClient.ts # 
│   ├── setupSafeFetch.ts # 
│   └── tsconfig.json # 
├── .env.example # 
├── .eslintignore # 
├── .gitignore # 
├── audit_raw.json # 
├── components.json # 
├── compose.deploy.yml # 
├── compose.yml # 
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
├── tailwindcss-23524.log # 
├── tsconfig.json # 
├── tsconfig.worker.json # 
└── vite.config.ts # 
```
