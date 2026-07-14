/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#0B0E14",
        surface: "#131826",
        "surface-hover": "#1A2233",
        border: "#232B3D",
        ink: "#E8E6DD",
        "ink-dim": "#8B92A5",
        category: {
          problem: "#F2545B",
          theorem: "#4FD1C5",
          conjecture: "#F2B84B",
          algorithm: "#7C9CF5",
          domain: "#B69CF0",
          person: "#6FCF97",
        },
      },
      fontFamily: {
        display: ["Fraunces", "serif"],
        body: ["Inter", "sans-serif"],
        mono: ["'IBM Plex Mono'", "monospace"],
      },
    },
  },
  plugins: [],
};
