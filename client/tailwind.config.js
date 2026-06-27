/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        charcoal: {
          DEFAULT: '#1a1614',
          800: '#231e1b',
          700: '#2b2522',
          600: '#3a322d',
        },
        cream: {
          DEFAULT: '#f5ead8',
          200: '#fbf4e4',
          300: '#f0e1c8',
        },
        clay: '#3a2a1f',
        accent: {
          red:    '#c0392b',
          orange: '#e67e22',
          yellow: '#f1c40f',
          green:  '#27ae60',
        },
      },
      fontFamily: {
        display: ['"Playfair Display"', 'Georgia', 'serif'],
        sans: ['"Inter"', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        xl2: '1.25rem',
      },
      boxShadow: {
        warm: '0 10px 30px -10px rgba(0,0,0,0.45)',
      },
    },
  },
  plugins: [],
};
