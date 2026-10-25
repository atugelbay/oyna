/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#00E5FF',
          light: '#6EE7FF',
          dark: '#00A8CC',
        },
        surface: {
          DEFAULT: '#090D17',
          card: '#101923',
          elevated: '#182633',
          input: '#121e2a',
        },
      },
      fontFamily: {
        sans: ['Arial', 'Helvetica', 'sans-serif'],
      },
      maxWidth: {
        mobile: '960px',
      },
      boxShadow: {
        cyan: '0 0 20px rgba(0, 208, 255, 0.25)',
        'cyan-sm': '0 0 10px rgba(0, 208, 255, 0.15)',
      },
    },
  },
  plugins: [],
};
