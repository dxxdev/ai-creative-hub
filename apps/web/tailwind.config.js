/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Signature palette — "Prompt Lab" konsepti: ink navy + marigold accent,
        // odatiy cream/near-black/broadsheet default'lardan qochilgan.
        ink: {
          DEFAULT: "#141B2E",
          light: "#232C45",
        },
        paper: {
          DEFAULT: "#EEF1F5",
          dim: "#E2E6ED",
        },
        marigold: {
          DEFAULT: "#F2A63B",
          dim: "#C9832A",
        },
        slate: {
          soft: "#5B6472",
        },
      },
      fontFamily: {
        display: ["'Fraunces'", "serif"],
        body: ["'Inter'", "sans-serif"],
        mono: ["'IBM Plex Mono'", "monospace"],
      },
    },
  },
  plugins: [],
};