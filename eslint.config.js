// ESLint flat config. Keep the rule set small and meaningful: the point is to catch mistakes,
// not to win an argument about style (Prettier owns formatting).
import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['node_modules/**', '.next/**', 'dist/**', 'coverage/**', '.tmp/**'],
  },

  js.configs.recommended,
  ...tseslint.configs.recommended,

  {
    languageOptions: {
      globals: { ...globals.node, ...globals.browser },
      parserOptions: { ecmaVersion: 2023, sourceType: 'module' },
    },
    rules: {
      // Correctness rules, not taste.
      eqeqeq: ['error', 'always'],
      'no-var': 'error',
      'prefer-const': 'error',
      'no-throw-literal': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      // A stray console.log in a server route can leak email content (D7, B4).
      'no-console': 'warn',
    },
  },

  {
    files: ['**/*.test.ts', '**/*.spec.ts', 'scripts/**/*.ts'],
    rules: {
      'no-console': 'off',
    },
  },
);
