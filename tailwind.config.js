const { fabricOptimaTheme } = require('./lib/themes')

/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: [
    './pages/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './app/**/*.{ts,tsx}',
    './src/**/*.{ts,tsx}',
	],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        border: fabricOptimaTheme.colors.border,
        input: fabricOptimaTheme.colors.border,
        ring: fabricOptimaTheme.colors.ring,
        background: fabricOptimaTheme.colors.background,
        primary: fabricOptimaTheme.colors.primary,
        secondary: fabricOptimaTheme.colors.secondary,
        foreground: {
          DEFAULT: "#1E293B", // Slate-800
          muted: "#64748B", // Slate-500
        },
      },
      borderRadius: {
        lg: fabricOptimaTheme.radius.DEFAULT,
        md: "calc(0.75rem - 2px)",
        sm: "calc(0.75rem - 4px)",
      },
      boxShadow: {
        DEFAULT: fabricOptimaTheme.shadow.DEFAULT,
        lg: fabricOptimaTheme.shadow.lg,
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} 