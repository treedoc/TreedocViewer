import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { createRouter, createWebHashHistory } from 'vue-router'
import PrimeVue from 'primevue/config'
import Aura from '@primevue/themes/aura'
import ToastService from 'primevue/toastservice'
import Tooltip from 'primevue/tooltip'

import 'primeicons/primeicons.css'
import './assets/main.css'

import App from './App.vue'
import Home from './views/Home.vue'
import { useTreeStore } from './stores/treeStore'
import { Logger } from './utils/Logger'
import {
  dispatchPwaLaunchConfig,
  parsePwaLaunchConfig,
  TDV_PWA_CONFIG_SIDECAR,
} from './utils/PwaLaunch'

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', component: Home },
  ],
})

const pinia = createPinia()
const app = createApp(App)

app.use(pinia)
app.use(router)
app.use(PrimeVue, {
  theme: {
    preset: Aura,
    options: {
      darkModeSelector: '.dark-mode',
      cssLayer: false
    }
  }
})
app.use(ToastService)
app.directive('tooltip', Tooltip)

app.mount('#app')

const logger = new Logger('PWA')

// Handle files opened via PWA file handler
logger.log('launchQueue available:', 'launchQueue' in window)

if ('launchQueue' in window) {
  let launchChain = Promise.resolve()

  async function handlePwaLaunch(launchParams: any) {
    logger.log('launchQueue consumer called:', {
      files: launchParams.files?.length || 0,
      targetURL: launchParams.targetURL,
    })

    const store = useTreeStore()

    let config = launchParams.targetURL
      ? parsePwaLaunchConfig(launchParams.targetURL)
      : null
    let dataFile: File | undefined

    for (const fileHandle of launchParams.files || []) {
      try {
        logger.log('Processing file handle:', fileHandle.name)
        const file = await fileHandle.getFile()
        if (file.name === TDV_PWA_CONFIG_SIDECAR) {
          config = parsePwaLaunchConfig(await file.text()) ?? config
        } else if (!dataFile) {
          dataFile = file
        }
      } catch (e) {
        console.error('[PWA] Failed to load file:', e)
      }
    }

    if (dataFile) {
      const content = await dataFile.text()
      logger.log(`Loaded file: ${dataFile.name}, size: ${content.length}`)
      store.setTextImmediate(content)
    }

    if (config) {
      dispatchPwaLaunchConfig(config)
    }
  }

  (window as any).launchQueue.setConsumer((launchParams: any) => {
    // File reads are asynchronous. Serialize launches so a configuration URL
    // sent immediately after a file is always applied to the newly loaded data.
    launchChain = launchChain
      .then(() => handlePwaLaunch(launchParams))
      .catch(e => console.error('[PWA] Failed to handle launch:', e))
  })
} else {
  logger.log('launchQueue not available - file handler API not supported')
}
