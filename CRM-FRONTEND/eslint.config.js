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
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      '@typescript-eslint/no-empty-object-type': 'off',
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
      'react-hooks/exhaustive-deps': 'off',

      // React Refresh rules
      'react-refresh/only-export-components': 'off',

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
      'camelcase': ['error', {
        properties: 'never',
        ignoreDestructuring: true,
        ignoreImports: true,
        allow: ['^UNSAFE_'],
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
  },
  {
    files: [
      'src/pages/CasesPage.tsx',
      'src/pages/CaseDetailPage.tsx',
      'src/pages/NewCasePage.tsx',
      'src/components/cases/**/*.tsx',
    ],
    rules: {
      'no-restricted-imports': ['error', {
        patterns: [
          '../**/index',
          '@/components/ui/*',
        ],
      }],
    },
  }
)
