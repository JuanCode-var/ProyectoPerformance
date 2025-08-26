// postcss.config.cjs
const postcssPresetEnv = require('postcss-preset-env')
const postcssImport = require('postcss-import')
const cssnano = require('cssnano')

const isProd = process.env.NODE_ENV === 'production'

module.exports = {
  plugins: [
    // Permite usar @import en CSS (opcional pero útil)
    postcssImport(),

    // Tailwind v4 preset (incluye nesting + autoprefixer)
    require('@tailwindcss/postcss'),

    // Transpila funciones de color modernas a sRGB (rgb/hsl)
    postcssPresetEnv({
      stage: 3,
      features: {
        'oklab-function': { preserve: false },
        'oklch-function': { preserve: false },
        'lab-function':   { preserve: false },
        'lch-function':   { preserve: false },
        'relative-color-syntax': { preserve: false },
        'color-mix-function':    { preserve: false },
      },
    }),

    // Minificación SOLO en build de producción
    ...(isProd ? [cssnano({ preset: 'default' })] : []),
  ],
}