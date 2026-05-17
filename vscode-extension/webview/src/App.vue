<script setup lang="ts">
import { onMounted, ref } from 'vue'
import Toast from 'primevue/toast'
import { JsonTreeTable } from '../../../v2/src/lib'

type VsCodeApi = {
  postMessage(message: unknown): void
}

type WebviewMessage = {
  type: 'setDocument'
  text: string
  fileName?: string
}

declare global {
  interface Window {
    acquireVsCodeApi?: () => VsCodeApi
  }
}

const vscode = window.acquireVsCodeApi?.()
const documentText = ref('{}')
const title = ref('TreeDoc Viewer')

function loadInternalViewerUrl(href: string): boolean {
  let url: URL
  try {
    url = new URL(href, window.location.href)
  } catch {
    return false
  }

  if (url.origin !== window.location.origin || url.pathname !== window.location.pathname) {
    return false
  }

  const hashQuery = url.hash.split('?')[1]
  if (!hashQuery) return false

  const dataKey = new URLSearchParams(hashQuery).get('data')
  if (!dataKey?.startsWith('tdv_temp_')) return false

  const text = localStorage.getItem(dataKey)
  if (text === null) return false

  vscode?.postMessage({
    type: 'openDocument',
    text,
    title: 'TreeDoc Viewer: cell value',
  })
  localStorage.removeItem(dataKey)
  return true
}

onMounted(() => {
  const originalOpen = window.open.bind(window)
  window.open = (url?: string | URL, target?: string, features?: string) => {
    if (url && loadInternalViewerUrl(String(url))) {
      return null
    }

    return originalOpen(url, target, features)
  }

  window.addEventListener('message', (event: MessageEvent<WebviewMessage>) => {
    const message = event.data
    if (message?.type === 'setDocument') {
      documentText.value = message.text || '{}'
      title.value = message.fileName ? `TreeDoc Viewer: ${message.fileName}` : 'TreeDoc Viewer'
    }
  })

  document.addEventListener('click', (event) => {
    const target = event.target as HTMLElement | null
    const link = target?.closest('a[href]') as HTMLAnchorElement | null
    if (!link) return

    const href = link.href
    if (loadInternalViewerUrl(href)) {
      event.preventDefault()
      return
    }

    if (!href.startsWith('http://') && !href.startsWith('https://')) return

    event.preventDefault()
    vscode?.postMessage({ type: 'openExternal', href })
  })

  vscode?.postMessage({ type: 'ready' })
})
</script>

<template>
  <Toast position="bottom-right" />
  <main class="vscode-shell">
    <JsonTreeTable
      :key="title"
      :data="documentText"
      root-object-key="root"
    >
      <template #title>
        <div class="vscode-title">
          <i class="pi pi-sitemap"></i>
          <strong>{{ title }}</strong>
        </div>
      </template>
    </JsonTreeTable>
  </main>
</template>
