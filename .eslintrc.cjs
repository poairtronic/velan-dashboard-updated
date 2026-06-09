module.exports = {
  root: true,
  env: { browser: true, es2020: true, node: true },
  extends: [
    'eslint:recommended',
    'plugin:react/recommended',
    'plugin:react/jsx-runtime',
    'plugin:react-hooks/recommended',
    'plugin:import/recommended',
  ],
  ignorePatterns: ['dist', '.eslintrc.cjs', 'build', 'coverage'],
  parserOptions: { ecmaVersion: 'latest', sourceType: 'module' },
  settings: { 
    react: { version: '18.2' },
    'import/resolver': {
      node: {
        extensions: ['.js', '.jsx', '.ts', '.tsx']
      }
    }
  },
  plugins: ['import'],
  rules: {
    'no-unused-vars': 'warn',
    'react/prop-types': 'off',
    'import/no-unresolved': 'off',
    'no-useless-escape': 'warn',
    'no-empty': 'warn',
    'no-inner-declarations': 'warn'
  },
}
