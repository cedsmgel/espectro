/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        orkut: {
          blue: "#3b5998",
          lightBlue: "#e8eef7",
          darkBlue: "#2d4373",
          cardBg: "#f7f9fc",
          pink: "#ea5b88",
          badge: "#bfd4f2",
        },
      },
    },
  },
  plugins: [],
};
