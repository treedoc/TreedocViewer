<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue'
import { debounce } from 'lodash-es'
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'
import Button from 'primevue/button'
import ToggleButton from 'primevue/togglebutton'
import ProgressBar from 'primevue/progressbar'
import type { TDNode } from 'treedoc'

export interface FieldQuery {
  query: string
  isRegex: boolean
  isNegate: boolean
  isArray: boolean
}

export interface ColumnStatistic {
  total: number
  uniqueCount: number
  min: number | string | null
  max: number | string | null
  sum: number
  avg: number
  p50: number
  p90: number
  p99: number
  topValues: { val: string; count: number; percent: number }[]
}

const props = defineProps<{
  visible: boolean
  field: string
  title: string
  fieldQuery: FieldQuery
  filteredData: any[]
}>()

const emit = defineEmits<{
  'update:visible': [value: boolean]
  'update:fieldQuery': [query: FieldQuery]
}>()

const inputRef = ref<HTMLInputElement>()
const showStats = ref(false)
const localQuery = ref(props.fieldQuery.query)
const localIsRegex = ref(props.fieldQuery.isRegex)
const localIsNegate = ref(props.fieldQuery.isNegate)
const localIsArray = ref(props.fieldQuery.isArray)

// Sync with props
watch(() => props.fieldQuery, (fq) => {
  localQuery.value = fq.query
  localIsRegex.value = fq.isRegex
  localIsNegate.value = fq.isNegate
  localIsArray.value = fq.isArray
}, { immediate: true })

// Auto-focus input when dialog opens
watch(() => props.visible, (visible) => {
  if (visible) {
    nextTick(() => {
      inputRef.value?.focus()
    })
  }
})

function applyFilter() {
  emit('update:fieldQuery', {
    query: localQuery.value,
    isRegex: localIsRegex.value,
    isNegate: localIsNegate.value,
    isArray: localIsArray.value,
  })
}

// Debounced version for input changes
const debouncedApplyFilter = debounce(() => {
  applyFilter()
}, 300)

function close() {
  emit('update:visible', false)
}

function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter') {
    debouncedApplyFilter.cancel() // Cancel pending debounced call
    applyFilter()
    close()
  } else if (e.key === 'Escape') {
    close()
  }
}

function clearFilter() {
  localQuery.value = ''
  localIsRegex.value = false
  localIsNegate.value = false
  localIsArray.value = false
  applyFilter()
}

// Calculate column statistics
const columnStats = computed<ColumnStatistic>(() => {
  const stat: ColumnStatistic = {
    total: 0,
    uniqueCount: 0,
    min: null,
    max: null,
    sum: 0,
    avg: 0,
    p50: 0,
    p90: 0,
    p99: 0,
    topValues: [],
  }
  
  if (!showStats.value || !props.filteredData.length) return stat
  
  const valueCounts: Record<string, number> = {}
  const numericValues: number[] = []
  
  for (const row of props.filteredData) {
    stat.total++
    let val = row[props.field]
    
    // Handle TDNode
    if (val && typeof val === 'object' && 'value' in val) {
      val = (val as TDNode).value
    }
    
    if (val === undefined || val === null) val = ''
    
    // Track numeric values
    const numVal = Number(val)
    if (!isNaN(numVal) && typeof val !== 'boolean') {
      numericValues.push(numVal)
      stat.sum += numVal
      if (stat.min === null || numVal < (stat.min as number)) stat.min = numVal
      if (stat.max === null || numVal > (stat.max as number)) stat.max = numVal
    }
    
    // Track value counts
    const strVal = typeof val === 'object' ? JSON.stringify(val) : String(val)
    valueCounts[strVal] = (valueCounts[strVal] || 0) + 1
  }
  
  // Calculate averages and percentiles
  if (numericValues.length > 0) {
    numericValues.sort((a, b) => a - b)
    stat.avg = stat.sum / numericValues.length
    stat.p50 = numericValues[Math.floor(numericValues.length * 0.5)] || 0
    stat.p90 = numericValues[Math.floor(numericValues.length * 0.9)] || 0
    stat.p99 = numericValues[Math.floor(numericValues.length * 0.99)] || 0
  }
  
  // Sort by count and get top values
  const sortedKeys = Object.keys(valueCounts).sort((a, b) => valueCounts[b] - valueCounts[a])
  stat.uniqueCount = sortedKeys.length
  stat.topValues = sortedKeys.slice(0, 30).map(key => ({
    val: key,
    count: valueCounts[key],
    percent: (valueCounts[key] / stat.total) * 100,
  }))
  
  return stat
})

const hasNumericStats = computed(() => columnStats.value.sum !== 0)

function formatNumber(val: number): string {
  return val.toLocaleString(undefined, { maximumFractionDigits: 2 })
}

function copyStats() {
  const csv = columnStats.value.topValues
    .map(v => `"${v.val.replace(/"/g, '""')}",${v.count},${v.percent.toFixed(1)}%`)
    .join('\n')
  navigator.clipboard.writeText(`Value,Count,Percent\n${csv}`)
}
</script>

