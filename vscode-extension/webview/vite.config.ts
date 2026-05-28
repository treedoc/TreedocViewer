import { fileURLToPath, URL } from 'node:url'
import { readFileSync } from 'node:fs'
import vue from '../../v2/node_modules/@vitejs/plugin-vue/dist/index.mjs'

const v2Root = new URL('../../v2/', import.meta.url)
const fromV2 = (path: string) => fileURLToPath(new URL(path, v2Root))
const extensionPackageJson = JSON.parse(
  readFileSync(fileURLToPath(new URL('../package.json', import.meta.url)), 'utf8')
) as { version: string }

export default {
  plugins: [vue()],
  root: fileURLToPath(new URL('.', import.meta.url)),
  base: '',
  define: {
    __TREEDOC_VIEWER_VERSION__: JSON.stringify(extensionPackageJson.version),
  },
  resolve: {
    alias: {
      '@': fromV2('src'),
      vue: fromV2('node_modules/vue/dist/vue.runtime.esm-bundler.js'),
      pinia: fromV2('node_modules/pinia/dist/pinia.mjs'),
      primevue: fromV2('node_modules/primevue'),
      '@primevue/themes': fromV2('node_modules/@primevue/themes'),
      primeicons: fromV2('node_modules/primeicons'),
    },
  },
  build: {
    outDir: '../media',
    emptyOutDir: true,
    assetsDir: 'assets',
    rollupOptions: {
      output: {
        entryFileNames: 'assets/main.js',
        chunkFileNames: 'assets/[name].js',
        assetFileNames: (assetInfo) => {
          if (assetInfo.name?.endsWith('.css')) return 'assets/main.css'
          return 'assets/[name][extname]'
        },
      },
    },
  },
}
