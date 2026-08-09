import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

const eslintConfig = [
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    rules: {
      // The codebase still contains a small number of legacy `any` boundaries;
      // surface them without allowing warnings to conceal runtime correctness.
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_" },
      ],
      "react-hooks/exhaustive-deps": "warn",
      // Local PNG rendering is intentional; Next/Image is not required for
      // these fixed, bundled logo assets.
      "@next/next/no-img-element": "off",
      // Server-side operational logs are intentional and sanitized at call sites.
      "no-console": "off",
    },
  },
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "build/**",
      "next-env.d.ts",
      "examples/**",
      "skills/**",
      "upload/**",
      "mini-services/**",
      "tool-results/**",
      "download/**",
    ],
  },
];

export default eslintConfig;
