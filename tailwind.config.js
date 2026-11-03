/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        navy: {
          50: '#EEF2F8',
          100: '#D5DCE9',
          200: '#A9B6CE',
          300: '#7384A8',
          400: '#4A6190',
          500: '#2F4670',
          600: '#22365A',
          700: '#182843',
          800: '#101C30',
          900: '#0A1322',
          950: '#060D1A',
        },
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        glow: '0 0 40px -8px rgba(16, 185, 129, 0.45)',
        card: '0 1px 0 0 rgba(255, 255, 255, 0.04) inset, 0 20px 40px -20px rgba(0, 0, 0, 0.6)',
      },
    },
  },
  plugins: [],
};
