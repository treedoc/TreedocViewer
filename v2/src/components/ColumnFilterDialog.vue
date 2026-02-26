<script setup lang="ts">
import { ref, computed, watch, nextTick, onBeforeUnmount } from 'vue'
import { debounce } from 'lodash-es'
import Popover from 'primevue/popover'
import InputText from 'primevue/inputtext'
import Button from 'primevue/button'
import ToggleButton from 'primevue/togglebutton'
import ProgressBar from 'primevue/progressbar'
import type { TDNode } from 'treedoc'
import { TDNodeType, TDJSONWriter, TDJSONWriterOption } from 'treedoc'
import type { FieldQuery } from '@/models/types'

export type { FieldQuery }

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
  field: string
  title: string
  fieldQuery: FieldQuery
  filteredData: any[]
}>()

const emit = defineEmits<{
  'update:fieldQuery': [query: FieldQuery]
  'hide-column': []
}>()

// Convert a cell value to a searchable string representation
// For complex objects (TDNode or plain objects), this includes all descendants
function valueToSearchString(value: any): string {
  if (value === undefined || value === null) return ''
  
  // Handle TDNode
  if (typeof value === 'object' && 'type' in value && 'key' in value) {
    const node = value as TDNode
    if (node.type === TDNodeType.SIMPLE) {
      return String(node.value ?? '')
    }
    // For complex nodes, serialize to JSON string
    return TDJSONWriter.get().writeAsString(node, new TDJSONWriterOption())
  }
  
  // Handle plain objects/arrays
  if (typeof value === 'object') {
    return JSON.stringify(value)
  }
  
  return String(value)
}

// Popover ref for programmatic control
const popoverRef = ref()

// Expose methods for parent to control popover
function show(event: Event) {
  popoverRef.value?.show(event)
}

function hide() {
  popoverRef.value?.hide()
}

function toggle(event: Event) {
  popoverRef.value?.toggle(event)
}

function resetSize() {
  popoverWidth.value = defaultPopoverWidth
  popoverHeight.value = defaultPopoverHeight
}

defineExpose({ show, hide, toggle, resetSize })

const inputRef = ref()
const showStats = ref(false)
const localQuery = ref(props.fieldQuery.query)
const localIsRegex = ref(props.fieldQuery.isRegex)
const localIsNegate = ref(props.fieldQuery.isNegate)
const localIsArray = ref(props.fieldQuery.isArray)
const localIsPattern = ref(props.fieldQuery.isPattern || false)
const localIsDisabled = ref(props.fieldQuery.isDisabled || false)
const localIsJs = ref(!!props.fieldQuery.jsExpression && props.fieldQuery.jsExpression !== 'true')
const localExtendedFields = ref(props.fieldQuery.extendedFields || '')
const localPatternExtract = ref(props.fieldQuery.patternExtract || '')
const localPatternFilter = ref(props.fieldQuery.patternFilter || false)
const showExtendedFields = ref(false)

// Popover size and resize
const defaultPopoverWidth = 450
const defaultPopoverHeight = 420
const popoverWidth = ref(defaultPopoverWidth)
const popoverHeight = ref(defaultPopoverHeight)
const isResizing = ref(false)
const resizeStartX = ref(0)
const resizeStartY = ref(0)
const resizeStartWidth = ref(0)
const resizeStartHeight = ref(0)

function startResize(e: MouseEvent) {
  e.preventDefault()
  e.stopPropagation()
  isResizing.value = true
  resizeStartX.value = e.clientX
  resizeStartY.value = e.clientY
  resizeStartWidth.value = popoverWidth.value
  resizeStartHeight.value = popoverHeight.value
  document.addEventListener('mousemove', onResize)
  document.addEventListener('mouseup', stopResize)
}

