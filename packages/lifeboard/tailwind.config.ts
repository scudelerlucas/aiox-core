import type { Config } from "tailwindcss";

/**
 * OS-LIFEBOARD · E5 — Tokens de design ALMA PETRA (front-end-spec.md §1, Forma A).
 *
 * Fonte única dos tokens (navy/bone/dourado + estado). Carregado pelo Tailwind 4
 * via `@config "../../tailwind.config.ts"` em `src/app/globals.css`. O `@dev`
 * NUNCA hardcoda hex fora daqui (spec §1.4 / §0: "zero valor hardcoded").
 * Hex idênticos aos da spec §1.1 — nenhum inventado (Artigo IV — No Invention).
 */
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  darkMode: "class", // dark-only na v1.0: <html class="dark"> fixo
  theme: {
    extend: {
      colors: {
        navy: {
          950: "#060D18",
          900: "#0A1628",
          850: "#0F1E33",
          800: "#13253D",
          700: "#1C3350",
          600: "#294463",
          500: "#3A5878",
        },
        bone: {
          50: "#FDFCFA",
          100: "#F5F2EC",
          200: "#E8E3D8",
          300: "#D2C9BA",
          400: "#A9A091",
          500: "#7C7566",
        },
        gold: {
          300: "#C9AE82",
          400: "#B89A6E",
          500: "#A8895A",
          600: "#8C6F45",
          700: "#6B5433",
        },
        state: {
          success: "#4FA97B",
          "success-fg": "#7FC4A0",
          warning: "#D99A3E",
          error: "#CF5C48",
          "error-fg": "#E08472",
          neutral: "#8593A8",
        },
      },
      fontFamily: {
        sans: [
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "sans-serif",
        ],
        mono: ["ui-monospace", "SF Mono", "JetBrains Mono", "monospace"],
      },
      borderRadius: { sm: "4px", md: "8px", lg: "12px" },
      boxShadow: {
        node: "0 1px 2px rgba(0,0,0,.4)",
        panel: "0 4px 16px rgba(0,0,0,.5)",
        focus: "0 0 0 2px #B89A6E",
      },
      transitionTimingFunction: { almapetra: "cubic-bezier(.4,0,.2,1)" },
    },
  },
};

export default config;
