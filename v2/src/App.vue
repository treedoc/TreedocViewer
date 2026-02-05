<script setup lang="ts">
import Toast from 'primevue/toast'
</script>

<template>
  <Toast position="bottom-right" />
  <router-view />
</template>

<style>
html, body, #app {
  height: 100%;
  margin: 0;
  padding: 0;
  font-family: 'Geist', 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}
</style>