<template>
  <Dialog
    :visible="visible"
    @update:visible="emit('update:visible', $event)"
    :header="`Filter: ${title}`"
    :modal="true"
    :style="{ width: '420px' }"
    :dismissableMask="true"
    class="filter-dialog"
  >
    <div class="filter-content">
      <!-- Filter Input -->
      <div class="filter-input-row">
        <InputText
          ref="inputRef"
          v-model="localQuery"
          :placeholder="`Search ${field}...`"
          class="filter-input"
          @keydown="handleKeydown"
          @input="debouncedApplyFilter"
        />
        <Button
          icon="pi pi-times"
          size="small"
          text
          severity="secondary"
          @click="clearFilter"
          v-tooltip.top="'Clear filter'"
        />
      </div>
      
      <!-- Filter Options -->
      <div class="filter-options">
        <ToggleButton
          v-model="localIsNegate"
          onLabel="!="
          offLabel="!="
          @change="applyFilter"
          v-tooltip.top="'Negate filter (exclude matches)'"
          class="filter-option-btn"
        />
        <ToggleButton
          v-model="localIsRegex"
          onLabel=".*"
          offLabel=".*"
          @change="applyFilter"
          v-tooltip.top="'Regex matching'"
          class="filter-option-btn"
        />
        <ToggleButton
          v-model="localIsArray"
          onLabel="[ ]"
          offLabel="[ ]"
          @change="applyFilter"
          v-tooltip.top="'Array (comma-separated values)'"
          class="filter-option-btn"
        />
        <Button
          :icon="showStats ? 'pi pi-chevron-up' : 'pi pi-chart-bar'"
          size="small"
          :severity="showStats ? 'primary' : 'secondary'"
          text
          @click="showStats = !showStats"
          v-tooltip.top="'Show column statistics'"
        />
      </div>
      
      <!-- Statistics Panel -->
      <div v-if="showStats" class="stats-panel">
        <div class="stats-header">
          <span class="stats-title">Column Statistics</span>
          <Button
            icon="pi pi-copy"
            size="small"
            text
            @click="copyStats"
            v-tooltip.top="'Copy statistics'"
          />
        </div>
        
        <!-- Summary Stats -->
        <div class="stats-summary">
          <div class="stat-item">
            <span class="stat-label">#</span>
            <span class="stat-value">{{ columnStats.total }}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">#Unique</span>
            <span class="stat-value">{{ columnStats.uniqueCount }}</span>
          </div>
          <template v-if="hasNumericStats">
            <div class="stat-item">
              <span class="stat-label">Sum</span>
              <span class="stat-value">{{ formatNumber(columnStats.sum) }}</span>
            </div>
            <div class="stat-item">
              <span class="stat-label">Avg</span>
              <span class="stat-value">{{ formatNumber(columnStats.avg) }}</span>
            </div>
            <div class="stat-item">
              <span class="stat-label">P50</span>
              <span class="stat-value">{{ formatNumber(columnStats.p50) }}</span>
            </div>
            <div class="stat-item">
              <span class="stat-label">P90</span>
              <span class="stat-value">{{ formatNumber(columnStats.p90) }}</span>
            </div>
            <div class="stat-item">
              <span class="stat-label">P99</span>
              <span class="stat-value">{{ formatNumber(columnStats.p99) }}</span>
            </div>
            <div class="stat-item">
              <span class="stat-label">Min</span>
              <span class="stat-value">{{ columnStats.min }}</span>
            </div>
            <div class="stat-item">
              <span class="stat-label">Max</span>
              <span class="stat-value">{{ columnStats.max }}</span>
            </div>
          </template>
        </div>
        
        <!-- Top Values -->
        <div class="top-values">
          <div class="top-values-header">Top Values</div>
          <div class="top-values-list">
            <div
              v-for="(item, idx) in columnStats.topValues"
              :key="idx"
              class="top-value-item"
            >
              <div class="top-value-row">
                <span class="top-value-text" :title="item.val">{{ item.val || '(empty)' }}</span>
                <span class="top-value-count">{{ item.count }}</span>
                <span class="top-value-percent">{{ item.percent.toFixed(1) }}%</span>
              </div>
              <ProgressBar
                :value="item.percent"
                :showValue="false"
                class="top-value-bar"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
    
    <template #footer>
      <Button label="Close" severity="secondary" @click="close" />
    </template>
  </Dialog>
</template>

<style scoped>
.filter-content {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.filter-input-row {
  display: flex;
  gap: 8px;
  align-items: center;
}

.filter-input {
  flex: 1;
}

.filter-options {
  display: flex;
  gap: 8px;
  align-items: center;
}

.filter-option-btn {
  min-width: 40px;
  font-family: 'JetBrains Mono', monospace;
  font-weight: 600;
}

.stats-panel {
  background: var(--tdv-surface-light);
  border: 1px solid var(--tdv-surface-border);
  border-radius: var(--tdv-radius-sm);
  padding: 12px;
  max-height: 350px;
  overflow-y: auto;
}

.stats-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.stats-title {
  font-weight: 600;
  font-size: 0.9rem;
  color: var(--tdv-text);
}

.stats-summary {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 16px;
  margin-bottom: 12px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--tdv-surface-border);
}

.stat-item {
  display: flex;
  gap: 4px;
  font-size: 0.85rem;
}

.stat-label {
  color: var(--tdv-text-muted);
  font-weight: 500;
}

.stat-value {
  color: var(--tdv-primary);
  font-weight: 600;
  font-family: 'JetBrains Mono', monospace;
}

.top-values-header {
  font-weight: 600;
  font-size: 0.85rem;
  margin-bottom: 8px;
  color: var(--tdv-text);
}

.top-values-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.top-value-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.top-value-row {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.8rem;
}

.top-value-text {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--tdv-text);
  font-family: 'JetBrains Mono', monospace;
}

.top-value-count {
  color: var(--tdv-primary);
  font-weight: 600;
  min-width: 30px;
  text-align: right;
}

.top-value-percent {
  color: var(--tdv-success);
  font-weight: 500;
  min-width: 45px;
  text-align: right;
}

.top-value-bar {
  height: 4px;
}

.top-value-bar :deep(.p-progressbar-value) {
  background: var(--tdv-primary);
}
</style>
