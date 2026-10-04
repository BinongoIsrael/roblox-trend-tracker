import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        "brand-darkest": "#091413",
        "brand-dark": "#285A48",
        "brand-main": "#408A71",
        "brand-light": "#B0E4CC",
      },
    },
  },
  plugins: [],
};

export default config;
