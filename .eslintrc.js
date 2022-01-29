module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: {
    project: './tsconfig.json',
    tsconfigRootDir: __dirname,
  },
  plugins: ['@typescript-eslint', 'deprecation', 'quick-prettier'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/eslint-recommended',
    'plugin:@typescript-eslint/recommended',
    'prettier',
  ],
  rules: {
    // recommended for safety
    '@typescript-eslint/no-floating-promises': 'error', // forgetting to await Activities and Workflow APIs is bad
    'deprecation/deprecation': 'warn',

    // code style preference
    'object-shorthand': ['error', 'always'],

    // relaxed rules, for convenience
    '@typescript-eslint/no-unused-vars': [
      'warn',
      {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
      },
    ],
    '@typescript-eslint/no-explicit-any': 'off',

    // this happens a lot in temporal
    'no-constant-condition': 'off',

    // I'd rather it throw
    '@typescript-eslint/no-non-null-assertion': 'off',

    'quick-prettier/prettier': 1
  },
};
