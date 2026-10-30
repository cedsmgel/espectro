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
        // Visible Spectrum Social Design System (Stitch M3 Tokens)
        "primary": "#3525cd",
        "primary-container": "#4f46e5",
        "on-primary": "#ffffff",
        "on-primary-container": "#dad7ff",
        "primary-fixed": "#e2dfff",
        "primary-fixed-dim": "#c3c0ff",

        "secondary": "#712ae2",
        "secondary-container": "#8a4cfc",
        "on-secondary": "#ffffff",
        "on-secondary-container": "#fffbff",
        "secondary-fixed": "#eaddff",
        "secondary-fixed-dim": "#d2bbff",

        "tertiary": "#00505f",
        "tertiary-container": "#006a7c",
        "on-tertiary": "#ffffff",
        "tertiary-fixed": "#acedff",
        "tertiary-fixed-dim": "#4cd7f6",

        "surface": "#faf8ff",
        "surface-bright": "#faf8ff",
        "surface-dim": "#d2d9f4",
        "surface-tint": "#4d44e3",
        "surface-container-lowest": "#ffffff",
        "surface-container-low": "#f2f3ff",
        "surface-container": "#eaedff",
        "surface-container-high": "#e2e7ff",
        "surface-container-highest": "#dae2fd",

        "on-surface": "#131b2e",
        "on-surface-variant": "#464555",
        "outline": "#777587",
        "outline-variant": "#c7c4d8",

        "error": "#ba1a1a",
        "error-container": "#ffdad6",
        "on-error": "#ffffff",

        // Dark compatibility tokens
        dark: {
          bg: "#0d0f14",
          surface: "#13161f",
          card: "rgba(22, 27, 38, 0.7)",
          border: "rgba(255, 255, 255, 0.08)",
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
        "xs": "0 1px 2px 0 rgba(0, 0, 0, 0.05)",
        "glass": "0 8px 32px 0 rgba(0, 0, 0, 0.06)",
        "glow-primary": "0 0 20px -3px rgba(79, 70, 229, 0.35)",
        "glow-blue": "0 0 20px -3px rgba(59, 130, 246, 0.4)",
      }
    }
  },
  plugins: []
}
