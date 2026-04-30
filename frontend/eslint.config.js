import js from "@eslint/js";
import tsparser from "@typescript-eslint/parser";
import prettier from "eslint-config-prettier";
import globals from "globals";

// NOTE: typescript-eslint plugin no incluido para mantener lint rápido.
// TypeScript checks de tipos se hacen vía `tsc -b` en el build.
// Este config solo cubre JS/JSX/TSX syntax básica + globals.

export default [
  {
    ignores: [
      "dist",
      "node_modules",
      "dev-dist",
      ".certs",
      "public",
      "*.config.js",
      "*.config.ts",
      "src/components/ui",
    ],
  },
  js.configs.recommended,
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
        ecmaFeatures: { jsx: true },
      },
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    rules: {
      "no-unused-vars": "off",
      "no-undef": "off",
      "no-empty": ["error", { allowEmptyCatch: true }],
      "no-constant-binary-expression": "warn",
      "no-redeclare": "off",
    },
  },
  prettier,
];
