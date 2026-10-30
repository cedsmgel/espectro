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
        dark: {
          bg: "#0d0f14",
          surface: "#13161f",
          card: "rgba(22, 27, 38, 0.7)",
          border: "rgba(255, 255, 255, 0.08)",
        },
        brand: {
          blue: "#3b82f6",
          blueDark: "#2563eb",
          blueLight: "#60a5fa",
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
        "glass": "0 8px 32px 0 rgba(0, 0, 0, 0.37)",
        "glow-blue": "0 0 20px -3px rgba(59, 130, 246, 0.4)",
        "glow-green": "0 0 20px -3px rgba(16, 185, 129, 0.4)",
      }
    }
  },
  plugins: []
}
