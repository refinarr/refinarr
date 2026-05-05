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
      // Forbid comparing against the ArrType / ScoringMode literals directly
      // (e.g. `inst.type === "radarr"` or `mode === "profile"`). Use a
      // type-keyed registry instead — see mediaServiceFor, ArrClientFactory,
      // SCORE_FOR / ISSUES_FOR in src/shared/scoring-mode.ts. Adding a new
      // arr or scoring mode then needs one entry per registry; no
      // conditional churn across the codebase.
      "no-restricted-syntax": [
        "warn",
        {
          selector: "BinaryExpression[operator='==='] > Literal[value='radarr']",
          message: "Do not compare against the \"radarr\" literal. Use a type-keyed registry (mediaServiceFor / ArrClientFactory / a Record<ArrType, …>).",
        },
        {
          selector: "BinaryExpression[operator='==='] > Literal[value='sonarr']",
          message: "Do not compare against the \"sonarr\" literal. Use a type-keyed registry (mediaServiceFor / ArrClientFactory / a Record<ArrType, …>).",
        },
        {
          selector: "BinaryExpression[operator='==='] > Literal[value='profile']",
          message: "Do not compare against the \"profile\" scoring-mode literal. Use SCORE_FOR / ISSUES_FOR / ISSUES_HEADER_KEY from @/shared/scoring-mode.",
        },
        {
          selector: "BinaryExpression[operator='==='] > Literal[value='manual']",
          message: "Do not compare against the \"manual\" scoring-mode literal. Use SCORE_FOR / ISSUES_FOR / ISSUES_HEADER_KEY from @/shared/scoring-mode.",
        },
      ],
    },
  },
  // Tests are allowed to repeat literals, have looser complexity budgets,
  // and intentionally overwrite collection keys to verify replacement paths.
  // They also assert ArrType / ScoringMode literals via expect() — that's
  // a comparison shape but not a domain branch.
  {
    files: ["**/__tests__/**", "**/*.test.{ts,tsx}", "e2e/**", "src/test/**"],
    rules: {
      "sonarjs/no-duplicate-string": "off",
      "sonarjs/no-identical-functions": "off",
      "sonarjs/cognitive-complexity": "off",
      "sonarjs/no-element-overwrite": "off",
      "no-restricted-syntax": "off",
    },
  },
  // Registry / factory files legitimately reference the literals as keys
  // and must enumerate them. The forbidden pattern is comparing AGAINST
  // them, which these files don't do.
  {
    files: [
      "src/server/services/media-services.ts",
      "src/server/clients/ArrClientFactory.ts",
      "src/shared/scoring-mode.ts",
      "src/shared/arr-type.ts",
    ],
    rules: {
      "no-restricted-syntax": "off",
    },
  },
  // shadcn-installed primitives in src/client/components/ui are vendored and
  // would be clobbered by future `shadcn add` updates. Don't lint their style.
  {
    files: ["src/client/components/ui/**"],
    rules: {
      "sonarjs/no-nested-conditional": "off",
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
