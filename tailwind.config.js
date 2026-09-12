/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: "class", // 👈 add this line
  content: [
    "./App.{js,jsx,ts,tsx}",
    "./app/**/*.{js,jsx,ts,tsx}",
    "./src/**/*.{js,jsx,ts,tsx}",
    "./components/**/*.{js,jsx,ts,tsx}",
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        brand: {
          // Foundation & Canvas
          canvas: "#F6F5FC",        // Soft Lavender background
          primary: "#5B4FD1",       // Core PayCore Royal Purple
          primaryDark: "#4335A0",   // Deep Indigo for active/hover states
          primaryLight: "#8478F5",  // Bright Purple for gradients and badges
          hero: "#150F38",          // Midnight Purple (Hero cards & FAB)
          
          // Surfaces & Borders
          card: "#FFFFFF",          // Elevated White Card surface
          cardTint: "#EEECFA",      // Soft Purple Surface tint
          border: "#E7E4F5",        // Clean Slate-Purple Boundary stroke
          
          // Typography
          dark: "#1F1B3D",          // Deep Ink Primary title text
          muted: "#7A76A6",         // Balanced Secondary text
          low: "#A6A2CE",           // Subdued/Placeholder text
          
          // Status Chips & Semantics
          success: "#1FAE5C",       // Present / Approved text
          successBg: "#E7FAEE",     // Present / Approved pill background
          warning: "#D08A0C",       // Leave / Pending text
          warningBg: "#FEF2D9",     // Leave / Pending pill background
          danger: "#E4453C",        // Off Day / Rejected text
          dangerBg: "#FDE9E8",      // Off Day / Rejected pill background
          
          // Accent Actions
          accentBlue: "#2563EB",    // Timesheet / Blue Card gradient
          accentSky: "#3B82F6",     // Payrolls / Sky Card gradient
        },
      },
      borderRadius: {
        "2xl": "16px",
        "3xl": "24px",
        "4xl": "32px",
      },
      // === ADD YOUR CUSTOM FONTS HERE ===
      fontFamily: {
        sans: ["Inter-Regular", "sans-serif"], // Makes Inter the default sans font
        medium: ["Inter-Medium", "sans-serif"],
        bold: ["Inter-Bold", "sans-serif"],
        black: ["Inter-Black", "sans-serif"],
      },
    },
  },
  plugins: [],
};