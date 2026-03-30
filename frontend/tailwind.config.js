/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // MelOPark brand colours - match the presentation theme
        melopark: {
          teal: '#1A7A6D',
          'teal-light': '#2AA396',
          gold: '#B8860B',
          dark: '#1F2937',
        }
      }
    },
  },
  plugins: [],
}
