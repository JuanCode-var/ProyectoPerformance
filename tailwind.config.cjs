// tailwind.config.cjs
const tailwindcssAnimate = require('tailwindcss-animate')
const { fontFamily } = require('tailwindcss/defaultTheme')
const { fonts } = require('./src/config/fonts')

/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{ts,tsx,js,jsx}'],
  safelist: Array.isArray(fonts) ? fonts.map((f) => `font-${f}`) : [],
  theme: {
    container: {
      center: true,
      padding: { DEFAULT: '0.75rem', sm: '1rem', md: '1.5rem', lg: '1rem', xl: '2.5rem', '2xl': '3rem' },
      screens: { sm: '640px', md: '768px', lg: '1024px', xl: '1280px', '2xl': '1536px' },
    },
    extend: {
      spacing: { sm: 'var(--space-sm)', md: 'var(--space-md)' },
      fontSize: { base: 'var(--font-base)' },

      // Fuente base para body -> font-sans
      fontFamily: {
        sans: ['Inter', ...fontFamily.sans],
        inter: ['Inter', ...fontFamily.sans],
        manrope: ['Manrope', ...fontFamily.sans],
      },

      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },

      // Animaciones que ya tenías
      animation: {
        gradient: 'gradient 10s linear infinite',
        'gradient-subtle': 'gradient-subtle 8s ease-in-out infinite',
      },
      keyframes: {
        gradient: { '0%': { backgroundPosition: '300% 50%' }, '100%': { backgroundPosition: '0% 50%' } },
        'gradient-subtle': {
          '0%,100%': { backgroundPosition: '0% 50%', backgroundSize: '200% auto', opacity: 0.9 },
          '50%': { backgroundPosition: '100% 50%', backgroundSize: '200% auto', opacity: 1 },
        },
      },

      // ← mapeo de tokens con alpha-value para bg-*/text-*/ring-*/…/10
      colors: {
        border: 'hsl(var(--border) / <alpha-value>)',
        input: 'hsl(var(--input) / <alpha-value>)',
        ring: 'hsl(var(--ring) / <alpha-value>)',
        background: 'hsl(var(--background) / <alpha-value>)',
        foreground: 'hsl(var(--foreground) / <alpha-value>)',
        primary: {
          DEFAULT: 'hsl(var(--primary) / <alpha-value>)',
          foreground: 'hsl(var(--primary-foreground) / <alpha-value>)',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary) / <alpha-value>)',
          foreground: 'hsl(var(--secondary-foreground) / <alpha-value>)',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive) / <alpha-value>)',
          foreground: 'hsl(var(--destructive-foreground) / <alpha-value>)',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted) / <alpha-value>)',
          foreground: 'hsl(var(--muted-foreground) / <alpha-value>)',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent) / <alpha-value>)',
          foreground: 'hsl(var(--accent-foreground) / <alpha-value>)',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover) / <alpha-value>)',
          foreground: 'hsl(var(--popover-foreground) / <alpha-value>)',
        },
        card: {
          DEFAULT: 'hsl(var(--card) / <alpha-value>)',
          foreground: 'hsl(var(--card-foreground) / <alpha-value>)',
        },
        chart: {
          1: 'hsl(var(--chart-1) / <alpha-value>)',
          2: 'hsl(var(--chart-2) / <alpha-value>)',
          3: 'hsl(var(--chart-3) / <alpha-value>)',
          4: 'hsl(var(--chart-4) / <alpha-value>)',
          5: 'hsl(var(--chart-5) / <alpha-value>)',
        },
        sidebar: {
          DEFAULT: 'hsl(var(--sidebar-background) / <alpha-value>)',
          foreground: 'hsl(var(--sidebar-foreground) / <alpha-value>)',
          primary: 'hsl(var(--sidebar-primary) / <alpha-value>)',
          'primary-foreground': 'hsl(var(--sidebar-primary-foreground) / <alpha-value>)',
          accent: 'hsl(var(--sidebar-accent) / <alpha-value>)',
          'accent-foreground': 'hsl(var(--sidebar-accent-foreground) / <alpha-value>)',
          border: 'hsl(var(--sidebar-border) / <alpha-value>)',
          ring: 'hsl(var(--sidebar-ring) / <alpha-value>)',
        },
      },

      boxShadow: { card: '0 1px 2px rgba(0,0,0,.06)' },
    },
  },
  plugins: [tailwindcssAnimate],
}