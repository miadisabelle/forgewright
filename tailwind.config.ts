import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/app/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        forge: {
          east: "#F59E0B",
          south: "#EF4444",
          west: "#3B82F6",
          north: "#8B5CF6",
        },
      },
    },
  },
  plugins: [],
};

export default config;
