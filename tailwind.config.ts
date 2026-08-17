import type { Config } from 'tailwindcss';

/**
 * Charte graphique Kerplus.
 * Vert forêt #1A4D2E, orange #FF8C42, beige #F5EFE6, blanc #FFFFFF.
 */
const config: Config = {
  content: ['./src/app/**/*.{ts,tsx}', './src/components/**/*.{ts,tsx}', './src/lib/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        forest: {
          50: '#EEF5F0',
          100: '#D6E7DC',
          200: '#AECFB9',
          300: '#7FB292',
          400: '#4F8E68',
          500: '#2C6942',
          600: '#1A4D2E',
          700: '#153E25',
          800: '#102E1C',
          900: '#0A1F13',
        },
        ember: {
          50: '#FFF4EC',
          100: '#FFE4D0',
          200: '#FFC9A3',
          300: '#FFAB72',
          400: '#FF8C42',
          500: '#F2761F',
          600: '#D25E10',
          700: '#A6480C',
          800: '#7A340A',
          900: '#4F2107',
        },
        sand: {
          50: '#FDFBF7',
          100: '#F5EFE6',
          200: '#EADFCD',
          300: '#DCCBB1',
          400: '#C8B393',
          500: '#AE9673',
        },
        ink: {
          DEFAULT: '#1B1B1B',
          soft: '#4A4A4A',
          muted: '#6B6B6B',
        },
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 2px rgba(16, 46, 28, 0.06), 0 8px 24px -12px rgba(16, 46, 28, 0.18)',
        raised: '0 2px 4px rgba(16, 46, 28, 0.08), 0 18px 40px -20px rgba(16, 46, 28, 0.35)',
      },
      borderRadius: {
        xl: '0.875rem',
        '2xl': '1.25rem',
      },
      maxWidth: {
        content: '72rem',
      },
      keyframes: {
        'fade-in-up': {
          from: { opacity: '0', transform: 'translateY(6px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'fade-in-up': 'fade-in-up 220ms ease-out',
      },
    },
  },
  plugins: [],
};

export default config;
