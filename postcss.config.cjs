// postcss.config.cjs
module.exports = {
  plugins: {
    // Aquí usamos el nuevo paquete en lugar de `tailwindcss`:
    '@tailwindcss/postcss': {},
    autoprefixer: {},
  }
}
