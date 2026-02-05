import { defineStore } from 'pinia'
import { ref, watch } from 'vue'

export const useThemeStore = defineStore('theme', () => {
  // Check for saved preference or system preference
  const getInitialTheme = (): boolean => {
    const saved = localStorage.getItem('tdv-dark-mode')
    if (saved !== null) {
      return saved === 'true'
    }
    // Check system preference
    return window.matchMedia('(prefers-color-scheme: dark)').matches
  }

  const isDarkMode = ref(getInitialTheme())

  function toggleTheme() {
    isDarkMode.value = !isDarkMode.value
  }

  function setDarkMode(value: boolean) {
    isDarkMode.value = value
  }

  // Apply theme to document
  function applyTheme() {
    const root = document.documentElement
    if (isDarkMode.value) {
      root.classList.add('dark-mode')
    } else {
      root.classList.remove('dark-mode')
    }
    // Save preference
    localStorage.setItem('tdv-dark-mode', String(isDarkMode.value))
  }

  // Watch for changes and apply
  watch(isDarkMode, () => {
    applyTheme()
  }, { immediate: true })

  // Listen for system preference changes
  if (typeof window !== 'undefined') {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
      // Only auto-switch if user hasn't manually set preference
      if (localStorage.getItem('tdv-dark-mode') === null) {
        isDarkMode.value = e.matches
      }
    })
  }

  return {
    isDarkMode,
    toggleTheme,
    setDarkMode,
    applyTheme,
  }
})
