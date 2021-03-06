module.exports = {
  'env': {
    'browser' : true,
    'es2021'  : true
  },
  'extends'       : 'eslint:recommended',
  'parserOptions' : {
    'ecmaVersion' : 'latest',
    'sourceType'  : 'module'
  },
  'rules': {
    'indent': [
      2,
      2,
      { 'ArrayExpression': 'first' }
    ],
    'key-spacing': [
      1,
      { 'align': {
        'beforeColon' : true,
        'afterColon'  : true,
        'on'          : 'colon',
        'mode'        : 'strict'
      }
      }
    ],
    'linebreak-style': [
      2,
      'unix'
    ],
    'max-len': [
      2,
      {
        'code': 80
      }
    ],
    'quotes': [
      2,
      'single'
    ],
    'semi': [
      2,
      'never'
    ]
  }
}
