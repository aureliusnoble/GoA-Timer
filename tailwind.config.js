/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'atlantis-blue': {
          50: '#e6f1f9',
          100: '#cce3f3',
          200: '#99c7e7',
          300: '#66abdb',
          400: '#338fcf',
          500: '#0073c3',
          600: '#005c9c',
          700: '#004575',
          800: '#002e4e',
          900: '#001727',
        },
        'atlantis-teal': {
          50: '#e6f9f7',
          100: '#ccf3ef',
          200: '#99e7df',
          300: '#66dbcf',
          400: '#33cfbf',
          500: '#00c3af',
          600: '#009c8c',
          700: '#007569',
          800: '#004e46',
          900: '#002723',
        },
      },
      fontFamily: {
        'display': ['Cinzel', 'serif'],
        'sans': ['Montserrat', 'sans-serif'],
      },
    },
  },
  plugins: [],
}