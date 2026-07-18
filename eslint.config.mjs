import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { FlatCompat } from "@eslint/eslintrc";

const compat = new FlatCompat({
  baseDirectory: dirname(fileURLToPath(import.meta.url)),
});

export default [
  {
    ignores: [".next/**", "node_modules/**", "out/**", "coverage/**"],
  },
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    // Platform lib predates this config and leans on `any` at graph/MCP/ceremony
    // boundaries; keep the rule advisory there, strict in app + components.
    files: ["src/lib/**"],
    rules: {
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-empty-object-type": "warn",
    },
  },
];
