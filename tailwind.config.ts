import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#1f1a17",
        paper: "#fbfaf7",
        linen: "#f0ebe4",
        clay: "#b85042",
        moss: "#586a4d",
        slate: "#4f5d64"
      },
      boxShadow: {
        soft: "0 14px 40px rgba(31, 26, 23, 0.08)"
      }
    }
  },
  plugins: []
};

export default config;
