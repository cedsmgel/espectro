/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        // Visible Spectrum Social Design System (Tokens Dinâmicos via CSS Custom Properties)
        "olive": "rgb(var(--color-brand) / <alpha-value>)",
        "primary": "rgb(var(--color-primary) / <alpha-value>)",
        "primary-container": "rgb(var(--color-primary-container) / <alpha-value>)",
        "on-primary": "rgb(var(--color-on-primary) / <alpha-value>)",
        "on-primary-container": "rgb(var(--color-on-primary-container) / <alpha-value>)",
        "primary-fixed": "#ececec",
        "primary-fixed-dim": "#d4d4d4",

        "secondary": "rgb(var(--color-secondary) / <alpha-value>)",
        "secondary-container": "rgb(var(--color-secondary-container) / <alpha-value>)",
        "on-secondary": "rgb(var(--color-on-secondary) / <alpha-value>)",
        "on-secondary-container": "rgb(var(--color-on-secondary-container) / <alpha-value>)",
        "secondary-fixed": "#ececec",
        "secondary-fixed-dim": "#d4d4d4",

        "tertiary": "rgb(var(--color-tertiary) / <alpha-value>)",
        "tertiary-container": "rgb(var(--color-tertiary-container) / <alpha-value>)",
        "on-tertiary": "#ffffff",
        "tertiary-fixed": "#e0e0e0",
        "tertiary-fixed-dim": "#bdbdbd",

        "surface": "rgb(var(--color-surface) / <alpha-value>)",
        "surface-bright": "rgb(var(--color-surface-bright) / <alpha-value>)",
        "surface-dim": "rgb(var(--color-surface-dim) / <alpha-value>)",
        "surface-tint": "#000000",
        "surface-container-lowest": "rgb(var(--color-surface-container-lowest) / <alpha-value>)",
        "surface-container-low": "rgb(var(--color-surface-container-low) / <alpha-value>)",
        "surface-container": "rgb(var(--color-surface-container) / <alpha-value>)",
        "surface-container-high": "rgb(var(--color-surface-container-high) / <alpha-value>)",
        "surface-container-highest": "rgb(var(--color-surface-container-highest) / <alpha-value>)",

        "on-surface": "rgb(var(--color-on-surface) / <alpha-value>)",
        "on-surface-variant": "rgb(var(--color-on-surface-variant) / <alpha-value>)",
        "outline": "rgb(var(--color-outline) / <alpha-value>)",
        "outline-variant": "rgb(var(--color-outline-variant) / <alpha-value>)",

        "error": "#ba1a1a",
        "error-container": "#ffdad6",
        "on-error": "#ffffff",

        // Dark compatibility tokens (All Black / Vercel style)
        dark: {
          bg: "#000000",
          surface: "#121212",
          card: "#18181b",
          border: "#27272a",
        },
        brand: {
          blue: "#4f46e5",
          blueDark: "#3525cd",
          blueLight: "#818cf8",
        },
        neon: {
          green: "#10b981",
          greenGlow: "#059669",
          cyan: "#06b6d4",
          rose: "#f43f5e",
        }
      },
      fontFamily: {
        sans: ["Inter", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "Roboto", "sans-serif"],
        display: ["Space Grotesk", "Inter", "sans-serif"],
      },
      borderRadius: {
        "xl": "0.875rem",
        "2xl": "1.25rem",
        "3xl": "1.75rem",
      },
      boxShadow: {
        // Molduras e separadores no preto e branco: só contorno, sem sombra
        "xs": "none",
        "sm": "none",
        "DEFAULT": "none",
        "md": "none",
        "glass": "none",
        "glass": "0 8px 32px 0 rgba(0, 0, 0, 0.06)",
        "glow-primary": "0 0 20px -3px rgba(37, 99, 235, 0.35)",
        "glow-blue": "0 0 20px -3px rgba(59, 130, 246, 0.4)",
      }
    }
  },
  plugins: []
}
