<script setup lang="ts">
import { ref, computed, watch, nextTick, onBeforeUnmount } from 'vue'
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
  isPattern: boolean
  isDisabled: boolean  // Keep filter config but don't apply
  patternFields: string[]  // Extracted field names from pattern
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
const textareaRef = ref<HTMLTextAreaElement>()
const showStats = ref(false)
const localQuery = ref(props.fieldQuery.query)
const localIsRegex = ref(props.fieldQuery.isRegex)
const localIsNegate = ref(props.fieldQuery.isNegate)
const localIsArray = ref(props.fieldQuery.isArray)
const localIsPattern = ref(props.fieldQuery.isPattern || false)
const localIsDisabled = ref(props.fieldQuery.isDisabled || false)

// Resize functionality
const dialogWidth = ref(550)
const dialogHeight = ref(500)
const isResizing = ref(false)
const resizeStartX = ref(0)
const resizeStartY = ref(0)
const resizeStartWidth = ref(0)
const resizeStartHeight = ref(0)

function startResize(e: MouseEvent) {
  e.preventDefault()
  isResizing.value = true
  resizeStartX.value = e.clientX
  resizeStartY.value = e.clientY
  resizeStartWidth.value = dialogWidth.value
  resizeStartHeight.value = dialogHeight.value
  document.addEventListener('mousemove', onResize)
  document.addEventListener('mouseup', stopResize)
}

function onResize(e: MouseEvent) {
  if (!isResizing.value) return
  const deltaX = e.clientX - resizeStartX.value
  const deltaY = e.clientY - resizeStartY.value
  dialogWidth.value = Math.max(350, Math.min(window.innerWidth * 0.9, resizeStartWidth.value + deltaX))
  dialogHeight.value = Math.max(300, Math.min(window.innerHeight * 0.9, resizeStartHeight.value + deltaY))
}

function stopResize() {
  isResizing.value = false
  document.removeEventListener('mousemove', onResize)
  document.removeEventListener('mouseup', stopResize)
}

onBeforeUnmount(() => {
  document.removeEventListener('mousemove', onResize)
  document.removeEventListener('mouseup', stopResize)
})

// Sync with props
watch(() => props.fieldQuery, (fq) => {
  localQuery.value = fq.query
  localIsRegex.value = fq.isRegex
  localIsNegate.value = fq.isNegate
  localIsArray.value = fq.isArray
  localIsPattern.value = fq.isPattern || false
  localIsDisabled.value = fq.isDisabled || false
}, { immediate: true })

// Extract field names from pattern (e.g., "Order:${orderId}" -> ["orderId"])
function extractPatternFields(pattern: string): string[] {
  const matches = pattern.matchAll(/\$\{(\w+)\}/g)
  return [...matches].map(m => m[1])
}

// Auto-focus input when dialog opens
watch(() => props.visible, (visible) => {
  if (visible) {
    nextTick(() => {
      if (localIsPattern.value) {
        textareaRef.value?.focus()
      } else {
        inputRef.value?.focus()
      }
    })
  }
})

