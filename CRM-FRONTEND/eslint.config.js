import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import react from 'eslint-plugin-react'

export default tseslint.config(
  // Global ignores
  {
    ignores: ['dist/**', 'node_modules/**', 'build/**', '*.config.js', '*.config.ts'],
  },

  // Base configuration for all TypeScript files
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      ...tseslint.configs.recommended,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
    plugins: {
      react,
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    settings: {
      react: {
        version: 'detect',
      },
    },
    rules: {
      // TypeScript specific rules - STRICT MODE ENABLED
      '@typescript-eslint/no-explicit-any': 'error', // Changed from 'warn' to 'error'
      '@typescript-eslint/no-unused-vars': ['error', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_',
      }],
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/no-non-null-assertion': 'error', // Changed from 'warn' to 'error'

      // React specific rules
      'react/react-in-jsx-scope': 'off', // Not needed in React 17+
      'react/prop-types': 'off', // Using TypeScript for prop validation
      'react/jsx-uses-react': 'off',
      'react/jsx-uses-vars': 'error',
      'react/jsx-key': ['error', { checkFragmentShorthand: true }],
      'react/jsx-no-duplicate-props': 'error',
      'react/jsx-no-undef': 'error',
      'react/no-children-prop': 'error',
      'react/no-danger-with-children': 'error',
      'react/no-deprecated': 'warn',
      'react/no-direct-mutation-state': 'error',
      'react/no-unescaped-entities': 'warn',
      'react/no-unknown-property': 'error',
      'react/self-closing-comp': 'warn',

      // React Hooks rules - STRICT MODE ENABLED
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'error', // Changed from 'warn' to 'error'

      // React Refresh rules
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],

      // General JavaScript/TypeScript rules
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'no-debugger': 'error',
      'no-alert': 'warn',
      'no-var': 'error',
      'prefer-const': 'error',
      'prefer-template': 'warn',
      'object-shorthand': 'warn',
      'no-duplicate-imports': 'error',
      'no-unused-expressions': 'error',
      'no-useless-return': 'warn',
      'eqeqeq': ['error', 'always', { null: 'ignore' }],
      'curly': ['error', 'all'],
      'brace-style': ['error', '1tbs', { allowSingleLine: true }],

      // Code style rules
      //
      // camelCase-only enforcement for the frontend. The backend was
      // flipped to camelCase in Phase B3 (camelizeRow at the pg query
      // layer), so every API response the frontend sees is already
      // camelCase. Any snake_case identifier in this codebase is
      // therefore either:
      //   (a) drift we want to catch early, or
      //   (b) an explicit exemption we need to document.
      //
      // `properties: 'always'` tightens the prior `properties: 'never'`
      // so own-object-literal keys are ALSO required to be camelCase.
      // `ignoreDestructuring: true` stays on as a safety valve for
      // destructuring shapes that come from third-party libraries
      // (react-day-picker's `range_end` etc — the calendar adapter
      // already wraps those). `ignoreImports: true` stays on so we
      // can keep importing snake_case identifiers from third-party
      // modules without a per-import eslint-disable.
      //
      // `allow` holds the documented exemptions — anything matching
      // these patterns is legal snake_case. Every entry below has a
      // real external counterpart the frontend cannot rename.
      'camelcase': ['error', {
        properties: 'always',
        ignoreDestructuring: true,
        ignoreImports: true,
        allow: [
          '^UNSAFE_',
          // Socket.IO + Firebase event names (external contract).
          '^connect_error$',
          '^permissions_updated$',
          // react-day-picker UI enum member names routed through
          // components/ui/calendar-adapter.ts.
          '^range_(start|middle|end)$',
        ],
      }],
      // Disabled id-match for React components (PascalCase is standard)
      'id-match': 'off',

      // Import/Export rules
      'no-restricted-imports': ['error', {
        patterns: ['../**/index'], // Prevent importing from index files
      }],
      // Enforce API Client Usage
      'no-restricted-globals': ['warn', {
        name: 'fetch',
        message: 'Direct fetch usage is deprecated. Please use apiService from @/services/api.'
      }],
      'no-restricted-syntax': [
        'error',
        {
          selector: "CallExpression[callee.object.name='axios'][callee.property.name='create']",
          message: "Direct axios.create() is forbidden. Use apiService from @/services/api."
        },
        {
          selector: "NewExpression[callee.name='Axios']",
          message: "Direct new Axios() is forbidden. Use apiService from @/services/api."
        }
      ],
    },
  },
  // Exempt api.ts from restriction rules
  {
    files: ['src/services/api.ts'],
    rules: {
      'no-restricted-globals': 'off',
      'no-restricted-syntax': 'off',
    }
  }
)
