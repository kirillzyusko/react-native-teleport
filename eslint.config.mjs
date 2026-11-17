import { fixupConfigRules, includeIgnoreFile } from "@eslint/compat";
import { FlatCompat } from "@eslint/eslintrc";
import js from "@eslint/js";
import { defineConfig } from "eslint/config";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const compat = new FlatCompat({
  baseDirectory: __dirname,
  recommendedConfig: js.configs.recommended,
  allConfig: js.configs.all,
});

export default defineConfig([
  includeIgnoreFile(path.join(__dirname, ".gitignore")),
  ...fixupConfigRules(
    compat.config({
      plugins: [
        "@typescript-eslint",
        "react",
        "react-native",
        "jest",
        "import",
        "eslint-comments",
        "prettier",
        "react-perf",
        "jsdoc",
      ],
      extends: [
        "@react-native",
        "prettier",
        "eslint:recommended",
        "plugin:@typescript-eslint/recommended",
        "plugin:jest/recommended",
        "plugin:import/typescript",
        "plugin:eslint-comments/recommended",
        "plugin:react-perf/recommended",
      ],
      settings: {
        "import/parsers": {
          "@typescript-eslint/parser": [".ts", ".tsx"],
        },
        "import/ignore": ["node_modules"],
        "import/resolver": {
          typescript: {
            alwaysTryTypes: true,
            project: "<root>/tsconfig.json",
          },
        },
      },
      rules: {
        "prettier/prettier": [
          "error",
          {
            quoteProps: "consistent",
            trailingComma: "all",
          },
        ],
        // react-hooks
        "react-hooks/exhaustive-deps": "warn",
        // react
        "react/react-in-jsx-scope": "off",
        "react/jsx-sort-props": [
          "error",
          {
            callbacksLast: true,
            shorthandFirst: true,
            shorthandLast: false,
            ignoreCase: true,
            noSortAlphabetically: false,
            reservedFirst: ["ref", "key"],
          },
        ],
        "react/jsx-no-bind": [
          "warn",
          {
            ignoreDOMComponents: false,
            ignoreRefs: false,
            allowArrowFunctions: false,
            allowFunctions: false,
            allowBind: false,
          },
        ],
        // react-perf
        "react-perf/jsx-no-new-function-as-prop": "off", // because we have jsx-no-bind
        "react-perf/jsx-no-jsx-as-prop": "warn",
        "react-perf/jsx-no-new-array-as-prop": "warn",
        "react-perf/jsx-no-new-object-as-prop": "warn",
        // typescript
        "@typescript-eslint/consistent-type-imports": [
          "error",
          { prefer: "type-imports" },
        ],
        "@typescript-eslint/no-import-type-side-effects": "error",
        // `no-var-requires` was replaced by `no-require-imports` in typescript-eslint v8
        "@typescript-eslint/no-require-imports": "warn",
        // import
        "sort-imports": [
          "error",
          {
            // sort destructure imports
            ignoreCase: false,
            ignoreDeclarationSort: true,
            ignoreMemberSort: false,
            memberSyntaxSortOrder: ["none", "all", "single", "multiple"],
            allowSeparatedGroups: true,
          },
        ],
        "import/order": [
          "error",
          {
            "groups": [
              "builtin",
              "external",
              "internal",
              "parent",
              "sibling",
              "index",
              "type",
            ],
            "alphabetize": {
              order: "asc",
              caseInsensitive: true,
            },
            "newlines-between": "always",
          },
        ],
        "import/no-cycle": ["error", { maxDepth: "∞" }],
        // jest
        "jest/expect-expect": [
          "warn",
          {
            assertFunctionNames: [
              "expect",
              "expectBitmapsToBeEqual",
              "expectElementBitmapsToBeEqual",
            ],
            additionalTestBlockFunctions: [],
          },
        ],
        // react-compiler (replacement for deprecated `eslint-plugin-react-compiler`)
        "react-hooks/static-components": "error",
        "react-hooks/use-memo": "error",
        "react-hooks/void-use-memo": "error",
        "react-hooks/preserve-manual-memoization": "error",
        "react-hooks/incompatible-library": "warn",
        "react-hooks/immutability": "error",
        "react-hooks/globals": "error",
        "react-hooks/refs": "error",
        "react-hooks/set-state-in-effect": "error",
        "react-hooks/error-boundaries": "error",
        "react-hooks/purity": "error",
        "react-hooks/set-state-in-render": "error",
        "react-hooks/unsupported-syntax": "warn",
        "react-hooks/config": "error",
        "react-hooks/gating": "error",
        // eslint-comments
        "eslint-comments/no-unused-disable": "error",
        // eslint
        "curly": "error",
        "eqeqeq": ["error", "always"], // check “===”
        "no-nested-ternary": "error",
        "padding-line-between-statements": [
          "error",
          {
            blankLine: "always",
            prev: "*",
            next: ["return", "try", "throw", "function", "for", "while", "do"],
          },
          { blankLine: "always", prev: ["const", "let", "var"], next: "*" },
          {
            blankLine: "any",
            prev: ["const", "let", "var"],
            next: ["const", "let", "var"],
          },
          { blankLine: "always", prev: "*", next: "if" },
          { blankLine: "any", prev: "if", next: "if" },
        ],
        "no-param-reassign": "error",
        "max-lines": ["warn", { max: 300 }],
      },
      overrides: [
        {
          files: ["src/specs/**"],
          rules: {
            // replacement for `ban-types` with `{}` allowed (typescript-eslint v8)
            "@typescript-eslint/no-empty-object-type": "off",
          },
        },
        {
          files: ["src/**"],
          excludedFiles: ["src/specs/**", "src/**/__tests__/**"],
          rules: {
            "jsdoc/check-access": "error",
            "jsdoc/check-alignment": "error",
            "jsdoc/check-indentation": 1,
            "jsdoc/check-line-alignment": 1,
            "jsdoc/check-param-names": "error",
            "jsdoc/check-template-names": 1,
            "jsdoc/check-property-names": "error",
            "jsdoc/check-syntax": 1,
            "jsdoc/check-tag-names": ["error", { definedTags: ["platform"] }],
            "jsdoc/check-types": "error",
            "jsdoc/check-values": "error",
            "jsdoc/empty-tags": "error",
            "jsdoc/implements-on-classes": "error",
            "jsdoc/informative-docs": 1,
            "jsdoc/match-description": 1,
            "jsdoc/multiline-blocks": "error",
            "jsdoc/no-bad-blocks": 1,
            "jsdoc/no-blank-block-descriptions": 1,
            "jsdoc/no-defaults": 1,
            "jsdoc/no-multi-asterisks": "error",
            "jsdoc/no-types": 1,
            "jsdoc/require-asterisk-prefix": 1,
            "jsdoc/require-description": 1,
            "jsdoc/require-description-complete-sentence": 1,
            "jsdoc/require-example": 1,
            "jsdoc/require-hyphen-before-param-description": 1,
            "jsdoc/require-jsdoc": "error",
            "jsdoc/require-param": "error",
            "jsdoc/require-param-description": "error",
            "jsdoc/require-param-name": "error",
            "jsdoc/require-property": "error",
            "jsdoc/require-property-description": "error",
            "jsdoc/require-property-name": "error",
            "jsdoc/require-returns": "error",
            "jsdoc/require-returns-check": "error",
            "jsdoc/require-returns-description": "error",
            "jsdoc/require-template": 1,
            "jsdoc/require-throws": 1,
            "jsdoc/require-yields": "error",
            "jsdoc/require-yields-check": "error",
            "jsdoc/sort-tags": 1,
            "jsdoc/tag-lines": ["error", "never", { startLines: 1 }],
            "jsdoc/valid-types": "error",
            "jsdoc/no-restricted-syntax": "off",
            "jsdoc/require-file-overview": "off",
            "jsdoc/no-missing-syntax": "off",
            "jsdoc/check-examples": "off",
            "jsdoc/no-undefined-types": "off",
            "jsdoc/require-param-type": "off",
            "jsdoc/require-property-type": "off",
            "jsdoc/require-returns-type": "off",
          },
        },
      ],
      env: {
        "react-native/react-native": true,
        "jest/globals": true,
      },
    }),
  ),
  // Tests-only config
  {
    files: ["**/__tests__/**/*.[jt]s?(x)", "**/?(*.)+(spec|test).[jt]s?(x)"],
    extends: fixupConfigRules(compat.extends("plugin:testing-library/react")),
  },
  {
    ignores: [
      "node_modules/",
      "lib/",
      "scripts/",
      "docs/build/",
      "docs/.docusaurus/",
    ],
  },
]);
