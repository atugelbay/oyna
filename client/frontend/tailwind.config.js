/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#00D0FF',
          light: '#6EE7FF',
          dark: '#00A8CC',
        },
        surface: {
          DEFAULT: '#090D17',
          card: '#111827',
          elevated: '#1C2540',
          input: '#141B2D',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      maxWidth: {
        mobile: '430px',
      },
      boxShadow: {
        cyan: '0 0 20px rgba(0, 208, 255, 0.25)',
        'cyan-sm': '0 0 10px rgba(0, 208, 255, 0.15)',
      },
    },
  },
  plugins: [],
};
