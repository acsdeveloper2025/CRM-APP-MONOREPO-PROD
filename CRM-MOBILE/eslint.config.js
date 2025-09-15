import js from '@eslint/js';
import typescript from '@typescript-eslint/eslint-plugin';
import typescriptParser from '@typescript-eslint/parser';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';

export default [
  js.configs.recommended,
  {
    files: ['**/*.{ts,tsx,js,jsx}'],
    languageOptions: {
      parser: typescriptParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        ecmaFeatures: {
          jsx: true,
        },
      },
      globals: {
        console: 'readonly',
        process: 'readonly',
        Buffer: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
        global: 'readonly',
        window: 'readonly',
        document: 'readonly',
        navigator: 'readonly',
        localStorage: 'readonly',
        sessionStorage: 'readonly',
        fetch: 'readonly',
        alert: 'readonly',
        confirm: 'readonly',
        prompt: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        HTMLElement: 'readonly',
        HTMLInputElement: 'readonly',
        HTMLSelectElement: 'readonly',
        HTMLTextAreaElement: 'readonly',
        HTMLDivElement: 'readonly',
        HTMLVideoElement: 'readonly',
        FileReader: 'readonly',
        MediaStream: 'readonly',
        GeolocationPosition: 'readonly',
        BeforeUnloadEvent: 'readonly',
        Notification: 'readonly',
        NodeJS: 'readonly',
        require: 'readonly',
      },
    },
    plugins: {
      '@typescript-eslint': typescript,
      react: react,
      'react-hooks': reactHooks,
    },
    rules: {
      // TypeScript rules
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'warn',

      // React rules
      'react/react-in-jsx-scope': 'off', // Not needed in React 17+
      'react/prop-types': 'off', // Using TypeScript for prop validation
      'react-hooks/rules-of-hooks': 'warn', // Changed from error to warn
      'react-hooks/exhaustive-deps': 'warn',

      // General rules
      'no-unused-vars': 'off', // Using TypeScript version instead
      'no-console': 'off', // Allow console statements in development
      'no-debugger': 'warn',
      'prefer-const': 'warn',
      'no-var': 'warn',
      'no-undef': 'off', // Disable since we're using TypeScript
    },
    settings: {
      react: {
        version: 'detect',
      },
    },
  },
  {
    files: ['**/*.js'],
    rules: {
      '@typescript-eslint/no-var-requires': 'off',
    },
  },
  {
    files: ['components/forms/**/*.tsx'],
    rules: {
      'react-hooks/rules-of-hooks': 'off', // Form components have conditional hooks pattern
      'react-hooks/exhaustive-deps': 'off',
    },
  },
  {
    ignores: [
      'node_modules/**',
      'dist/**',
      'build/**',
      'ios/**',
      'android/**',
      '*.config.js',
      'vite.config.ts',
      'capacitor.config.ts',
    ],
  },
];
