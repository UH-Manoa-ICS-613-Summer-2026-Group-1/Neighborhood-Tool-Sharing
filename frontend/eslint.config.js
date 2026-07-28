import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'
import noUnsanitized from "eslint-plugin-no-unsanitized";
import sonarjs from "eslint-plugin-sonarjs";

export default defineConfig([
  globalIgnores([
    'dist/',
    'coverage/',
    'node_modules/',
  ]),
  {
    files: ['**/*.{ts,tsx}'],
    plugins: {
      "no-unsanitized": noUnsanitized,
      sonarjs,
    },
    rules: {
      "no-unsanitized/method": "error",
      "no-unsanitized/property": "error",
      complexity: ["warn", { max: 12 }],
      "max-depth": ["warn", 4],
      "sonarjs/cognitive-complexity": ["warn", 15],
      "sonarjs/no-duplicated-branches": "warn",
      "sonarjs/no-identical-functions": "warn",
      "sonarjs/no-duplicate-string": "warn",
    },
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
    },
  },
])
