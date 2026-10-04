module.exports = {
  transform: {
    '^.+\\.js$': ['babel-jest', {
      plugins: [
        '@babel/plugin-transform-export-namespace-from',
        '@babel/plugin-transform-modules-commonjs'
      ]
    }]
  },
  transformIgnorePatterns: [
    '/node_modules/(?!(sanitize-html|htmlparser2|domhandler|domutils|domelementtype|dom-serializer|entities)/)'
  ]
};
