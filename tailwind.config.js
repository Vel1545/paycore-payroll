/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./App.{js,jsx,ts,tsx}",
    "./app/**/*.{js,jsx,ts,tsx}",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        brand: {
          canvas: "#a0c5f6",      // Your fixed sand/peach background
          card: "#FFFFFF",        // Crisp White Card surface
          cardTint: "#FFF4E8",    // Soft Warm Surface
          hero: "#20150F",        // Deep Espresso (High contrast hero banner)
          dark: "#0F172A",        // High contrast primary title text
          muted: "#5C4D41",       // Legible secondary/subtitle text
          border: "#E5B583",      // Warm boundary stroke
          
          // Semantic Indicators & Buttons
          primary: "#0D9488",     // Emerald Teal
          primaryDark: "#0F766E", // Deep Teal Hover/Active
          warning: "#D97706",     // Amber Notice
          danger: "#DC2626",      // Crimson Alert
        },
      },
    },
  },
  plugins: [],
};