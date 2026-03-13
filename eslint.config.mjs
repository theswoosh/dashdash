import tsPlugin from '@typescript-eslint/eslint-plugin';
import reactPlugin from 'eslint-plugin-react';
import reactHooksPlugin from 'eslint-plugin-react-hooks';
import globals from 'globals';

export default [
  // @typescript-eslint flat/recommended: sets up TS parser + recommended rules for .ts/.tsx
  ...tsPlugin.configs['flat/recommended'],

  // React + react-hooks rules for .ts/.tsx files
  { ...reactPlugin.configs.flat.recommended, files: ['**/*.{ts,tsx}'] },
  { ...reactHooksPlugin.configs.flat['recommended-latest'], files: ['**/*.{ts,tsx}'] },

  // Globals and project-specific rule overrides
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    settings: {
      react: { version: '18' },
    },
    rules: {
      'react/react-in-jsx-scope': 'off',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      // useThemeCard() returns a stable context ref — not a new component per render
      'react-hooks/static-components': 'off',
    },
  },
];