function onResize(e: MouseEvent) {
  if (!isResizing.value) return
  const deltaX = e.clientX - resizeStartX.value
  const deltaY = e.clientY - resizeStartY.value
  popoverWidth.value = Math.max(350, Math.min(window.innerWidth * 0.9, resizeStartWidth.value + deltaX))
  popoverHeight.value = Math.max(350, Math.min(window.innerHeight * 0.8, resizeStartHeight.value + deltaY))
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
  // JS mode is active if jsExpression is set (including 'true' which means empty JS filter)
  const isJsMode = !!fq.jsExpression
  // In JS mode, the query text is stored in jsExpression, not query
  // 'true' means JS mode is on but no filter text (show empty)
  if (isJsMode) {
    localQuery.value = fq.jsExpression === 'true' ? '' : fq.jsExpression!
  } else {
    localQuery.value = fq.query
  }
  localIsRegex.value = fq.isRegex
  localIsNegate.value = fq.isNegate
  localIsArray.value = fq.isArray
  localIsPattern.value = fq.isPattern || false
  localIsDisabled.value = fq.isDisabled || false
  localIsJs.value = isJsMode
  localExtendedFields.value = fq.extendedFields || ''
  localPatternExtract.value = fq.patternExtract || ''
  localPatternFilter.value = fq.patternFilter || false
  // Auto-show/hide extended fields section based on content
  showExtendedFields.value = !!(fq.extendedFields || fq.patternExtract)
}, { immediate: true })

// Reset showStats when column changes to prevent performance issues
watch(() => props.field, () => {
  showStats.value = false
})

// Enlarge popover when stats are shown (to fit 30 values)
const statsExpandedHeight = 600
watch(showStats, (isShowing) => {
  if (isShowing && popoverHeight.value < statsExpandedHeight) {
    popoverHeight.value = statsExpandedHeight
  }
})

// Extract field names from pattern (e.g., "Order:${orderId}" -> ["orderId"], "user:$name" -> ["name"])
// Supports multiple patterns separated by newlines
function extractPatternFields(patternText: string): string[] {
  const fields: string[] = []
  const seen = new Set<string>()
  
  // Split by newlines to support multiple patterns
  const patterns = patternText.split('\n').map(p => p.trim()).filter(p => p)
  
  for (const pattern of patterns) {
    // First extract ${name} patterns
    const bracedMatches = pattern.matchAll(/\$\{(\w+)\}/g)
    for (const m of bracedMatches) {
      if (!seen.has(m[1])) {
        fields.push(m[1])
        seen.add(m[1])
      }
    }
    
    // Then extract $name patterns (not followed by {, and not already captured as ${name})
    // Remove ${...} first to avoid double-matching
    const withoutBraced = pattern.replace(/\$\{(\w+)\}/g, '')
    const simpleMatches = withoutBraced.matchAll(/\$(\w+)/g)
    for (const m of simpleMatches) {
      if (!seen.has(m[1])) {
        fields.push(m[1])
        seen.add(m[1])
      }
    }
  }
  
  return fields
}

// Focus input when popover shows
function onPopoverShow() {
  // Use setTimeout to ensure the popover is fully rendered
  setTimeout(() => {
    // Find the input element - PrimeVue Popover teleports content, so search document
    const popoverContent = document.querySelector('.column-filter-popover .p-popover-content')
    if (popoverContent) {
      const inputEl = popoverContent.querySelector('input') as HTMLInputElement
      inputEl?.focus()
    }
  }, 50)
}

function applyFilter() {
  // Extract pattern fields from the new patternExtract field
  const patternFields = localPatternExtract.value ? extractPatternFields(localPatternExtract.value) : []
  
  // When JS mode is active, store the expression (use empty string to indicate JS mode is on but no filter)
  // When query is empty in JS mode, use 'true' to indicate "no filtering" but JS mode is active
  let jsExpression: string | undefined = undefined
  if (localIsJs.value) {
    jsExpression = localQuery.value || 'true'  // 'true' means no filtering
  }
  
  emit('update:fieldQuery', {
    ...props.fieldQuery,  // Preserve valueColors and other properties
    query: localIsJs.value ? '' : localQuery.value,
    isRegex: localIsJs.value ? false : localIsRegex.value,
    isNegate: localIsJs.value ? false : localIsNegate.value,
    isArray: localIsJs.value ? false : localIsArray.value,
    isPattern: false,  // No longer used in filter options
    isDisabled: localIsDisabled.value,
    patternFields,
    extendedFields: localExtendedFields.value || undefined,
    patternExtract: localPatternExtract.value || undefined,
    patternFilter: localPatternFilter.value,
    jsExpression,
  })
}

// Debounced version for input changes (2s delay to allow selecting multiple values from statistics)
const debouncedApplyFilter = debounce(() => {
  applyFilter()
}, 1000)

function close() {
  hide()
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
  localIsJs.value = false
  // Don't clear extendedFields - user requested to preserve them
  applyFilter()
}

// Copy value to clipboard
function copyValue(value: string) {
  navigator.clipboard.writeText(value)
}

