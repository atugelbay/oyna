/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        "bg-primary": "#0C1218",
        "bg-secondary": "#141E2A",
        "bg-card": "#0A0F14",
        "bg-input": "#002F55",
        cyan: "#00E5FF",
        "cyan-light": "#1EA7FF",
        "cyan-pale": "#CFE9FF",
        "text-primary": "#FFFFFF",
        "text-secondary": "#9FB4C6",
        "text-muted": "#2E3F4F",
        "text-light": "#EAF6FF",
        "surface-dark": "#001417",
        "surface-border": "#2E3F4F",
        success: "#22C55E",
        danger: "#EF4444",
      },
      fontFamily: {
        sans: [
          "var(--font-ubuntu)",
          "Ubuntu",
          "ui-sans-serif",
          "system-ui",
          "sans-serif",
        ],
      },
    },
  },
  plugins: [],
};