function applyFilter() {
  const patternFields = localIsPattern.value ? extractPatternFields(localQuery.value) : []
  emit('update:fieldQuery', {
    query: localQuery.value,
    isRegex: localIsRegex.value,
    isNegate: localIsNegate.value,
    isArray: localIsArray.value,
    isPattern: localIsPattern.value,
    isDisabled: localIsDisabled.value,
    patternFields,
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

// For textarea: Enter adds newline, Ctrl+Enter applies filter
function handleTextareaKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
    e.preventDefault()
    debouncedApplyFilter.cancel()
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
  localIsPattern.value = false
  localIsDisabled.value = false
  applyFilter()
}

// Copy value to clipboard
function copyValue(value: string) {
  navigator.clipboard.writeText(value)
}

// Add value to filter (from statistics)
function addValueToFilter(value: string, isNegate: boolean) {
  // If current filter has different negate mode, override it
  if (localIsArray.value && localIsNegate.value !== isNegate) {
    localQuery.value = value
    localIsNegate.value = isNegate
    localIsArray.value = true
    localIsRegex.value = false
    localIsPattern.value = false
    applyFilter()
    return
  }
  
  // Add to existing array filter or create new one
  if (localIsArray.value && localQuery.value) {
    const existingValues = localQuery.value.split(',').map(v => v.trim())
    if (!existingValues.includes(value)) {
      existingValues.push(value)
      localQuery.value = existingValues.join(', ')
    }
  } else {
    localQuery.value = value
    localIsArray.value = true
    localIsNegate.value = isNegate
    localIsRegex.value = false
    localIsPattern.value = false
  }
  applyFilter()
}

// Preview of extracted fields from pattern
const previewPatternFields = computed(() => {
  if (!localIsPattern.value || !localQuery.value) return []
  return extractPatternFields(localQuery.value)
})

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
    :style="{ width: dialogWidth + 'px', height: dialogHeight + 'px', minWidth: '350px', minHeight: '300px' }"
    :dismissableMask="true"
    class="filter-dialog resizable-dialog"
  >
    <div class="filter-content">
      <!-- Filter Input -->
      <div class="filter-input-row">
        <!-- Use textarea for pattern mode to support multi-line text -->
        <textarea
          v-if="localIsPattern"
          ref="textareaRef"
          v-model="localQuery"
          :placeholder="`Paste multi-line pattern for ${field}...`"
          class="filter-input filter-textarea"
          @keydown="handleTextareaKeydown"
          @input="debouncedApplyFilter"
          rows="3"
        />
        <InputText
          v-else
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
          :disabled="localIsPattern"
        />
        <ToggleButton
          v-model="localIsRegex"
          onLabel=".*"
          offLabel=".*"
          @change="applyFilter"
          v-tooltip.top="'Regex matching'"
          class="filter-option-btn"
          :disabled="localIsPattern"
        />
        <ToggleButton
          v-model="localIsArray"
          onLabel="[ ]"
          offLabel="[ ]"
          @change="applyFilter"
          v-tooltip.top="'Array (comma-separated values)'"
          class="filter-option-btn"
          :disabled="localIsPattern"
        />
        <ToggleButton
          v-model="localIsPattern"
          onLabel="${}"
          offLabel="${}"
          @change="applyFilter"
          v-tooltip.top="'Pattern match with placeholders (e.g., Order:${orderId})'"
          class="filter-option-btn pattern-btn"
        />
        <div class="filter-options-separator"></div>
        <ToggleButton
          v-model="localIsDisabled"
          onIcon="pi pi-pause"
          offIcon="pi pi-pause"
          onLabel=""
          offLabel=""
          @change="applyFilter"
          v-tooltip.top="'Disable filter (keep config but don\'t apply)'"
          class="filter-option-btn disable-btn"
          :class="{ 'is-disabled-active': localIsDisabled }"
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
      
      <!-- Pattern Fields Preview -->
      <div v-if="localIsPattern && previewPatternFields.length > 0" class="pattern-preview">
        <span class="pattern-preview-label">Extracted columns:</span>
        <span v-for="field in previewPatternFields" :key="field" class="pattern-field-tag">
          {{ field }}
        </span>
      </div>
      <div v-if="localIsPattern" class="pattern-hint">
        <span v-if="localQuery && previewPatternFields.length === 0">
          Use ${name} to extract values, e.g., "Order:${orderId}"
        </span>
        <span>Ctrl+Enter to apply filter</span>
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
                <div class="top-value-actions">
                  <button 
                    class="stat-action-btn stat-copy-btn"
                    title="Copy value"
                    @click="copyValue(item.val)"
                  >
                    <i class="pi pi-copy"></i>
                  </button>
                  <button 
                    class="stat-action-btn stat-filter-in"
                    title="Filter in this value"
                    @click="addValueToFilter(item.val, false)"
                  >
                    <i class="pi pi-filter"></i>
                  </button>
                  <button 
                    class="stat-action-btn stat-filter-out"
                    title="Filter out this value"
                    @click="addValueToFilter(item.val, true)"
                  >
                    <i class="pi pi-filter-slash"></i>
                  </button>
                </div>
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
    <!-- Resize handle at dialog corner -->
    <div class="resize-handle" @mousedown="startResize"></div>
  </Dialog>
</template>

<style scoped>
/* Make dialog resizable */
:deep(.resizable-dialog) {
  display: flex;
  flex-direction: column;
  position: relative;
}

:deep(.resizable-dialog .p-dialog-content) {
  flex: 1;
  overflow: auto;
  min-height: 0;
}

.filter-content {
  display: flex;
  flex-direction: column;
  gap: 12px;
  height: 100%;
}

/* Resize handle at bottom-right corner of dialog */
.resize-handle {
  position: absolute;
  bottom: 0;
  right: 0;
  width: 16px;
  height: 16px;
  cursor: nwse-resize;
  z-index: 100;
}

/* Resize grip visual indicator */
.resize-handle::after {
  content: '';
  position: absolute;
  bottom: 3px;
  right: 3px;
  width: 8px;
  height: 8px;
  border-right: 2px solid var(--tdv-text-secondary);
  border-bottom: 2px solid var(--tdv-text-secondary);
  opacity: 0.4;
  transition: opacity 0.2s;
}

.resize-handle:hover::after {
  opacity: 0.8;
}

.filter-input-row {
  display: flex;
  gap: 8px;
  align-items: center;
}

.filter-input {
  flex: 1;
}

.filter-textarea {
  flex: 1;
  font-family: 'JetBrains Mono', 'Consolas', monospace;
  font-size: 13px;
  padding: 8px;
  border: 1px solid var(--tdv-surface-border);
  border-radius: var(--tdv-radius-sm);
  resize: vertical;
  min-height: 60px;
  background: var(--tdv-surface-light);
  color: var(--tdv-text-primary);
}

.filter-textarea:focus {
  outline: none;
  border-color: var(--tdv-primary);
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

.pattern-btn {
  min-width: 45px;
}

.filter-options-separator {
  width: 1px;
  height: 24px;
  background: var(--tdv-surface-border);
  margin: 0 4px;
}

.disable-btn {
  min-width: 36px;
}

.disable-btn.is-disabled-active {
  background: var(--tdv-warning, #f59e0b) !important;
  border-color: var(--tdv-warning, #f59e0b) !important;
  color: white !important;
}

.pattern-preview {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  padding: 8px;
  background: var(--tdv-surface-light);
  border-radius: var(--tdv-radius-sm);
  border: 1px solid var(--tdv-success);
}

.pattern-preview-label {
  font-size: 0.8rem;
  color: var(--tdv-text-muted);
}

.pattern-field-tag {
  padding: 2px 8px;
  background: var(--tdv-success);
  color: white;
  border-radius: 4px;
  font-size: 0.8rem;
  font-family: 'JetBrains Mono', monospace;
  font-weight: 500;
}

.pattern-hint {
  font-size: 0.8rem;
  color: var(--tdv-text-muted);
  font-style: italic;
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

.stats-panel {
  background: var(--tdv-surface-light);
  border: 1px solid var(--tdv-surface-border);
  border-radius: var(--tdv-radius-sm);
  padding: 12px;
  flex: 1;
  min-height: 150px;
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

.top-value-row:hover .top-value-actions {
  opacity: 1;
}

.top-value-actions {
  display: flex;
  gap: 2px;
  opacity: 0;
  transition: opacity 0.15s;
}

.stat-action-btn {
  background: transparent;
  border: none;
  cursor: pointer;
  color: var(--tdv-text-muted);
  padding: 2px 4px;
  border-radius: 3px;
  font-size: 0.75rem;
  transition: color 0.15s, background 0.15s;
  display: flex;
  align-items: center;
  justify-content: center;
}

.stat-action-btn:hover {
  background: var(--tdv-hover-bg);
}

.stat-copy-btn:hover {
  color: var(--tdv-primary);
}

.stat-filter-in:hover {
  color: var(--tdv-success);
}

.stat-filter-out:hover {
  color: var(--tdv-danger);
}

.stat-action-btn i {
  font-size: 10px;
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
