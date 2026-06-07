import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import vue from 'eslint-plugin-vue';
import prettier from 'eslint-config-prettier';
import globals from 'globals';

export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/node_modules/**',
      '**/coverage/**',
      'services/web/tests/helpers/**',
      '**/*.snap',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...vue.configs['flat/recommended'],
  {
    files: ['**/*.vue'],
    languageOptions: {
      parserOptions: { parser: tseslint.parser },
    },
  },
  {
    // Browser code (frontend)
    files: ['services/web/**/*.{js,vue}'],
    languageOptions: { globals: { ...globals.browser } },
  },
  {
    // Node code (api, codegen, config files, e2e)
    files: [
      'services/api/**/*.js',
      'packages/**/*.js',
      'e2e/**/*.js',
      '**/*.config.js',
      'eslint.config.js',
    ],
    languageOptions: { globals: { ...globals.node } },
  },
  {
    // Tests
    files: ['**/tests/**', '**/*.test.{js,ts}', '**/*.spec.{js,ts}'],
    languageOptions: { globals: { ...globals.node, ...globals.vitest } },
  },
  prettier
);
