/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#fff8ec',
          100: '#ffedc7',
          200: '#ffd889',
          300: '#ffbd4b',
          400: '#ffa11e',
          500: '#f97e06',
          600: '#dd5c02',
          700: '#b73f06',
          800: '#94310c',
          900: '#7a290d',
        },
      },
    },
  },
  plugins: [],
};
