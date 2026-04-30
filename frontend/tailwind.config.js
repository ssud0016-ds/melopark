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
          50:  '#dce8ff',
          100: '#e9ecff',
          200: '#d7dbf7',
          300: '#b8bde9',
          400: '#9aa1d7',
          500: '#8388c6',
          600: '#686eb0',
          700: '#4d519e',
          800: '#3f4195',
          900: '#35338c',
          DEFAULT: '#35338c',
          light: '#8388c6',
          dark: '#2f2d7a',
        },
        trap: {
          50:  '#f4f6ff',
          100: '#ecefff',
          200: '#d7dbf7',
          300: '#c3c8ea',
          400: '#a2a9dc',
          500: '#8388c6',
          DEFAULT: '#8388c6',
        },
        danger: {
          50:  '#ffecec',
          100: '#ffdede',
          200: '#f8bcbc',
          400: '#ed6868',
          500: '#ed6868',
          600: '#d85b5b',
          DEFAULT: '#ed6868',
        },
        accent: {
          50: '#f7ffe9',
          100: '#efffd0',
          200: '#d9f8a8',
          300: '#c5f281',
          400: '#b3ee60',
          500: '#a3ec48',
          DEFAULT: '#a3ec48',
        },
        surface: {
          DEFAULT: '#ffffff',
          secondary: '#dce8ff',
          tertiary: '#f4f6ff',
          dark: '#111827',
          'dark-secondary': '#1f2937',
          'dark-tertiary': '#374151',
        },
        gray: {
          300: '#bcbcbc',
          400: '#9a9a9a',
          500: '#6f6f6f',
          600: '#555454',
          700: '#474646',
          900: '#393838',
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
        'map-float': '0 6px 18px rgba(0,0,0,0.12), 0 1px 3px rgba(0,0,0,0.05)',
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
