module.exports = {
  root: true,
  env: {
    node: true,
    jest: true,
  },
  extends: [
    'plugin:vue/essential',
    '@vue/airbnb',
  ],
  rules: {
    'no-console': process.env.NODE_ENV === 'production' ? 'error' : 'off',
    'no-debugger': process.env.NODE_ENV === 'production' ? 'error' : 'off',
    'max-len': ['error', { code: 200, tabWidth: 2 }],
    curly: ['off'],
    'no-plusplus': ['off'],
    'no-continue': ['off'],
    'no-multi-spaces': ['off'],
    'no-param-reassign': ['off'],
    'no-underscore-dangle': ['off'],
    'no-console': ['off'],
    'no-restricted-syntax': [
      'error',
      'ForInStatement',
      //  'ForOfStatement',  // Allow ForOfStatement
      'LabeledStatement',
      'WithStatement',
    ],
  },
  parserOptions: {
    parser: 'babel-eslint',
    ecmaVersion: 7,
  },

};
