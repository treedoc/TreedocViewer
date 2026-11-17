<script setup lang="ts">
import { ref } from 'vue'
import Button from 'primevue/button'
import Popover from 'primevue/popover'
import ChartColorPicker from './ChartColorPicker.vue'
import type { ChartThreshold } from '@/models/types'

const props = defineProps<{
  columns: { key: string; title: string }[]
  selectedColumns: string[]
  thresholds: ChartThreshold[]
}>()
const emit = defineEmits<{
  'update:columns': [columns: string[]]
  'update:thresholds': [thresholds: ChartThreshold[]]
}>()
const popup = ref<InstanceType<typeof Popover> | null>(null)
const drafts = ref<ChartThreshold[]>([])
const error = ref('')

function open(event: Event) {
  drafts.value = props.thresholds.map(threshold => ({ ...threshold }))
  error.value = ''
  popup.value?.toggle(event)
}

function toggleColumn(key: string, checked: boolean) {
  emit('update:columns', checked ? [...props.selectedColumns, key] : props.selectedColumns.filter(column => column !== key))
}

function addThreshold() {
  drafts.value.push({ name: `Threshold ${drafts.value.length + 1}`, value: 0, color: '#f59e0b' })
}

function applyThresholds() {
  if (drafts.value.some(threshold => !threshold.name.trim() || typeof threshold.value !== 'number' || !Number.isFinite(threshold.value))) {
    error.value = 'Each threshold needs a name and a finite numeric value.'
    return
  }
  emit('update:thresholds', drafts.value.map(threshold => ({ ...threshold, name: threshold.name.trim() })))
  popup.value?.hide()
}
</script>

<template>
  <Button icon="pi pi-sliders-h" text size="small" severity="secondary" aria-label="Legend settings"
    v-tooltip.top="'Legend settings'" @click="open" />
  <Popover ref="popup">
    <div class="legend-settings">
      <strong>Legend columns</strong>
      <div class="legend-column-picker">
        <label v-for="column in columns" :key="column.key">
          <input type="checkbox" :checked="selectedColumns.includes(column.key)"
            @change="toggleColumn(column.key, ($event.target as HTMLInputElement).checked)" /> {{ column.title }}
        </label>
      </div>
      <div class="threshold-heading"><strong>Thresholds</strong>
        <Button label="Add threshold" icon="pi pi-plus" text size="small" @click="addThreshold" />
      </div>
      <div v-if="!drafts.length" class="threshold-empty">No thresholds configured.</div>
      <div v-for="(threshold, index) in drafts" :key="index" class="threshold-editor">
        <ChartColorPicker :color="threshold.color" :label="`threshold ${index + 1}`" @change="threshold.color = $event" />
        <label>Name<input v-model="threshold.name" :aria-label="`Threshold ${index + 1} name`" /></label>
        <label>Value<input v-model.number="threshold.value" type="number" step="any" :aria-label="`Threshold ${index + 1} value`" /></label>
        <Button icon="pi pi-trash" text size="small" severity="danger" :aria-label="`Remove threshold ${index + 1}`" @click="drafts.splice(index, 1)" />
        <small v-if="threshold.start || threshold.end">{{ threshold.start || 'Any start' }} → {{ threshold.end || 'No end' }}</small>
      </div>
      <span v-if="error" role="alert">{{ error }}</span>
      <Button label="Apply thresholds" size="small" @click="applyThresholds" />
    </div>
  </Popover>
</template>

<style scoped>
.legend-settings { display: grid; gap: 10px; width: min(430px, calc(100vw - 60px)); max-height: 70vh; overflow-y: auto; font-size: 0.8rem; }
.legend-column-picker { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
.threshold-heading { display: flex; justify-content: space-between; align-items: center; border-top: 1px solid var(--tdv-surface-border); padding-top: 6px; }
.threshold-editor { display: grid; grid-template-columns: 18px minmax(0, 1fr) 95px 30px; gap: 6px; align-items: center; }
.threshold-editor label { display: grid; gap: 3px; }
.threshold-editor input { width: 100%; min-width: 0; box-sizing: border-box; border: 1px solid var(--tdv-surface-border); border-radius: 4px; background: var(--tdv-surface); color: var(--tdv-text); padding: 5px; }
.threshold-editor small { grid-column: 2 / -1; color: var(--tdv-text-muted); }
[role=alert] { color: var(--tdv-danger, #dc2626); }
</style>
