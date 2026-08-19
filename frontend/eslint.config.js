import js from "@eslint/js";
import tsparser from "@typescript-eslint/parser";
import jsxA11y from "eslint-plugin-jsx-a11y";
import reactHooks from "eslint-plugin-react-hooks";
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
  // Rules of Hooks. Like jsx-a11y below, this plugin sat in devDependencies
  // without ever being registered, so nothing checked hook usage at all.
  //
  // `rules-of-hooks` is on and clean — it catches conditional or nested hook
  // calls, which corrupt React's hook order and crash at runtime.
  //
  // `exhaustive-deps` is deliberately OFF for now. Turning it on surfaces 10
  // effects with incomplete dependency arrays:
  //
  //   agent/components/agent-voice.tsx:157            documents/hooks/use-document-blob.ts:76
  //   agent/pages/agent-chat-page.tsx:122             documents/pages/documents-page.tsx:93
  //   documents/components/camera-capture-document.tsx:299, :331
  //   documents/components/share-link-dialog.tsx:42   documents/pages/share-public-page.tsx:61
  //   shared/components/camera-capture/camera-capture.tsx:43
  //   shared/components/id-scan-capture/id-scan-capture.tsx:49
  //
  // Some are intentional run-once-on-open effects; others may be real stale
  // closures. Each needs reading before it is silenced or fixed, so enabling
  // the rule wholesale would either break the build or invite a blanket
  // disable comment. Turn it on once those ten are triaged.
  {
    files: ["**/*.{ts,tsx}"],
    plugins: { "react-hooks": reactHooks },
    rules: {
      "react-hooks/rules-of-hooks": "error",
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
