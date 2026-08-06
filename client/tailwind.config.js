/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        shopify: '#96bf48',
        amazon: '#ff9900',
        navy: {
          900: '#0F172A',
          800: '#1E293B',
          700: '#334155'
        }
      }
    },
  },
  plugins: [],
}