// Add value to filter (from statistics)
function addValueToFilter(value: string, isNegate: boolean) {
  // For empty values, use JS expression filter
  // Filter In (isNegate=false): show only empty values → !$ (keep falsy values)
  // Filter Out (isNegate=true): hide empty values → $ (keep truthy values)
  if (value === '') {
    localIsJs.value = true
    localQuery.value = isNegate ? '$' : '!$'
    localIsArray.value = false
    localIsNegate.value = false
    localIsRegex.value = false
    localIsPattern.value = false
    debouncedApplyFilter()
    return
  }
  
  // If current filter has different negate mode, override it
  if (localIsArray.value && localIsNegate.value !== isNegate) {
    localQuery.value = value
    localIsNegate.value = isNegate
    localIsArray.value = true
    localIsRegex.value = false
    localIsPattern.value = false
    localIsJs.value = false
    debouncedApplyFilter()
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
    localIsJs.value = false
  }
  debouncedApplyFilter()
}

// Preview of extracted fields from pattern
const previewPatternFields = computed(() => {
  if (!localPatternExtract.value) return []
  return extractPatternFields(localPatternExtract.value)
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
    const val = row[props.field]
    
    // Get string representation including all descendants for complex objects
    const strVal = valueToSearchString(val)
    
    // For numeric stats, try to get a simple numeric value
    let simpleVal: any = val
    if (val && typeof val === 'object' && 'value' in val) {
      simpleVal = (val as TDNode).value
    }
    
    // Track numeric values (only for simple values)
    if (simpleVal !== undefined && simpleVal !== null && typeof simpleVal !== 'object') {
      const numVal = Number(simpleVal)
      if (!isNaN(numVal) && typeof simpleVal !== 'boolean') {
        numericValues.push(numVal)
        stat.sum += numVal
        if (stat.min === null || numVal < (stat.min as number)) stat.min = numVal
        if (stat.max === null || numVal > (stat.max as number)) stat.max = numVal
      }
    }
    
    // Track value counts using full string representation
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
  // Compute full value counts (not just top 30) for copying
  const valueCounts: Record<string, number> = {}
  let total = 0
  
  for (const row of props.filteredData) {
    total++
    const val = row[props.field]
    // Use valueToSearchString to include all descendants for complex objects
    const strVal = valueToSearchString(val)
    valueCounts[strVal] = (valueCounts[strVal] || 0) + 1
  }
  
  // Sort by count and format all values
  const sortedKeys = Object.keys(valueCounts).sort((a, b) => valueCounts[b] - valueCounts[a])
  const csv = sortedKeys
    .map(key => {
      const count = valueCounts[key]
      const percent = (count / total) * 100
      return `"${key.replace(/"/g, '""')}",${count},${percent.toFixed(1)}%`
    })
    .join('\n')
  
  navigator.clipboard.writeText(`Value,Count,Percent\n${csv}`)
}

// Import shared value color service
import { 
  PRESET_COLORS, 
  getValueColor as getValueColorService, 
  setValueColor as setValueColorService 
} from '@/utils/ValueColorService'

const colorPickerValue = ref<string | null>(null)

function getValueColor(value: string) {
  return getValueColorService(props.field, value)
}

function setValueColor(value: string, color: { bg: string; text: string } | null) {
  setValueColorService(props.field, value, color)
  colorPickerValue.value = null
}

function toggleColorPicker(value: string) {
  if (colorPickerValue.value === value) {
    colorPickerValue.value = null
  } else {
    colorPickerValue.value = value
  }
}
</script>

<template>
  <Popover
    ref="popoverRef"
    appendTo="body"
    :baseZIndex="1100"
    @show="onPopoverShow"
    :style="{ width: popoverWidth + 'px', height: popoverHeight + 'px' }"
    class="column-filter-popover"
    :pt="{ content: { style: 'height: 100%; display: flex; flex-direction: column;' } }"
  >
    <div class="filter-content">
      <!-- Filter Input -->
      <div class="filter-input-row" :class="{ 'filter-paused': localIsDisabled }">
        <div class="filter-input-wrapper">
          <InputText
            ref="inputRef"
            v-model="localQuery"
            :placeholder="localIsJs ? 'JS expression, e.g.: $.length > 10 ($ = field value)' : `Search ${field}...`"
            class="filter-input"
            :class="{ 'js-mode-input': localIsJs }"
            :disabled="localIsDisabled"
            @keydown="handleKeydown"
            @input="debouncedApplyFilter"
          />
          <button
            v-if="localQuery"
            class="input-clear-btn"
            @click="clearFilter"
            type="button"
            tabindex="-1"
          >
            <i class="pi pi-times"></i>
          </button>
        </div>
      </div>
      
      <!-- Filter Options -->
      <div class="filter-options" :class="{ 'filter-paused': localIsDisabled, 'filter-js-mode': localIsJs }">
        <ToggleButton
          v-model="localIsNegate"
          onLabel="!"
          offLabel="!"
          @change="debouncedApplyFilter"
          v-tooltip.top="'Negate filter (exclude matches)'"
          class="filter-option-btn"
          :class="{ 'is-active': localIsNegate && !localIsJs }"
          :style="localIsNegate && !localIsJs ? { background: '#3b82f6', borderColor: '#3b82f6', color: 'white' } : {}"
          :disabled="localIsDisabled || localIsJs"
        />
        <ToggleButton
          v-model="localIsRegex"
          onLabel=".*"
          offLabel=".*"
          @change="debouncedApplyFilter"
          v-tooltip.top="'Regex matching'"
          class="filter-option-btn"
          :class="{ 'is-active': localIsRegex && !localIsJs }"
          :style="localIsRegex && !localIsJs ? { background: '#3b82f6', borderColor: '#3b82f6', color: 'white' } : {}"
          :disabled="localIsDisabled || localIsJs"
        />
        <ToggleButton
          v-model="localIsArray"
          onLabel="[]"
          offLabel="[]"
          @change="debouncedApplyFilter"
          v-tooltip.top="'Array (comma-separated values)'"
          class="filter-option-btn"
          :class="{ 'is-active': localIsArray && !localIsJs }"
          :style="localIsArray && !localIsJs ? { background: '#3b82f6', borderColor: '#3b82f6', color: 'white' } : {}"
          :disabled="localIsDisabled || localIsJs"
        />
        <ToggleButton
          v-model="localIsJs"
          onLabel="JS"
          offLabel="JS"
          @change="debouncedApplyFilter"
          v-tooltip.top="'JavaScript expression (use $ for field value)'"
          class="filter-option-btn"
          :class="{ 'is-js-active': localIsJs }"
          :style="localIsJs ? { background: '#0ea5e9', borderColor: '#0ea5e9', color: 'white' } : {}"
          :disabled="localIsDisabled"
        />
        <div class="filter-options-separator"></div>
        <ToggleButton
          v-model="localIsDisabled"
          onLabel="||"
          offLabel="||"
          @change="debouncedApplyFilter"
          v-tooltip.top="'Pause Filter'"
          class="filter-option-btn pause-btn"
          :class="{ 'is-paused-active': localIsDisabled }"
          :style="localIsDisabled ? { background: '#f59e0b', borderColor: '#f59e0b', color: 'white' } : {}"
        />
        <div class="filter-options-spacer"></div>
        <Button
          icon="pi pi-eye-slash"
          size="small"
          text
          severity="secondary"
          @click="emit('hide-column'); hide()"
          v-tooltip.top="'Hide column'"
          class="hide-column-btn"
        />
      </div>
      
      <!-- Extended Fields Section -->
      <div class="extended-fields-section">
        <div class="extended-fields-header" @click="showExtendedFields = !showExtendedFields">
          <Button
            :icon="showExtendedFields ? 'pi pi-chevron-down' : 'pi pi-chevron-right'"
            size="small"
            text
            severity="secondary"
          />
          <span class="extended-fields-title">
            Pattern / Extended Fields
            <span v-if="localExtendedFields || localPatternExtract" class="has-value-indicator">●</span>
          </span>
        </div>
        <div v-if="showExtendedFields" class="extended-fields-content">
          <!-- Pattern Extraction -->
          <div class="pattern-extract-section">
            <div class="pattern-extract-header">
              <span class="pattern-extract-label">Pattern Extract</span>
              <label class="pattern-filter-toggle">
                <input 
                  type="checkbox" 
                  v-model="localPatternFilter"
                  @change="applyFilter"
                />
                <span>Filter rows</span>
              </label>
            </div>
            <div class="textarea-wrapper">
              <textarea
                v-model="localPatternExtract"
                placeholder="Extract fields using patterns (one per line). E.g.:
Request: $request *
user=${userId}, action=$action"
                class="extended-fields-input"
                rows="3"
                @input="debouncedApplyFilter"
              />
              <button
                v-if="localPatternExtract"
                class="textarea-clear-btn"
                @click="localPatternExtract = ''; applyFilter()"
                type="button"
                tabindex="-1"
              >
                <i class="pi pi-times"></i>
              </button>
            </div>
            <div v-if="previewPatternFields.length > 0" class="pattern-preview">
              <span class="pattern-preview-label">Extracted:</span>
              <span v-for="f in previewPatternFields" :key="f" class="pattern-field-tag">
                {{ f }}
              </span>
            </div>
            <div v-else-if="localPatternExtract" class="pattern-hint">
              Use ${name} or $name to extract values, * for wildcard
            </div>
          </div>
          
          <!-- JSON Path Extended Fields -->
          <div class="jsonpath-extract-section">
            <span class="jsonpath-extract-label">JSON Path</span>
            <div class="textarea-wrapper">
              <textarea
                v-model="localExtendedFields"
                placeholder="Extract fields using JSON path. E.g.: name: $.user.name, id: $.id"
                class="extended-fields-input"
                rows="2"
                @input="debouncedApplyFilter"
              />
              <button
                v-if="localExtendedFields"
                class="textarea-clear-btn"
                @click="localExtendedFields = ''; applyFilter()"
                type="button"
                tabindex="-1"
              >
                <i class="pi pi-times"></i>
              </button>
            </div>
          </div>
          
        </div>
      </div>
      
      <!-- Statistics Panel -->
      <div class="stats-section">
        <div class="stats-section-header" @click="showStats = !showStats">
          <Button
            :icon="showStats ? 'pi pi-chevron-down' : 'pi pi-chevron-right'"
            size="small"
            text
            severity="secondary"
          />
          <span class="stats-section-title">
            Column Statistics
          </span>
          <Button
            v-if="showStats"
            icon="pi pi-copy"
            size="small"
            text
            severity="secondary"
            @click.stop="copyStats"
            v-tooltip.top="'Copy statistics'"
            class="stats-copy-btn"
          />
        </div>
        <div v-if="showStats" class="stats-panel">
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
              :class="{ 'has-highlight': getValueColor(item.val) }"
              :style="getValueColor(item.val) ? { 
                backgroundColor: getValueColor(item.val)!.bg,
                color: getValueColor(item.val)!.text 
              } : {}"
            >
              <div class="top-value-row">
                <span class="top-value-text" :title="item.val">{{ item.val || '(empty)' }}</span>
                <div class="top-value-actions">
                  <button 
                    class="stat-action-btn stat-color-btn"
                    :class="{ 'has-color': getValueColor(item.val) }"
                    :style="getValueColor(item.val) ? { backgroundColor: getValueColor(item.val)!.bg } : {}"
                    title="Set highlight color"
                    @click.stop="toggleColorPicker(item.val)"
                  >
                    <i class="pi pi-palette"></i>
                  </button>
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
              <!-- Color picker popup -->
              <div v-if="colorPickerValue === item.val" class="color-picker-popup" @click.stop>
                <div class="color-picker-grid">
                  <button
                    v-for="color in PRESET_COLORS"
                    :key="color.name"
                    class="color-option"
                    :class="{ 'is-none': !color.bg }"
                    :style="color.bg ? { backgroundColor: color.bg, color: color.text } : {}"
                    :title="color.name"
                    @click="setValueColor(item.val, color.bg ? { bg: color.bg, text: color.text } : null)"
                  >
                    {{ color.bg ? color.name.charAt(0) : '✕' }}
                  </button>
                </div>
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
    </div>
    <!-- Resize handle -->
    <div class="resize-handle" @mousedown="startResize"></div>
  </Popover>
