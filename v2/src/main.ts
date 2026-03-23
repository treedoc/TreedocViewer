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

// Handle files opened via PWA file handler
console.log('[PWA] launchQueue available:', 'launchQueue' in window)

if ('launchQueue' in window) {
  (window as any).launchQueue.setConsumer(async (launchParams: any) => {
    console.log('[PWA] launchQueue consumer called, files:', launchParams.files?.length || 0)
    
    if (!launchParams.files || launchParams.files.length === 0) {
      console.log('[PWA] No files in launchParams')
      return
    }
    
    const store = useTreeStore()
    
    for (const fileHandle of launchParams.files) {
      try {
        console.log('[PWA] Processing file handle:', fileHandle.name)
        const file = await fileHandle.getFile()
        const content = await file.text()
        console.log(`[PWA] Loaded file: ${file.name}, size: ${content.length}`)
        store.setTextImmediate(content)
        break // Only load first file
      } catch (e) {
        console.error('[PWA] Failed to load file:', e)
      }
    }
  })
} else {
  console.log('[PWA] launchQueue not available - file handler API not supported')
}
