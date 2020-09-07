module.exports = {
  moduleFileExtensions: [
    'js',
    'jsx',
    'json',
    'vue',
    'ts',
    'tsx'
  ],
  transform: {
    '^.+\\.vue$': 'vue-jest',
    '.+\\.(css|styl|less|sass|scss|svg|png|jpg|ttf|woff|woff2)$': 'jest-transform-stub',
    '^.+\\.tsx?$': 'ts-jest'
  },
  transformIgnorePatterns: [
    '/node_modules/'
  ],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1'
  },
  snapshotSerializers: [
    'jest-serializer-vue'
  ],
  testMatch: [
    '**/tests/unit/**/*.spec.(js|jsx|ts|tsx)|**/__tests__/*.(js|jsx|ts|tsx)'
  ],
  testURL: 'http://localhost/',
  watchPlugins: [
    'jest-watch-typeahead/filename',
    'jest-watch-typeahead/testname'
  ],
  collectCoverage: true,
  collectCoverageFrom: [
    'src/**/*.{js,vue,ts}',
    '!src/main.js', // No need to cover bootstrap file
    '!src/components/td-Key1.vue', // Cause error ERROR: 'import' and 'export' may only appear at the top level (11:0), from babylon
    '!src/components/th-Filter.vue', // Cause error
    '!src/components/td-Value.vue', // Cause error    
  ],
}
