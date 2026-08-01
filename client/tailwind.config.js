/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        navy: {
          950: "#0F1B33",
          800: "#1C2F52",
          700: "#28406B",
        },
        ink: "#142238",
        paper: "#F7F4EC",
        "paper-dim": "#EDE8DA",
        amber: {
          500: "#F5A623",
          600: "#DB8F14",
        },
        stub: {
          500: "#E1473C",
          600: "#C13930",
        },
      },
      fontFamily: {
        display: ["'Bebas Neue'", "sans-serif"],
        body: ["'IBM Plex Sans'", "sans-serif"],
        mono: ["'IBM Plex Mono'", "monospace"],
      },
      backgroundImage: {
        "marquee-glow":
          "radial-gradient(ellipse at 50% -20%, rgba(245,166,35,0.25), rgba(15,27,51,0) 60%)",
      },
    },
  },
  plugins: [],
};
