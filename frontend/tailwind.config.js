/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      colors: {
        brand: {
          50:  '#f0fdf9',
          100: '#ccfbef',
          200: '#99f6df',
          300: '#5ceaca',
          400: '#2dd4b0',
          500: '#1A7A6D',
          600: '#14635A',
          700: '#0f4f48',
          800: '#0d3f3a',
          900: '#0a332f',
          DEFAULT: '#1A7A6D',
          light: '#2AA396',
          dark: '#14635A',
        },
        trap: {
          50:  '#fff7ed',
          100: '#ffedd5',
          200: '#fed7aa',
          300: '#fdba74',
          400: '#fb923c',
          500: '#f97316',
          DEFAULT: '#f97316',
        },
        danger: {
          50:  '#fef2f2',
          100: '#fee2e2',
          200: '#fecaca',
          400: '#f87171',
          500: '#ef4444',
          600: '#dc2626',
          DEFAULT: '#ef4444',
        },
        surface: {
          DEFAULT: '#ffffff',
          secondary: '#f9fafb',
          tertiary: '#f3f4f6',
          dark: '#111827',
          'dark-secondary': '#1f2937',
          'dark-tertiary': '#374151',
        },
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.25rem',
        '4xl': '1.5rem',
      },
      boxShadow: {
        'sheet': '0 -8px 40px rgba(0,0,0,0.14)',
        'card': '0 2px 10px rgba(0,0,0,0.1)',
        'card-lg': '0 8px 32px rgba(0,0,0,0.10)',
        'overlay': '0 4px 20px rgba(0,0,0,0.12)',
      },
      animation: {
        'pulse-dot': 'pulse-dot 2s ease-in-out infinite',
      },
      keyframes: {
        'pulse-dot': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.35' },
        },
      },
    },
  },
  plugins: [],
}
