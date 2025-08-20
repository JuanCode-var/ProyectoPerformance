// postcss.config.cjs
const postcssPresetEnv = require('postcss-preset-env');

module.exports = {
  plugins: [
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
  ],
};
