import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import globals from 'globals';

export default tseslint.config(
  { ignores: ['dist/**', 'node_modules/**', 'release/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: { globals: { ...globals.browser, chrome: 'readonly' } },
    plugins: { 'react-hooks': reactHooks, 'jsx-a11y': jsxA11y },
    rules: {
      ...reactHooks.configs.recommended.rules,
      ...jsxA11y.flatConfigs.recommended.rules,
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-new-func': 'error',
      'no-script-url': 'error',
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/consistent-type-imports': 'error',
      'no-restricted-globals': [
        'error',
        { name: 'fetch', message: 'Rede proibida no modo local. Veja SECURITY.md.' },
        { name: 'XMLHttpRequest', message: 'Rede proibida no modo local.' },
        { name: 'WebSocket', message: 'Rede proibida no modo local.' },
        { name: 'EventSource', message: 'Rede proibida no modo local.' },
      ],
      'no-restricted-properties': [
        'error',
        { object: 'navigator', property: 'sendBeacon', message: 'Telemetria proibida.' },
        { object: 'window', property: 'fetch', message: 'Rede proibida no modo local.' },
        { object: 'globalThis', property: 'fetch', message: 'Rede proibida no modo local.' },
      ],
    },
  },
  {
    files: ['src/tests/**/*.{ts,tsx}'],
    languageOptions: { globals: { ...globals.node } },
    rules: { 'no-restricted-globals': 'off', 'no-restricted-properties': 'off' },
  },
  {
    files: ['scripts/**/*.mjs', '*.config.{js,ts}'],
    languageOptions: { globals: { ...globals.node } },
  },
);
