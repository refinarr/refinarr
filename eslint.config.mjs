import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import sonarjs from "eslint-plugin-sonarjs";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Cherry-picked sonarjs rules for finding real code smells (complexity,
  // duplication, likely bugs). The recommended preset bundles many style
  // rules that don't fit this codebase — those are intentionally omitted.
  // Reported as warnings so they surface without failing CI; use
  // `yarn smells` for a strict pass that fails on any warning.
  {
    plugins: { sonarjs: sonarjs.configs.recommended.plugins.sonarjs },
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_" },
      ],
      // Complexity
      "sonarjs/cognitive-complexity": ["warn", 15],
      "sonarjs/no-nested-conditional": "warn",
      "sonarjs/no-nested-functions": "warn",
      // Duplication
      "sonarjs/no-identical-functions": "warn",
      "sonarjs/no-duplicate-string": ["warn", { threshold: 5 }],
      // Likely bugs
      "sonarjs/no-element-overwrite": "warn",
      "sonarjs/no-identical-conditions": "warn",
      "sonarjs/no-identical-expressions": "warn",
      "sonarjs/no-collection-size-mischeck": "warn",
      "sonarjs/no-use-of-empty-return-value": "warn",
      // Dead code
      "sonarjs/no-redundant-jump": "warn",
      "sonarjs/no-unused-collection": "warn",
      "sonarjs/no-redundant-boolean": "warn",
      "sonarjs/prefer-immediate-return": "warn",
    },
  },
  // Tests are allowed to repeat literals and have looser complexity budgets.
  {
    files: ["**/__tests__/**", "**/*.test.{ts,tsx}", "e2e/**", "src/test/**"],
    rules: {
      "sonarjs/no-duplicate-string": "off",
      "sonarjs/no-identical-functions": "off",
      "sonarjs/cognitive-complexity": "off",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    ".next-e2e/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "coverage/**",
    "playwright-report/**",
    "test-results/**",
  ]),
]);

export default eslintConfig;
