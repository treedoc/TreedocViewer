<script setup lang="ts">
import { ref } from 'vue'
import Popover from 'primevue/popover'
import ColorPicker from 'primevue/colorpicker'

const props = defineProps<{ color: string; label: string }>()
const emit = defineEmits<{ change: [color: string] }>()
const popup = ref<InstanceType<typeof Popover> | null>(null)
const hex = ref('')

function open(event: Event) {
  // Canvas normalizes named and rgb colors already used by the chart palette.
  const context = document.createElement('canvas').getContext('2d')!
  context.fillStyle = props.color
  const color = context.fillStyle
  hex.value = color.startsWith('#') ? color.slice(1, 7) : 'f59e0b'
  popup.value?.toggle(event)
}

function update(value: unknown) {
  const next = String(value).replace(/^#/, '')
  hex.value = next
  if (/^[0-9a-f]{6}$/i.test(next)) emit('change', `#${next}`)
}
</script>

<template>
  <button type="button" class="color-swatch" :style="{ backgroundColor: color }"
    :aria-label="`Change color for ${label}`" :title="`Change color for ${label}`" @click.stop="open" />
  <Popover ref="popup">
    <div class="chart-color-picker" @keydown.esc.stop="popup?.hide()">
      <strong>{{ label }}</strong>
      <ColorPicker :model-value="hex" inline format="hex" @update:model-value="update" />
      <label>Hex color <input :value="hex" aria-label="Hex color" maxlength="7" @input="update(($event.target as HTMLInputElement).value)" /></label>
    </div>
  </Popover>
</template>

<style scoped>
.color-swatch { display: inline-block; width: 12px; height: 12px; padding: 0; border: 1px solid #8886; border-radius: 50%; cursor: pointer; vertical-align: middle; }
.color-swatch:focus-visible { outline: 2px solid var(--tdv-primary-color); outline-offset: 2px; }
.chart-color-picker { display: grid; gap: 8px; font-size: 0.8rem; max-width: 260px; }
.chart-color-picker strong { overflow-wrap: anywhere; }
.chart-color-picker label { display: flex; gap: 8px; align-items: center; }
.chart-color-picker input { width: 85px; }
</style>
