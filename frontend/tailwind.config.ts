import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: "var(--bg)",
        surface: "var(--surface)",
        "surface-raised": "var(--surface-raised)",
        "border-col": "var(--border)",
        "border-bright": "var(--border-bright)",
        tx: "var(--text)",
        "tx-2": "var(--text-2)",
        "tx-3": "var(--text-3)",
        accent: "var(--accent)",
        red: "var(--red)",
        green: "var(--green)",
        gold: "var(--gold)",
      },
      fontFamily: {
        display: ["Georgia", "Book Antiqua", "Palatino Linotype", "serif"],
        body:    ["system-ui", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "sans-serif"],
        ui:      ["system-ui", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "sans-serif"],
        gothic:  ["Georgia", "Book Antiqua", "Palatino", "serif"],
      },
    },
  },
  plugins: [],
};

export default config;