</template>

<style scoped>
.filter-content {
  display: flex;
  flex-direction: column;
  gap: 8px;
  flex: 1;
  overflow-y: auto;
  min-height: 0;
}

/* Resize handle */
.resize-handle {
  position: absolute;
  bottom: 0;
  right: 0;
  width: 16px;
  height: 16px;
  cursor: nwse-resize;
  z-index: 100;
}

.resize-handle::after {
  content: '';
  position: absolute;
  bottom: 4px;
  right: 4px;
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

.filter-input-wrapper {
  position: relative;
  flex: 1;
  display: flex;
  align-items: center;
}

.filter-input {
  flex: 1;
  padding-right: 28px;
}

.input-clear-btn {
  position: absolute;
  right: 6px;
  top: 50%;
  transform: translateY(-50%);
  width: 20px;
  height: 20px;
  border: none;
  background: transparent;
  color: var(--tdv-text-muted);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  padding: 0;
  transition: all 0.15s ease;
}

.input-clear-btn:hover {
  background: var(--tdv-surface-hover);
  color: var(--tdv-text);
}

.input-clear-btn i {
  font-size: 10px;
}

.textarea-wrapper {
  position: relative;
  flex: 1;
}

.textarea-wrapper textarea {
  width: 100%;
  padding-right: 28px;
}

.textarea-clear-btn {
  position: absolute;
  right: 6px;
  top: 6px;
  width: 20px;
  height: 20px;
  border: none;
  background: var(--tdv-surface-light);
  color: var(--tdv-text-muted);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  padding: 0;
  transition: all 0.15s ease;
}

.textarea-clear-btn:hover {
  background: var(--tdv-surface-hover);
  color: var(--tdv-text);
}

.textarea-clear-btn i {
  font-size: 10px;
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
  gap: 4px;
  align-items: center;
}

.filter-option-btn {
  width: 32px;
  min-width: 32px;
  max-width: 32px;
  height: 26px;
  font-family: 'JetBrains Mono', monospace;
  font-weight: 600;
  font-size: 0.7rem;
  padding: 0;
  background: var(--tdv-surface-light);
  border: 1px solid var(--tdv-surface-border);
  color: var(--tdv-text);
}

/* Dark mode: improve button contrast */
:global(.dark-mode) .filter-option-btn {
  background: #4b5563 !important;
  border: 1.5px solid #9ca3af !important;
  color: #f3f4f6 !important;
}

:global(.dark-mode) .filter-option-btn:hover {
  background: #6b7280 !important;
  border-color: #d1d5db !important;
}

.filter-option-btn :deep(.p-togglebutton-content) {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
}

.filter-option-btn :deep(.p-togglebutton-label) {
  font-size: 0.7rem;
  line-height: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}

.filter-option-btn :deep(.p-togglebutton-icon) {
  font-size: 0.75rem;
  margin: 0 !important;
}

/* Active state - make it visually obvious */
/* Use :global to override PrimeVue's styling with high specificity */
:global(.filter-option-btn.is-active),
:global(.filter-option-btn.is-active.p-togglebutton),
:global(.filter-option-btn.is-active.p-togglebutton-checked),
:global(button.p-togglebutton.filter-option-btn.is-active) {
  background: #3b82f6 !important;
  background-color: #3b82f6 !important;
  border-color: #3b82f6 !important;
  color: white !important;
  box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.3);
}

