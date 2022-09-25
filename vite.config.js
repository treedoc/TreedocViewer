import {defineConfig} from 'vite';

export default defineConfig({
  test: {
    globals: true,
    // setupFiles: 'src/setupTests.js',
  },
  resolve: {
    alias: [
      { find: '@', replacement: 'src' },
    ],
  },
});