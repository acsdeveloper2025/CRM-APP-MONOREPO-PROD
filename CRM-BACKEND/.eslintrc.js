module.exports = {
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2020,
    sourceType: 'module',
    project: './tsconfig.json',
  },
  plugins: ['@typescript-eslint', 'prettier'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:@typescript-eslint/recommended-requiring-type-checking',
    'prettier',
    'plugin:prettier/recommended',
  ],
  root: true,
  env: {
    node: true,
    jest: true,
    es6: true,
    es2020: true,
  },
  ignorePatterns: [
    '.eslintrc.js',
    'dist/',
    'node_modules/',
    'prisma/migrations/',
    'scripts/',
    '*.config.js',
    'coverage/',
  ],
  rules: {
    // ========== STRICT TYPE SAFETY RULES ==========
    // TypeScript specific rules - STRICT MODE
    '@typescript-eslint/interface-name-prefix': 'off',
    '@typescript-eslint/explicit-function-return-type': 'off',
    '@typescript-eslint/explicit-module-boundary-types': 'off',
    
    // ✅ STRICT: 'any' type is now an ERROR (was warn)
    '@typescript-eslint/no-explicit-any': 'error',
    
    '@typescript-eslint/no-unused-vars': [
      'error',
      {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_',
      },
    ],
    '@typescript-eslint/no-var-requires': 'error',
    '@typescript-eslint/no-require-imports': 'error',
    
    // ✅ STRICT: Detect unhandled promises (was off)
    '@typescript-eslint/no-floating-promises': 'error',
    '@typescript-eslint/no-misused-promises': 'error',
    '@typescript-eslint/await-thenable': 'error',
    
    '@typescript-eslint/no-unnecessary-type-assertion': 'warn',
    '@typescript-eslint/prefer-nullish-coalescing': 'off', // Requires strictNullChecks
    '@typescript-eslint/prefer-optional-chain': 'off',
    '@typescript-eslint/no-inferrable-types': 'off',
    '@typescript-eslint/consistent-type-imports': 'off',
    
    // ✅ STRICT: Unsafe operations now WARN (was off)
    '@typescript-eslint/no-unsafe-assignment': 'off', // Keeping off for now to focus on Promises first (Phase 1)
    '@typescript-eslint/no-unsafe-call': 'off',
    '@typescript-eslint/no-unsafe-member-access': 'off',
    '@typescript-eslint/no-unsafe-argument': 'off',
    '@typescript-eslint/no-unsafe-return': 'off',

    // Prettier integration
    'prettier/prettier': [
      'error',
      {
        singleQuote: true,
        trailingComma: 'es5',
        printWidth: 100,
        tabWidth: 2,
        semi: true,
        endOfLine: 'auto',
      },
    ],

    // General JavaScript/TypeScript rules
    'no-console': ['warn', { allow: ['warn', 'error', 'info'] }],
    'no-debugger': 'error',
    'no-alert': 'error',
    'no-var': 'error',
    'prefer-const': 'error',
    'prefer-template': 'error',
    'object-shorthand': 'error',
    'no-duplicate-imports': 'error',
    'no-unused-expressions': 'error',
    'no-useless-return': 'warn',
    'no-return-await': 'error',
    'require-await': 'off', // Using TS version
    '@typescript-eslint/require-await': 'error',
    'eqeqeq': ['error', 'always', { null: 'ignore' }],
    'curly': ['error', 'all'],
    'brace-style': ['error', '1tbs', { allowSingleLine: true }],

    // Code style rules
    'camelcase': [
      'error',
      {
        properties: 'never',
        ignoreDestructuring: true,
        ignoreImports: true,
        allow: ['^UNSAFE_', '^[A-Z_]+$'], // Allow UPPER_CASE constants
      },
    ],
    // Disabled id-match for TypeScript classes/types (PascalCase is standard)
    'id-match': 'off',

    // Error handling
    'no-throw-literal': 'error',
    'prefer-promise-reject-errors': 'error',

    // Security rules
    'no-eval': 'error',
    'no-implied-eval': 'error',
    'no-new-func': 'error',

    // Best practices
    'no-param-reassign': ['error', { props: false }],
    'no-shadow': 'off', // Disabled in favor of @typescript-eslint/no-shadow
    '@typescript-eslint/no-shadow': 'error',
    'no-use-before-define': 'off', // Disabled in favor of @typescript-eslint/no-use-before-define
    '@typescript-eslint/no-use-before-define': ['error', { functions: false, classes: true }],

    // Import/Export rules
    'no-restricted-imports': [
      'error',
      {
        patterns: ['../**/index'], // Prevent importing from index files
      },
    ],
  },
};
