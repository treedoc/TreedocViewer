module.exports = {
  root: true,
  env: {
    node: true,
  },
  'extends': [
    'plugin:vue/essential',
    '@vue/airbnb'
  ],
  rules: {
    'no-console': process.env.NODE_ENV === 'production' ? 'error' : 'off',
    'no-debugger': process.env.NODE_ENV === 'production' ? 'error' : 'off',
    'max-len': ['error', { 'code': 200, 'tabWidth': 2 }],
    'curly': ['off'],
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
