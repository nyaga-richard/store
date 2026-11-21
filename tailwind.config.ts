import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        ink: "#0f172a",
        brand: {
          50: "#f0fdf4",
          100: "#dcfce7",
          500: "#22a06b",
          600: "#15803d",
          700: "#166534",
        },
        accent: "#f59e0b",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "ui-sans-serif", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
} satisfies Config;