:global(.filter-option-btn.is-active .p-togglebutton-label),
:global(.filter-option-btn.is-active .p-togglebutton-icon),
:global(.filter-option-btn.is-active span),
:global(.filter-option-btn.is-active .p-togglebutton-content) {
  color: white !important;
}

/* PrimeVue Aura sets background on .p-togglebutton-content - override it */
:global(.filter-option-btn.is-active .p-togglebutton-content) {
  background: #3b82f6 !important;
  background-color: #3b82f6 !important;
}

:global(.dark-mode) .filter-option-btn.is-active {
  background: #3b82f6 !important;
  border-color: #60a5fa !important;
  box-shadow: 0 0 0 2px rgba(96, 165, 250, 0.4);
}

/* Pause button active state */
:global(.filter-option-btn.is-paused-active),
:global(.filter-option-btn.is-paused-active.p-togglebutton),
:global(.filter-option-btn.is-paused-active.p-togglebutton-checked),
:global(button.p-togglebutton.filter-option-btn.is-paused-active) {
  background: #f59e0b !important;
  background-color: #f59e0b !important;
  border-color: #f59e0b !important;
  color: white !important;
  box-shadow: 0 0 0 2px rgba(245, 158, 11, 0.3);
}

:global(.filter-option-btn.is-paused-active .p-togglebutton-label),
:global(.filter-option-btn.is-paused-active .p-togglebutton-icon),
:global(.filter-option-btn.is-paused-active span),
:global(.filter-option-btn.is-paused-active .p-togglebutton-content) {
  color: white !important;
}

