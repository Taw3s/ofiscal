import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist', 'coverage', 'node_modules'] },
  {
    files: ['**/*.{ts,tsx}'],
    extends: [js.configs.recommended, ...tseslint.configs.strict],
    languageOptions: {
      ecmaVersion: 2022,
      globals: { ...globals.browser, ...globals.node },
    },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
      // Regra de privacidade: nada de console em código de produção
      // (evita vazar dados fiscais em logs). Scripts de CLI liberados abaixo.
      'no-console': 'error',
    },
  },
  {
    files: ['scripts/**/*.ts'],
    rules: { 'no-console': 'off' },
  },
);
