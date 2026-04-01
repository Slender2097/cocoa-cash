/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx}",
    "./src/components/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        space: "#14251f",
        surface: "#1e3a32",
        neon: "#4ff4c6",
        pulse: "#a3ffe0",
        text: "#e8fff7",
        subtle: "#2de8b8",
      },
      boxShadow: {
        neon: "0 0 25px -5px rgb(79 244 198)",
        holographic: "0 0 40px -10px rgb(163 255 224)",
      },
    },
  },
  plugins: [],
};