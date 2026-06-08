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
      'website/**',
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
    files: ['services/web/**/*.{js,ts,vue}'],
    languageOptions: { globals: { ...globals.browser } },
  },
  {
    // Node code (api, codegen, config files, e2e)
    files: [
      'services/api/**/*.{js,ts}',
      'packages/**/*.{js,ts}',
      'e2e/**/*.{js,ts}',
      '**/*.config.{js,ts}',
      'eslint.config.js',
    ],
    languageOptions: { globals: { ...globals.node } },
  },
  {
    // Tests
    files: ['**/tests/**', '**/*.test.{js,ts}', '**/*.spec.{js,ts}'],
    languageOptions: { globals: { ...globals.node, ...globals.vitest } },
  },
  {
    rules: {
      // Allow intentionally-unused identifiers prefixed with `_`.
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
      // Konva event objects are impractical to type precisely; `any` is used at
      // a handful of stage/timeline handlers. Keep it visible (warn) not fatal.
      '@typescript-eslint/no-explicit-any': 'warn',
      // Vue 3 REQUIRES the key on a <template v-for> tag (a pure prod build errors
      // otherwise — see CLAUDE.md). This rule contradicts that; disable it.
      'vue/no-template-key': 'off',
      // Established single-word component names (Topbar, Timeline, Inspector).
      'vue/multi-word-component-names': 'off',
      // False-positive under <script setup lang="ts">: the rule reads TS union
      // casts in template bindings (`x as A | B`) as Vue 2 filter pipes. Vue 3
      // has no filters, so the rule is moot.
      'vue/no-deprecated-filter': 'off',
    },
  },
  prettier
);
