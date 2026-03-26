const { FlatCompat } = require('@eslint/eslintrc');
const js = require('@eslint/js');

const compat = new FlatCompat({
  baseDirectory: __dirname,
  resolvePluginsRelativeTo: __dirname,
  recommendedConfig: js.configs.recommended,
  allConfig: js.configs.all,
});

const legacyConfig = require('./.eslintrc.js');

module.exports = [
  {
    ignores: [
      '**/*.js',
      '**/*.cjs',
      '**/*.mjs',
      'dist/**',
      'node_modules/**',
      'coverage/**',
      'prisma/migrations/**',
      'scripts/**',
      '**/*.test.ts',
      '**/*.spec.ts',
      'vitest.config.ts',
    ],
  },
  ...compat.config(legacyConfig),
];
