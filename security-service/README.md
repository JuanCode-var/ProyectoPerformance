# Security Service

Microservicio Node.js para análisis de seguridad de sitios web usando la API de Mozilla HTTP Observatory.

## Endpoints

- `POST /api/analyze` — Recibe `{ url: "ejemplo.com" }` y devuelve el análisis de seguridad.

## Estructura

- `src/index.ts` — Punto de entrada Express
- `src/routes.ts` — Rutas HTTP
- `src/controllers/analyzeController.ts` — Lógica de análisis
- `src/services/observatoryService.ts` — Llamada a la API de Mozilla

## Instalación

```bash
cd security-service
npm install
```

## Desarrollo

```bash
npm run dev
```

## Producción

```bash
npm start
```
