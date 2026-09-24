import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#0E6E66',
          soft: '#E3F0EE',
          hover: '#0B5952',
        },
        bg: '#F3F6F5',
        surface: '#FFFFFF',
        border: '#DCE4E2',
        text: {
          DEFAULT: '#1C2B2E',
          muted: '#5A6B6F',
          soft: '#3F5055',
        },
        danger: {
          DEFAULT: '#A9392A',
          soft: {
            bg: '#FBE6E2',
            fg: '#9E3322',
          },
        },
        eval: {
          si: { bg: '#E3F1E6', fg: '#256B40' },
          no: { bg: '#FBE6E2', fg: '#9E3322' },
          parcial: { bg: '#E3EBF8', fg: '#2B559A' },
        },
        estado: {
          enRevision: { bg: '#FBF0D6', fg: '#7A560C' },
          requierePropuesta: { bg: '#DDEEF9', fg: '#1B5A86' },
          completo: { bg: '#F1E4F2', fg: '#7E3579' },
        },
        chart: {
          1: '#0A8F80',
          2: '#3E6FC2',
          3: '#C27A1A',
          4: '#2B7FD0',
          5: '#A04A9C',
        },
        toast: {
          bg: '#E3F1E6',
          fg: '#256B40',
        },
      },
      fontFamily: {
        serif: ['"Source Serif 4"', 'Georgia', 'serif'],
        sans: ['Figtree', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        control: '10px',
        card: '14px',
        pill: '999px',
      },
      boxShadow: {
        float: '0 12px 30px rgba(15,40,38,.14)',
        focus: '0 0 0 3px rgba(14,110,102,.15)',
      },
      minHeight: {
        control: '44px',
      },
      transitionDuration: {
        DEFAULT: '180ms',
      },
    },
  },
  plugins: [],
} satisfies Config