:global(.filter-option-btn.is-paused-active .p-togglebutton-content) {
  background: #f59e0b !important;
  background-color: #f59e0b !important;
}

:global(.dark-mode) .filter-option-btn.is-paused-active {
  background: #f59e0b !important;
  border-color: #fbbf24 !important;
  box-shadow: 0 0 0 2px rgba(251, 191, 36, 0.4);
}

/* Disabled/paused state for other buttons */
.filter-paused .filter-option-btn:not(.pause-btn) {
  opacity: 0.5;
  pointer-events: none;
}

.filter-paused .filter-input {
  opacity: 0.5;
}

.filter-paused .input-clear-btn {
  opacity: 0.5;
  pointer-events: none;
}

.filter-options-separator {
  width: 1px;
  height: 20px;
  background: var(--tdv-surface-border);
  margin: 0 2px;
}

.filter-options-spacer {
  flex: 1;
}

.pause-btn {
  width: 32px;
  min-width: 32px;
}

.hide-column-btn {
  padding: 0.25rem;
}

.hide-column-btn :deep(.p-button-icon) {
  font-size: 0.85rem;
}

.pattern-preview {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  padding: 4px 8px;
  background: var(--tdv-surface-light);
  border-radius: var(--tdv-radius-sm);
  border: 1px solid var(--tdv-success);
  margin-top: 4px;
}

