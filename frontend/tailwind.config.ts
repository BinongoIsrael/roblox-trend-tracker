import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        mono: [
          "var(--font-geist-mono)",
          "ui-monospace",
          "SFMono-Regular",
          "Menlo",
          "Monaco",
          "Consolas",
          "Liberation Mono",
          "Courier New",
          "monospace",
        ],
      },
      boxShadow: {
        pixel: "3px 3px 0px 0px rgba(0, 0, 0, 1)",
        "pixel-lg": "5px 5px 0px 0px rgba(0, 0, 0, 1)",
        "pixel-dark": "3px 3px 0px 0px rgba(255, 255, 255, 0.2)",
        "pixel-dark-lg": "5px 5px 0px 0px rgba(255, 255, 255, 0.2)",
      },
    },
  },
  plugins: [],
};

export default config;
