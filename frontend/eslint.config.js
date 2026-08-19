import js from "@eslint/js";
import tsparser from "@typescript-eslint/parser";
import jsxA11y from "eslint-plugin-jsx-a11y";
import prettier from "eslint-config-prettier";
import globals from "globals";

// NOTE: typescript-eslint plugin no incluido para mantener lint rápido.
// TypeScript checks de tipos se hacen vía `tsc -b` en el build.
// Este config cubre JS/JSX/TSX syntax básica + globals + accesibilidad.

export default [
  {
    ignores: ["dist", "node_modules", "dev-dist", ".certs", "public", "*.config.js", "*.config.ts"],
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
  // Accessibility. The plugin shipped in devDependencies for months without
  // ever being registered here, so nothing enforced it: 53 unnamed form
  // controls, 47 unwired labels and five components with their focus ring
  // deleted all landed on main without a single lint failure. Everything below
  // is an error, not a warning — `--max-warnings 0` means the distinction is
  // cosmetic, and warnings train people to scroll past.
  {
    files: ["**/*.tsx"],
    plugins: { "jsx-a11y": jsxA11y },
    rules: {
      ...jsxA11y.flatConfigs.recommended.rules,
      // The design kit wraps native controls, so the plugin can't see through
      // to the underlying element unless we tell it what maps to what.
      "jsx-a11y/label-has-associated-control": [
        "error",
        { controlComponents: ["Input", "Textarea", "Select"], depth: 3 },
      ],
      "jsx-a11y/no-autofocus": ["error", { ignoreNonDOM: true }],
    },
    settings: {
      "jsx-a11y": {
        components: {
          Input: "input",
          Textarea: "textarea",
          Label: "label",
          Button: "button",
          RoundButton: "button",
        },
      },
    },
  },
  prettier,
];
