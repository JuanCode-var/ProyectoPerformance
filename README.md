#Project Estructure

├── .git/
│   ├── COMMIT_EDITMSG
│   ├── config
│   ├── description
│   ├── HEAD
│   ├── hooks/
│   │   ├── applypatch-msg.sample
│   │   ├── commit-msg.sample
│   │   ├── fsmonitor-watchman.sample
│   │   ├── post-update.sample
│   │   ├── pre-applypatch.sample
│   │   ├── pre-commit.sample
│   │   ├── pre-merge-commit.sample
│   │   ├── pre-push.sample
│   │   ├── pre-rebase.sample
│   │   ├── pre-receive.sample
│   │   ├── prepare-commit-msg.sample
│   │   ├── push-to-checkout.sample
│   │   ├── sendemail-validate.sample
│   │   └── update.sample
│   ├── index
│   ├── index.bak
│   ├── info/
│   │   └── exclude
│   ├── logs/
│   │   ├── HEAD
│   │   └── refs/
│   ├── objects/
│   │   ├── 00//
│       └── tags/
├── .gitignore
├── eslint.config.js
├── index.html
├── microPagespeed/
│   ├── .env
│   ├── node_modules/
│   ├── package-lock.json
│   ├── package.json
│   └── src/
│       ├── index.js
│       └── unlighthouse.service.js
├── package-lock.json
├── package.json
├── postcss.config.cjs
├── public/
│   ├── Alta-automatizacion-768x260.jpg
│   ├── banca1.jpg
│   ├── BCT.jpg
│   ├── BCTII.jpg
│   ├── industrias.jpg
│   ├── industriasDos.jpg
│   ├── industriaSimple.jpg
│   ├── LogoChoucair.png
│   ├── parnerts.jpg
│   ├── portada copy.jpg
│   ├── portada.jpg
│   ├── servicios-choucair.jpg
│   ├── study.jpg
│   ├── test-performance.jpg
│   ├── tipos-pruebas.jpg
│   └── vite.svg
├── README.md
├── server/
│   ├── .env
│   ├── controllers/
│   │   ├── auditHistory.controller.js
│   │   ├── formController.js
│   │   └── unlighthouseController.js
│   ├── database/
│   │   ├── esquemaBD.js
│   │   ├── mongo.js
│   │   └── mongoDrivers.js
│   ├── index.js
│   ├── node_modules/
│   ├── package-lock.json
│   ├── package.json
│   └── routes/
│       └── formRoutes.js
├── src/
│   ├── App.css
│   ├── App.tsx
│   ├── assets/
│   │   ├── img-indicadores/
│   │   └── react.svg
│   ├── cacheKey.js
│   ├── components/
│   │   ├── CircularGauge.jsx
│   │   ├── DashboardHistorico.jsx
│   │   ├── DiagnosisDashboard.jsx
│   │   ├── DiagnosticoView.jsx
│   │   ├── Formulario.jsx
│   │   ├── LighthouseTestForm.jsx
│   │   ├── Navbar.jsx
│   │   └── SemaforoBadge.jsx
│   ├── hooks/
│   │   └── useAudits.js
│   ├── index.css
│   ├── index.js
│   ├── main.tsx
│   ├── pagespeed.worker.js
│   ├── queue.js
│   ├── redisClient.js
│   ├── services/
│   │   └── audit.service.ts
│   ├── styles/
│   │   ├── diagnostico.css
│   │   ├── formulario.css
│   │   ├── historico.css
│   │   └── navbar.css
│   └── utils/
│       └── lighthouseColors.ts
├── tailwind.config.js
└── vite.config.js

## Directory Structure

```
PulseChoukairPerformanceRT # 
├── microPagespeed # 
│   ├── src # 
│   │   ├── lib # 
│   │   │   └── lh-i18n-es.ts # 
│   │   ├── index.ts # 
│   │   └── pagespeed.service.ts # 
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
├── server # 
│   ├── controllers # 
│   │   ├── auditHistory.controller.ts # 
│   │   ├── diagnostic.controller.ts # 
│   │   └── FormController.ts # 
│   ├── database # 
│   │   ├── esquemaBD.ts # 
│   │   ├── mongo.ts # 
│   │   └── mongoDrivers.ts # 
│   ├── routes # 
│   │   ├── diagnostic.routes.ts # 
│   │   ├── formRoutes.ts # 
│   │   └── send-diagnostic.ts # 
│   ├── server # 
│   │   └── Dockerfile # 
│   ├── utils # 
│   │   ├── lh.ts # 
│   │   └── lighthouseColors.ts # 
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
│   ├── components # 
│   │   ├── ActionPlanPanel.tsx # 
│   │   ├── CategoryBreakdown.tsx # 
│   │   ├── CircularGauge.tsx # 
│   │   ├── DiagnosticoView.tsx # 
│   │   ├── EmailPdfBar.tsx # 
│   │   ├── Formulario.tsx # 
│   │   ├── HistoricoView.tsx # 
│   │   ├── MetricsDashboard.tsx # 
│   │   └── Navbar.tsx # 
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
│   │   └── run-audit # 
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
├── compose.yaml # 
├── DEPENDENCIAS.md # 
├── Dockerfile.web # 
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
