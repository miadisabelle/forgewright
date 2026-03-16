import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["tests/**/*.{test,spec}.{ts,tsx}"],
    server: {
      deps: {
        external: ["kuzu"],
      },
    },
  },
  resolve: {
    alias: {
      "@forgewright": path.resolve(__dirname, "./src"),
      "@forgewright/lib": path.resolve(__dirname, "./src/lib"),
      "@forgewright/components": path.resolve(__dirname, "./src/components"),
      "@forgewright/stores": path.resolve(__dirname, "./src/stores"),
    },
  },
});