.pattern-preview-label {
  font-size: 0.75rem;
  color: var(--tdv-text-muted);
}

.pattern-field-tag {
  padding: 1px 6px;
  background: var(--tdv-success);
  color: white;
  border-radius: 3px;
  font-size: 0.75rem;
  font-family: 'JetBrains Mono', monospace;
  font-weight: 500;
}

.pattern-hint {
  font-size: 0.75rem;
  color: var(--tdv-text-muted);
  font-style: italic;
  margin-top: 4px;
}

.extended-fields-section {
  margin-top: 4px;
  border: 1px solid var(--tdv-surface-border);
  border-radius: var(--tdv-radius);
}

.extended-fields-header {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  cursor: pointer;
  user-select: none;
}

.extended-fields-header:hover {
  background: var(--tdv-surface-light);
}

.extended-fields-title {
  font-size: 0.85rem;
  color: var(--tdv-text-muted);
}

.has-value-indicator {
  color: var(--tdv-success);
  margin-left: 4px;
}

.extended-fields-content {
  padding: 8px;
  border-top: 1px solid var(--tdv-surface-border);
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.pattern-extract-section,
.jsonpath-extract-section {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.pattern-extract-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.pattern-extract-label,
.jsonpath-extract-label {
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--tdv-text-muted);
}

.pattern-filter-toggle {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 0.75rem;
  color: var(--tdv-text-muted);
  cursor: pointer;
}

.pattern-filter-toggle input {
  cursor: pointer;
}

.pattern-filter-toggle:hover {
  color: var(--tdv-text);
}

.extended-fields-input {
  width: 100%;
  font-family: var(--tdv-font-mono);
  font-size: 0.85rem;
  padding: 8px;
  border: 1px solid var(--tdv-surface-border);
  border-radius: var(--tdv-radius);
  background: var(--tdv-surface);
  color: var(--tdv-text);
  resize: vertical;
}

.extended-fields-input:focus {
  outline: none;
  border-color: var(--tdv-primary);
}

.extended-fields-hint {
  margin-top: 4px;
  color: var(--tdv-text-muted);
}

.extended-fields-hint code {
  background: var(--tdv-surface-light);
  padding: 1px 4px;
  border-radius: 2px;
  font-size: 0.8rem;
}

/* JS mode input styling */
.js-mode-input {
  font-family: var(--tdv-font-mono);
}

/* JS button active state - use a distinct color */
:global(.filter-option-btn.is-js-active),
:global(.filter-option-btn.is-js-active.p-togglebutton),
:global(.filter-option-btn.is-js-active.p-togglebutton-checked),
:global(button.p-togglebutton.filter-option-btn.is-js-active) {
  background: #0ea5e9 !important;
  background-color: #0ea5e9 !important;
  border-color: #0ea5e9 !important;
  color: white !important;
  box-shadow: 0 0 0 2px rgba(14, 165, 233, 0.3);
}

:global(.filter-option-btn.is-js-active .p-togglebutton-label),
:global(.filter-option-btn.is-js-active .p-togglebutton-icon),
:global(.filter-option-btn.is-js-active span),
:global(.filter-option-btn.is-js-active .p-togglebutton-content) {
  color: white !important;
}

:global(.filter-option-btn.is-js-active .p-togglebutton-content) {
  background: #0ea5e9 !important;
  background-color: #0ea5e9 !important;
}

:global(.dark-mode) .filter-option-btn.is-js-active {
  background: #0ea5e9 !important;
  border-color: #38bdf8 !important;
  box-shadow: 0 0 0 2px rgba(56, 189, 248, 0.4);
}

/* Disabled state for buttons when JS mode is active */
.filter-js-mode .filter-option-btn:not(.is-js-active):not(.pause-btn) {
  opacity: 0.5;
}

.stats-section {
  margin-top: 4px;
  border: 1px solid var(--tdv-surface-border);
  border-radius: var(--tdv-radius);
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.stats-section-header {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  cursor: pointer;
  user-select: none;
}

.stats-section-header:hover {
  background: var(--tdv-surface-light);
}

.stats-section-title {
  font-size: 0.85rem;
  color: var(--tdv-text-muted);
  flex: 1;
}

.stats-copy-btn {
  margin-left: auto;
}

.stats-panel {
  background: var(--tdv-surface-light);
  border-top: 1px solid var(--tdv-surface-border);
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
  position: relative;
  padding: 4px 6px;
  border-radius: 4px;
  margin: 0 -6px;
  transition: background-color 0.15s;
}

.top-value-row {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.8rem;
  position: relative;
}

.top-value-row:hover .top-value-actions {
  opacity: 1;
  transition-delay: 100ms;
  pointer-events: auto;
}

.top-value-actions {
  position: absolute;
  right: 4px;
  top: 50%;
  transform: translateY(-50%);
  display: flex;
  gap: 2px;
  padding: 2px 4px;
  background: rgba(var(--tdv-surface-rgb, 255, 255, 255), 0.5);
  backdrop-filter: blur(4px);
  border: 1px solid var(--tdv-surface-border);
  border-radius: 4px;
  opacity: 0;
  transition: opacity 0.15s;
  transition-delay: 0s;
  z-index: 10;
  pointer-events: none;
}

.stat-action-btn {
  background: var(--tdv-surface-light);
  border: 1px solid var(--tdv-surface-border);
  cursor: pointer;
  color: var(--tdv-text);
  padding: 3px 5px;
  border-radius: 3px;
  font-size: 0.75rem;
  transition: color 0.15s, background 0.15s, border-color 0.15s;
  display: flex;
  align-items: center;
  justify-content: center;
}

.stat-action-btn:hover {
  background: var(--tdv-hover-bg);
  border-color: var(--tdv-text-muted);
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

.stat-color-btn:hover {
  color: var(--tdv-primary);
}

.stat-color-btn.has-color {
  border: 1px solid var(--tdv-surface-border);
}

.stat-action-btn i {
  font-size: 10px;
}

/* Dark mode: higher contrast for stat action buttons */
:global(.dark-mode) .top-value-actions {
  background: #374151;
  border-color: #6b7280;
}

:global(.dark-mode) .stat-action-btn {
  background: #4b5563;
  border: 1px solid #9ca3af;
  color: #f3f4f6;
}

:global(.dark-mode) .stat-action-btn:hover {
  background: #6b7280;
  border-color: #d1d5db;
}

/* Color picker popup */
.color-picker-popup {
  position: absolute;
  top: 100%;
  left: 0;
  z-index: 100;
  background: var(--tdv-surface);
  border: 1px solid var(--tdv-surface-border);
  border-radius: var(--tdv-radius-sm);
  padding: 6px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  margin-top: 4px;
}

.color-picker-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 4px;
}

.color-option {
  width: 28px;
  height: 28px;
  border: 1px solid var(--tdv-surface-border);
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.1s, box-shadow 0.1s;
}

.color-option:hover {
  transform: scale(1.1);
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2);
}

.color-option.is-none {
  background: var(--tdv-surface-light);
  color: var(--tdv-text-muted);
}

.top-value-text {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: inherit;
  font-family: 'JetBrains Mono', monospace;
}

.top-value-count {
  font-weight: 600;
  text-align: right;
  color: inherit;
  white-space: nowrap;
}

.top-value-item:not(.has-highlight) .top-value-count {
  color: var(--tdv-primary);
}

.top-value-percent {
  font-weight: 500;
  text-align: right;
  color: inherit;
  white-space: nowrap;
}

.top-value-item:not(.has-highlight) .top-value-percent {
  color: var(--tdv-success);
}

.top-value-bar {
  height: 4px;
}

.top-value-bar :deep(.p-progressbar-value) {
  background: var(--tdv-primary);
}
</style>
