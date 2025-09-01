# Dependencias para clonar y levantar el aplicativo PulseChoukairPerformanceRT

Este proyecto tiene tres paquetes principales:
- Frontend (React + Vite)
- Backend principal (Express)
- Microservicio PageSpeed (Express + Lighthouse)

## 1. Dependencias globales (recomendado instalar si usas monorepo)
- Node.js >= 18
- npm >= 9

## 2. Instalación por paquete

### A. Frontend (raíz)
Ubicación: `PulseChoukairPerformanceRT/`

**Dependencias principales:**
- @radix-ui/react-checkbox
- @radix-ui/react-select
- @radix-ui/react-slot
- @radix-ui/react-tabs
- axios
- bull
- class-variance-authority
- clsx
- cors
- d3
- dotenv
- execa
- express
- framer-motion
- fs
- html2canvas
- jspdf
- lucide-react
- morgan
- node-cache
- path
- pino
- react
- react-dom
- react-router-dom
- recharts
- redis
- tailwind-merge
- zod
- zustand

**Dependencias de desarrollo:**
- @eslint/js
- @tailwindcss/postcss
- @types/bull
- @types/cors
- @types/express
- @types/morgan
- @types/node
- @types/react
- @types/react-dom
- @vitejs/plugin-react
- autoprefixer
- cssnano
- eslint
- eslint-plugin-react-hooks
- eslint-plugin-react-refresh
- globals
- nodemon
- pino-pretty
- postcss
- postcss-import
- postcss-preset-env
- tailwindcss
- tailwindcss-animate
- ts-node
- ts-node-dev
- tsx
- tw-animate-css
- typescript
- vite

### B. Microservicio PageSpeed
Ubicación: `PulseChoukairPerformanceRT/microPagespeed/`

**Dependencias principales:**
- axios
- chrome-launcher
- cors
- dotenv
- execa
- express
- lighthouse
- node-cache
- pino
- googleapis

**Dependencias de desarrollo:**
- @types/express
- @types/node
- pino-pretty
- tsx
- typescript

### C. Backend principal
Ubicación: `PulseChoukairPerformanceRT/server/`

**Dependencias principales:**
- axios
- cors
- dotenv
- express
- mongoose
- multer
- nodemailer

**Dependencias de desarrollo:**
- @types/express
- @types/node
- @types/nodemailer
- nodemon
- tsx
- typescript

---

## Instalación rápida (por paquete)

```sh
# 1. Frontend (raíz)
cd PulseChoukairPerformanceRT
npm install

# 2. Microservicio PageSpeed
cd microPagespeed
npm install

# 3. Backend principal
cd ../server
npm install
```

---

## Instalación automática de todos los paquetes (un solo comando)

```bash
# Desde la raíz del proyecto
npm run install:all
# Este comando instalará las dependencias en frontend, microservicio y backend automáticamente
# (Asegúrate de tener el script "install:all" en el package.json raíz, ejemplo abajo)
```

Agrega este script en el `package.json` de la raíz si no existe:

```json
  "scripts": {
    ...existing scripts...
    "install:all": "npm install && cd microPagespeed && npm install && cd ../server && npm install && cd .."
  }
```
```

---

## Instalación paso a paso (Gist Bash)

```bash
# Clona el repositorio
git clone <URL_DEL_REPO>
cd PulseChoukairPerformanceRT

# Instala dependencias del frontend (raíz)
npm install

# Instala dependencias del microservicio PageSpeed
cd microPagespeed
npm install

# Instala dependencias del backend principal
cd ../server
npm install

# (Opcional) Copia los archivos .env.example a .env y edítalos según tu entorno
# cp .env.example .env

# (Opcional) Levanta cada servicio en terminales separadas:
# Frontend (en la raíz)
# cd PulseChoukairPerformanceRT && npm run dev
# Microservicio PageSpeed
# cd microPagespeed && npm run dev
# Backend principal
# cd server && npm run dev

# (Opcional) Si usas Docker Compose
# cd PulseChoukairPerformanceRT
# docker compose up --build
```

---

---

## Instalación paso a paso (Gist Bash)

```bash
# 1. Clona el repositorio
git clone <URL_DEL_REPO>
cd PulseChoukairPerformanceRT

# 2. Instala Node.js (si no lo tienes)
# Windows: descarga desde https://nodejs.org/
# Linux/macOS:
# curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
# sudo apt-get install -y nodejs

# 3. Instala dependencias del frontend
npm install

# 4. Instala dependencias del microservicio PageSpeed
cd microPagespeed
npm install

# 5. Instala dependencias del backend principal
cd ../server
npm install

# 6. Copia o crea los archivos .env en cada paquete (ver ejemplos o documentación)
# cp .env.example .env

# 7. (Opcional) Levanta los servicios en desarrollo
# Frontend:
cd ..
npm run dev
# Microservicio PageSpeed:
cd microPagespeed
npm run dev
# Backend principal:
cd ../server
npm run dev

# 8. (Opcional) Usar Docker Compose
# cd ..
# docker compose up --build
```

---

## Notas
- Cada paquete tiene su propio `package.json` y puede tener su propio `.env`.
- Si clonas el repo, ejecuta `npm install` en cada carpeta antes de levantar los servicios.
- Si usas Docker, revisa los Dockerfile y compose.yaml incluidos.

---

## Para producción
- Revisa y copia los archivos `.env.example` o `.env` de cada paquete.
- Instala solo dependencias de producción con `npm ci --omit=dev` si lo deseas.

---

## Para desarrolladores
- Instala todas las dependencias (`npm install`) en cada paquete.
- Usa los scripts de `package.json` para desarrollo (`dev`, `start`, `build`, etc).
