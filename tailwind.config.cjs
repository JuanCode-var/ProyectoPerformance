/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './index.html',
    './src/**/*.{js,jsx,ts,tsx,html}',
  ],
  theme: { extend: {} },
  plugins: [],
  corePlugins: {
    preflight: true,   // Preflight activo (restaura base normal de Tailwind)
    container: false,  // ← Desactiva .container de Tailwind para no chocar con la tuya
  },
};
