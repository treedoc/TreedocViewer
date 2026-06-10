<script setup lang="ts">
import { ref, computed, watch, nextTick, onBeforeUnmount } from 'vue'
import { debounce } from 'lodash-es'
import Dialog from 'primevue/dialog'
import Button from 'primevue/button'
import ProgressBar from 'primevue/progressbar'
import MultiSelect from 'primevue/multiselect'
import HoverButtonBar, { type HoverButton } from './HoverButtonBar.vue'
import ColumnFilterBasicControls from './ColumnFilterBasicControls.vue'
import BasicColumnFilterPopover from './BasicColumnFilterPopover.vue'
import type { TDNode } from 'treedoc'
import { TDNodeType, TDJSONWriter, TDJSONWriterOption } from 'treedoc'
import type { FieldQuery } from '@/models/types'
import { useColumnResize } from '@/composables/useColumnResize'

export type { FieldQuery }

export interface ColumnStatistic {
  total: number
  uniqueCount: number
  numericCount: number
  min: number | string | null
  max: number | string | null
  sum: number
  avg: number
  p50: number
  p90: number
  p99: number
  topValues: { val: string; count: number; percent: number }[]
  allValues: { val: string; count: number; percent: number }[]
}

interface StatisticTableRow {
  key: string
  value: string
  values: string[]
  count: number
  percent: number
  uniqueCount: number
  isNumeric: boolean
  total: number
  max: number | string | null
  avg: number
  p99: number
  p90: number
  p50: number
}

type StatisticColumnKey =
  | `breakdown:${number}`
  | 'count'
  | 'unique'
  | 'total'
  | 'percent'
  | 'max'
  | 'avg'
  | 'p99'
  | 'p90'
  | 'p50'

type StatisticSortOrder = 1 | -1

interface StatisticTableColumn {
  key: StatisticColumnKey
  label: string
}

const props = defineProps<{
  field: string
  title: string
  fieldQuery: FieldQuery
  filteredData: any[]
  columns: { field: string; header: string }[]
}>()

const emit = defineEmits<{
  'update:fieldQuery': [query: FieldQuery]
  'update-column-filter': [field: string, value: string, isNegate: boolean]
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
const compactFilterPopoverRef = ref<InstanceType<typeof BasicColumnFilterPopover> | null>(null)
let autoCloseTimer: ReturnType<typeof setTimeout> | null = null
let autoCloseOnShow = false
const isPopoverVisible = ref(false)

function getPopoverElement(): HTMLElement | null {
  const fromInstance = (popoverRef.value as any)?.container as HTMLElement | undefined
  if (fromInstance) return fromInstance
  const candidates = document.querySelectorAll('.column-filter-popover.p-popover')
  return (candidates[candidates.length - 1] as HTMLElement) || null
}

function cancelAutoClose() {
  if (autoCloseTimer) {
    clearTimeout(autoCloseTimer)
    autoCloseTimer = null
  }
}

function scheduleAutoClose() {
  if (!isPopoverVisible.value) return
  cancelAutoClose()
  autoCloseTimer = setTimeout(() => {
    hide()
    autoCloseTimer = null
  }, 2000)
}

function handleDocumentMouseMove(event: MouseEvent) {
  if (!isPopoverVisible.value) return
  const popoverEl = getPopoverElement()
  if (!popoverEl) return

  const target = event.target as Node | null
  const isInside = !!target && popoverEl.contains(target)
  if (isInside) {
    cancelAutoClose()
  } else {
    scheduleAutoClose()
  }
}

function handleDocumentPointerDown(event: PointerEvent) {
  if (!isPopoverVisible.value) return
  const popoverEl = getPopoverElement()
  const target = event.target as Node | null
  if (!popoverEl || !target || popoverEl.contains(target)) return

  hide()
}

// Expose methods for parent to control popover
function show(event: Event, options: { autoClose?: boolean } = {}) {
  autoCloseOnShow = !!options.autoClose
  compactFilterPopoverRef.value?.show(event, options)
}

function hide() {
  cancelAutoClose()
  autoCloseOnShow = false
  isPopoverVisible.value = false
  document.removeEventListener('mousemove', handleDocumentMouseMove)
  document.removeEventListener('pointerdown', handleDocumentPointerDown, true)
  compactFilterPopoverRef.value?.hide()
}

function toggle(event: Event) {
  compactFilterPopoverRef.value?.toggle(event)
}

function resetSize() {
  overlayWidth.value = defaultOverlayWidth
  overlayHeight.value = defaultOverlayHeight
  saveOverlaySize(defaultOverlayWidth, defaultOverlayHeight)
}

defineExpose({ show, hide, toggle, resetSize })

const showStats = ref(false)
const localQuery = ref(props.fieldQuery.query || '')
const localIsRegex = ref(!!props.fieldQuery.isRegex)
const localIsExact = ref(!!props.fieldQuery.isExact)
const localIsNegate = ref(!!props.fieldQuery.isNegate)
const localIsArray = ref(!!props.fieldQuery.isArray)
const localIsPattern = ref(props.fieldQuery.isPattern || false)
const localIsDisabled = ref(props.fieldQuery.isDisabled || false)
const localIsJs = ref(!!props.fieldQuery.jsExpression && props.fieldQuery.jsExpression !== 'true')
const localExtendedFields = ref(props.fieldQuery.extendedFields || '')
const localPatternExtract = ref(props.fieldQuery.patternExtract || '')
const localPatternFilter = ref(props.fieldQuery.patternFilter || false)
const localLinkExpression = ref(props.fieldQuery.linkExpression || '')
const showExtendedFields = ref(false)
const showFormat = ref(false)
const selectedValues = ref<string[]>([])
const BREAKDOWN_FIELDS_DEBOUNCE_MS = 1000
const MAX_DISPLAYED_BREAKDOWN_ROWS = 2000
const MAX_DISPLAYED_TOP_VALUES = 500

function getFieldQueryBreakdownFields(fq: FieldQuery): string[] {
  return fq.statisticBreakdownFields?.length
    ? [...fq.statisticBreakdownFields]
    : (fq.statisticBreakdownField ? [fq.statisticBreakdownField] : [])
}

const initialBreakdownFields = getFieldQueryBreakdownFields(props.fieldQuery)
const pendingBreakdownFields = ref<string[]>([...initialBreakdownFields])
const breakdownFields = ref<string[]>([...initialBreakdownFields])
const selectedBreakdownValue = ref<string | null>(null)
let isSyncingBreakdownFields = false

const compactPopoverWidth = 420
const showAdvancedOverlay = ref(false)

// Overlay size and resize
const defaultOverlayWidth = 720
const defaultOverlayHeight = 640
const OVERLAY_SIZE_STORAGE_KEY = 'tdv_column_filter_overlay_size_v1'
const STATS_TABLE_HEIGHT_STORAGE_KEY = 'tdv_column_filter_stats_table_height_v1'

function clampSize(width: number, height: number): { width: number; height: number } {
  return {
    width: Math.max(420, Math.min(window.innerWidth - 32, width)),
    height: Math.max(420, Math.min(window.innerHeight - 32, height)),
  }
}

function clampSizeForPosition(width: number, height: number, left: number, top: number): { width: number; height: number } {
  return {
    width: Math.max(420, Math.min(window.innerWidth - left - 16, width)),
    height: Math.max(420, Math.min(window.innerHeight - top - 16, height)),
  }
}

function getCenteredOverlayPosition(width: number, height: number): { left: number; top: number } {
  return {
    left: Math.max(16, Math.round((window.innerWidth - width) / 2)),
    top: Math.max(16, Math.round((window.innerHeight - height) / 2)),
  }
}

function loadSavedOverlaySize(): { width: number; height: number } | null {
  try {
    const raw = localStorage.getItem(OVERLAY_SIZE_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as { width?: number; height?: number }
    const width = Number(parsed.width)
    const height = Number(parsed.height)
    if (!Number.isFinite(width) || !Number.isFinite(height)) return null
    return clampSize(width, height)
  } catch {
    return null
  }
}

function saveOverlaySize(width: number, height: number) {
  try {
    localStorage.setItem(OVERLAY_SIZE_STORAGE_KEY, JSON.stringify({ width, height }))
  } catch {
    // Ignore storage errors.
  }
}

function loadSavedStatsTableHeight(): number {
  try {
    const raw = localStorage.getItem(STATS_TABLE_HEIGHT_STORAGE_KEY)
    const height = raw ? Number(JSON.parse(raw)) : NaN
    return Number.isFinite(height) ? Math.max(120, Math.min(520, height)) : 180
  } catch {
    return 180
  }
}

function saveStatsTableHeight(height: number) {
  try {
    localStorage.setItem(STATS_TABLE_HEIGHT_STORAGE_KEY, JSON.stringify(height))
  } catch {
    // Ignore storage errors.
  }
}

const savedOverlaySize = loadSavedOverlaySize()
const overlayWidth = ref(savedOverlaySize?.width ?? defaultOverlayWidth)
const overlayHeight = ref(savedOverlaySize?.height ?? defaultOverlayHeight)
const overlayPosition = getCenteredOverlayPosition(overlayWidth.value, overlayHeight.value)
const overlayLeft = ref(overlayPosition.left)
const overlayTop = ref(overlayPosition.top)
const isResizing = ref(false)
const resizeStartX = ref(0)
const resizeStartY = ref(0)
const resizeStartWidth = ref(0)
const resizeStartHeight = ref(0)
const isMovingOverlay = ref(false)
const moveStartX = ref(0)
const moveStartY = ref(0)
const moveStartLeft = ref(0)
const moveStartTop = ref(0)
const statsTableHeight = ref(loadSavedStatsTableHeight())
const isResizingStatsTable = ref(false)
const statsResizeStartY = ref(0)
const statsResizeStartHeight = ref(0)

const STATS_COLUMN_DEFAULT_WIDTHS: Partial<Record<StatisticColumnKey, number>> = {
  count: 72,
  unique: 72,
  total: 96,
  percent: 84,
  max: 84,
  avg: 84,
  p99: 84,
  p90: 84,
  p50: 84,
}
const STATS_BREAKDOWN_COLUMN_DEFAULT_WIDTH = 160
const STATS_COLUMN_MIN_WIDTH = 56
const STATS_BREAKDOWN_COLUMN_MIN_WIDTH = 88
const STATS_COLUMN_RESIZE_DEBOUNCE_MS = 32
const statisticSortField = ref<StatisticColumnKey | null>(null)
const statisticSortOrder = ref<StatisticSortOrder>(-1)

function clampOverlayPosition(left: number, top: number): { left: number; top: number } {
  return {
    left: Math.max(16, Math.min(window.innerWidth - overlayWidth.value - 16, left)),
    top: Math.max(16, Math.min(window.innerHeight - overlayHeight.value - 16, top)),
  }
}

function startResize(e: MouseEvent) {
  e.preventDefault()
  e.stopPropagation()
  const dialogEl = (e.currentTarget as HTMLElement | null)?.closest('.column-filter-dialog') as HTMLElement | null
  if (dialogEl) {
    const rect = dialogEl.getBoundingClientRect()
    overlayLeft.value = rect.left
    overlayTop.value = rect.top
  }
  isResizing.value = true
  resizeStartX.value = e.clientX
  resizeStartY.value = e.clientY
  resizeStartWidth.value = overlayWidth.value
  resizeStartHeight.value = overlayHeight.value
  document.addEventListener('mousemove', onResize)
  document.addEventListener('mouseup', stopResize)
}

function onResize(e: MouseEvent) {
  if (!isResizing.value) return
  const deltaX = e.clientX - resizeStartX.value
  const deltaY = e.clientY - resizeStartY.value
  const size = clampSizeForPosition(
    resizeStartWidth.value + deltaX,
    resizeStartHeight.value + deltaY,
    overlayLeft.value,
    overlayTop.value
  )
  overlayWidth.value = size.width
  overlayHeight.value = size.height
}

function stopResize() {
  isResizing.value = false
  document.removeEventListener('mousemove', onResize)
  document.removeEventListener('mouseup', stopResize)
  saveOverlaySize(overlayWidth.value, overlayHeight.value)
}

function startOverlayMove(e: MouseEvent) {
  const target = e.target as HTMLElement | null
  if (target?.closest('button, .p-dialog-header-close, .resize-handle')) return

  e.preventDefault()
  isMovingOverlay.value = true
  moveStartX.value = e.clientX
  moveStartY.value = e.clientY
  moveStartLeft.value = overlayLeft.value
  moveStartTop.value = overlayTop.value
  document.addEventListener('mousemove', onOverlayMove)
  document.addEventListener('mouseup', stopOverlayMove)
}

function onOverlayMove(e: MouseEvent) {
  if (!isMovingOverlay.value) return
  const deltaX = e.clientX - moveStartX.value
  const deltaY = e.clientY - moveStartY.value
  const position = clampOverlayPosition(moveStartLeft.value + deltaX, moveStartTop.value + deltaY)
  overlayLeft.value = position.left
  overlayTop.value = position.top
}

function stopOverlayMove() {
  isMovingOverlay.value = false
  document.removeEventListener('mousemove', onOverlayMove)
  document.removeEventListener('mouseup', stopOverlayMove)
}

function startStatsTableResize(e: MouseEvent) {
  e.preventDefault()
  e.stopPropagation()
  isResizingStatsTable.value = true
  statsResizeStartY.value = e.clientY
  statsResizeStartHeight.value = statsTableHeight.value
  document.addEventListener('mousemove', onStatsTableResize)
  document.addEventListener('mouseup', stopStatsTableResize)
}

function onStatsTableResize(e: MouseEvent) {
  if (!isResizingStatsTable.value) return
  const deltaY = e.clientY - statsResizeStartY.value
  statsTableHeight.value = Math.max(120, Math.min(520, statsResizeStartHeight.value + deltaY))
}

function stopStatsTableResize() {
  isResizingStatsTable.value = false
  document.removeEventListener('mousemove', onStatsTableResize)
  document.removeEventListener('mouseup', stopStatsTableResize)
  saveStatsTableHeight(statsTableHeight.value)
}

function getStatsColumnMinWidth(key: StatisticColumnKey): number {
  return key.startsWith('breakdown:') ? STATS_BREAKDOWN_COLUMN_MIN_WIDTH : STATS_COLUMN_MIN_WIDTH
}

onBeforeUnmount(() => {
  isPopoverVisible.value = false
  cancelAutoClose()
  debouncedApplyFilter.cancel()
  debouncedApplyBreakdownFields.cancel()
  document.removeEventListener('mousemove', handleDocumentMouseMove)
  document.removeEventListener('mousemove', onResize)
  document.removeEventListener('mouseup', stopResize)
  document.removeEventListener('mousemove', onOverlayMove)
  document.removeEventListener('mouseup', stopOverlayMove)
  document.removeEventListener('mousemove', onStatsTableResize)
  document.removeEventListener('mouseup', stopStatsTableResize)
})

const debouncedApplyBreakdownFields = debounce(() => {
  const fields = [...pendingBreakdownFields.value]
  selectedBreakdownValue.value = null
  breakdownFields.value = fields
  emit('update:fieldQuery', {
    ...props.fieldQuery,
    statisticBreakdownField: fields.length === 1 ? fields[0] : undefined,
    statisticBreakdownFields: fields.length > 0 ? fields : undefined,
  })
}, BREAKDOWN_FIELDS_DEBOUNCE_MS)

// Sync with props
watch(() => props.fieldQuery, (fq) => {
  // JS mode is active if jsExpression is set (including 'true' which means empty JS filter)
  const isJsMode = !!fq.jsExpression
  // In JS mode, the query text is stored in jsExpression, not query
  // 'true' means JS mode is on but no filter text (show empty)
  if (isJsMode) {
    localQuery.value = fq.jsExpression === 'true' ? '' : fq.jsExpression!
  } else {
    localQuery.value = fq.query || ''
  }
  localIsRegex.value = !!fq.isRegex
  localIsExact.value = !!fq.isExact
  localIsNegate.value = !!fq.isNegate
  localIsArray.value = !!fq.isArray
  localIsPattern.value = fq.isPattern || false
  localIsDisabled.value = fq.isDisabled || false
  localIsJs.value = isJsMode
  localExtendedFields.value = fq.extendedFields || ''
  localPatternExtract.value = fq.patternExtract || ''
  localPatternFilter.value = fq.patternFilter || false
  localLinkExpression.value = fq.linkExpression || ''
  const fields = getFieldQueryBreakdownFields(fq)
  debouncedApplyBreakdownFields.cancel()
  isSyncingBreakdownFields = true
  pendingBreakdownFields.value = [...fields]
  breakdownFields.value = fields
  nextTick(() => {
    isSyncingBreakdownFields = false
  })
  // Auto-show/hide extended fields section based on content
  showExtendedFields.value = !!(fq.extendedFields || fq.patternExtract)
  // Auto-show format section if it has content
  showFormat.value = !!fq.linkExpression
}, { immediate: true })

// Auto-expand stats when row count is small (< 100000), otherwise collapse for performance
const AUTO_EXPAND_THRESHOLD = 100000
watch(() => props.field, () => {
  showStats.value = props.filteredData.length < AUTO_EXPAND_THRESHOLD
  selectedValues.value = []
  selectedBreakdownValue.value = null
}, { immediate: true })

watch(pendingBreakdownFields, () => {
  if (isSyncingBreakdownFields) return
  debouncedApplyBreakdownFields()
}, { deep: true })

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
  isPopoverVisible.value = true
  cancelAutoClose()
  document.addEventListener('mousemove', handleDocumentMouseMove)
  document.addEventListener('pointerdown', handleDocumentPointerDown, true)
  if (autoCloseOnShow) {
    scheduleAutoClose()
    autoCloseOnShow = false
  }
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

function onPopoverHide() {
  isPopoverVisible.value = false
  autoCloseOnShow = false
  cancelAutoClose()
  document.removeEventListener('mousemove', handleDocumentMouseMove)
  document.removeEventListener('pointerdown', handleDocumentPointerDown, true)
}

function openAdvancedOverlay() {
  hide()
  const size = clampSize(overlayWidth.value, overlayHeight.value)
  overlayWidth.value = size.width
  overlayHeight.value = size.height
  const position = getCenteredOverlayPosition(size.width, size.height)
  overlayLeft.value = position.left
  overlayTop.value = position.top
  showAdvancedOverlay.value = true
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
  const isRegex = !localIsJs.value && localIsRegex.value
  const isExact = !localIsJs.value && !isRegex && localIsExact.value
  
  emit('update:fieldQuery', {
    ...props.fieldQuery,  // Preserve valueColors and other properties
    query: localIsJs.value ? '' : localQuery.value,
    isRegex,
    isExact,
    isNegate: localIsJs.value ? false : localIsNegate.value,
    isArray: localIsJs.value ? false : localIsArray.value,
    isPattern: false,  // No longer used in filter options
    isDisabled: localIsDisabled.value,
    patternFields,
    extendedFields: localExtendedFields.value || undefined,
    patternExtract: localPatternExtract.value || undefined,
    patternFilter: localPatternFilter.value,
    jsExpression,
    linkExpression: localLinkExpression.value || undefined,
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
  localIsExact.value = false
  localIsNegate.value = false
  localIsArray.value = false
  localIsPattern.value = false
  localIsDisabled.value = false
  localIsJs.value = false
  // Don't clear extendedFields - user requested to preserve them
  applyFilter()
}

function isTopValueSelected(value: string): boolean {
  return selectedValues.value.includes(value)
}

function isTopValueSelectable(value: string): boolean {
  return value !== ''
}

function toggleTopValueSelection(value: string, checked: boolean) {
  if (!isTopValueSelectable(value)) return
  if (checked) {
    if (!selectedValues.value.includes(value)) {
      selectedValues.value = [...selectedValues.value, value]
    }
    return
  }
  selectedValues.value = selectedValues.value.filter(v => v !== value)
}

function clearTopValueSelection() {
  selectedValues.value = []
}

function applySelectedValuesFilter(isNegate: boolean) {
  const values = selectedValues.value.filter(v => isTopValueSelectable(v))
  if (!values.length) return

  localQuery.value = values.join(', ')
  localIsArray.value = true
  localIsNegate.value = isNegate
  localIsRegex.value = false
  localIsExact.value = true
  localIsPattern.value = false
  localIsJs.value = false
  debouncedApplyFilter.cancel()
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
    localIsExact.value = false
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
    localIsExact.value = true
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
    localIsRegex.value = false
    localIsExact.value = true
    localIsPattern.value = false
    localIsJs.value = false
  } else {
    localQuery.value = value
    localIsArray.value = true
    localIsNegate.value = isNegate
    localIsRegex.value = false
    localIsExact.value = true
    localIsPattern.value = false
    localIsJs.value = false
  }
  debouncedApplyFilter()
}

// Generate buttons for top value hover bar
function getTopValueButtons(value: string): HoverButton[] {
  const hasColor = getValueColor(value)
  return [
    { 
      id: 'color', 
      icon: 'pi-palette', 
      title: 'Set highlight color', 
      variant: 'color',
      style: hasColor ? { backgroundColor: hasColor.bg } : undefined
    },
    { id: 'copy', icon: 'pi-copy', title: 'Copy value', variant: 'copy' },
    { id: 'filter-in', icon: 'pi-filter', title: 'Filter in this value', variant: 'filter-in' },
    { id: 'filter-out', icon: 'pi-filter-slash', title: 'Filter out this value', variant: 'filter-out' }
  ]
}

// Handle top value button bar clicks
function handleTopValueButtonClick(buttonId: string, value: string) {
  switch (buttonId) {
    case 'color':
      toggleColorPicker(value)
      break
    case 'copy':
      copyValue(value)
      break
    case 'filter-in':
      addValueToFilter(value, false)
      break
    case 'filter-out':
      addValueToFilter(value, true)
      break
  }
}

function getBreakdownValueButtons(): HoverButton[] {
  return [
    { id: 'filter-in', icon: 'pi-filter', title: 'Filter in this value', variant: 'filter-in' },
    { id: 'filter-out', icon: 'pi-filter-slash', title: 'Filter out this value', variant: 'filter-out' }
  ]
}

function handleBreakdownValueButtonClick(buttonId: string, value: string) {
  if (breakdownFields.value.length !== 1) return
  const breakdownField = breakdownFields.value[0]
  if (!breakdownField) return

  switch (buttonId) {
    case 'filter-in':
      emit('update-column-filter', breakdownField, value, false)
      break
    case 'filter-out':
      emit('update-column-filter', breakdownField, value, true)
      break
  }
}

// Preview of extracted fields from pattern
const previewPatternFields = computed(() => {
  if (!localPatternExtract.value) return []
  return extractPatternFields(localPatternExtract.value)
})

function calculateColumnStats(rows: any[], field: string): ColumnStatistic {
  const stat: ColumnStatistic = {
    total: 0,
    uniqueCount: 0,
    numericCount: 0,
    min: null,
    max: null,
    sum: 0,
    avg: 0,
    p50: 0,
    p90: 0,
    p99: 0,
    topValues: [],
    allValues: [],
  }
  
  if (!showStats.value || !rows.length) return stat
  
  const valueCounts: Record<string, number> = {}
  const numericValues: number[] = []
  
  for (const row of rows) {
    stat.total++
    const val = row[field]
    
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
    stat.numericCount = numericValues.length
    stat.avg = stat.sum / numericValues.length
    stat.p50 = numericValues[Math.floor(numericValues.length * 0.5)] || 0
    stat.p90 = numericValues[Math.floor(numericValues.length * 0.9)] || 0
    stat.p99 = numericValues[Math.floor(numericValues.length * 0.99)] || 0
  }
  
  // Sort by count and keep all values for copy/export while displaying only the top values.
  const sortedKeys = Object.keys(valueCounts).sort((a, b) => valueCounts[b] - valueCounts[a])
  stat.uniqueCount = sortedKeys.length
  stat.allValues = sortedKeys.map(key => ({
    val: key,
    count: valueCounts[key],
    percent: (valueCounts[key] / stat.total) * 100,
  }))
  stat.topValues = stat.allValues.slice(0, MAX_DISPLAYED_TOP_VALUES)
  
  return stat
}

// Calculate column statistics
const columnStats = computed<ColumnStatistic>(() => {
  return calculateColumnStats(props.filteredData, props.field)
})

const breakdownColumns = computed(() => {
  return props.columns
    .filter(col => col.field !== props.field)
    .map(col => ({ label: col.header || col.field, value: col.field }))
})

const selectedBreakdownColumns = computed(() => {
  return breakdownFields.value
    .map(field => props.columns.find(col => col.field === field))
    .filter((col): col is { field: string; header: string } => !!col)
})

const selectedBreakdownLabels = computed(() => {
  return selectedBreakdownColumns.value.map(col => col.header || col.field)
})

const breakdownFieldsKey = computed(() => breakdownFields.value.join('\u0000'))

function getBreakdownValues(row: any): string[] {
  return breakdownFields.value.map(field => valueToSearchString(row[field]))
}

function getBreakdownKey(values: string[]): string {
  return JSON.stringify(values)
}

function getBreakdownDisplayValue(values: string[]): string {
  if (values.length === 0) return 'Global'
  return values.map(value => value || '(empty)').join(' / ')
}

const selectedBreakdownRows = computed(() => {
  if (breakdownFields.value.length === 0 || selectedBreakdownValue.value === null) {
    return props.filteredData
  }
  return props.filteredData.filter(row => getBreakdownKey(getBreakdownValues(row)) === selectedBreakdownValue.value)
})

const scopedColumnStats = computed<ColumnStatistic>(() => {
  return calculateColumnStats(selectedBreakdownRows.value, props.field)
})

const displayedTopValues = computed(() => scopedColumnStats.value.topValues)
const hasNumericStatisticRows = computed(() => columnStats.value.numericCount > 0)
const hasBreakdownFields = computed(() => breakdownFields.value.length > 0)

const selectedBreakdownLabel = computed(() => {
  if (breakdownFields.value.length === 0 || selectedBreakdownValue.value === null) return ''
  const row = statisticRows.value.find(item => item.key === selectedBreakdownValue.value)
  if (!row) return ''
  return selectedBreakdownLabels.value
    .map((label, index) => `${label}: ${row.values[index] || '(empty)'}`)
    .join(', ')
})

const statisticValueHeaders = computed(() => {
  return selectedBreakdownLabels.value
})

const statisticTableColumns = computed<StatisticTableColumn[]>(() => {
  return [
    ...statisticValueHeaders.value.map((label, index) => ({
      key: `breakdown:${index}` as const,
      label,
    })),
    { key: 'count', label: 'Count' },
    { key: 'unique', label: 'Unique' },
    ...(hasNumericStatisticRows.value ? [{ key: 'total' as const, label: 'Total' }] : []),
    ...(hasBreakdownFields.value ? [{ key: 'percent' as const, label: '%' }] : []),
    ...(hasNumericStatisticRows.value
      ? [
          { key: 'max' as const, label: 'Max' },
          { key: 'avg' as const, label: 'Avg' },
          { key: 'p99' as const, label: 'P99' },
          { key: 'p90' as const, label: 'P90' },
          { key: 'p50' as const, label: 'P50' },
        ]
      : []),
  ]
})

const {
  columnWidths: statsColumnWidths,
  resizingColumnKey: resizingStatsColumnKey,
  tableWidth: statisticTableWidth,
  getColumnWidth: getStatsColumnWidth,
  startColumnResize: startStatsColumnResize,
} = useColumnResize<StatisticColumnKey>({
  columns: statisticTableColumns,
  defaultWidths: STATS_COLUMN_DEFAULT_WIDTHS,
  defaultWidth: STATS_BREAKDOWN_COLUMN_DEFAULT_WIDTH,
  getMinWidth: getStatsColumnMinWidth,
  debounceMs: STATS_COLUMN_RESIZE_DEBOUNCE_MS,
})

function createStatisticTableRow(values: string[], rows: any[], totalBase: number): StatisticTableRow {
  const stats = calculateColumnStats(rows, props.field)
  const isNumeric = stats.numericCount > 0
  return {
    key: getBreakdownKey(values),
    value: getBreakdownDisplayValue(values),
    values,
    count: rows.length,
    percent: hasNumericStatisticRows.value
      ? (totalBase ? (stats.sum / totalBase) * 100 : 0)
      : (props.filteredData.length ? (rows.length / props.filteredData.length) * 100 : 0),
    uniqueCount: stats.uniqueCount,
    isNumeric,
    total: stats.sum,
    max: stats.max,
    avg: stats.avg,
    p99: stats.p99,
    p90: stats.p90,
    p50: stats.p50,
  }
}

const statisticRows = computed<StatisticTableRow[]>(() => {
  if (!showStats.value) return []

  const totalBase = columnStats.value.sum
  if (breakdownFields.value.length === 0) {
    return [createStatisticTableRow([], props.filteredData, totalBase)]
  }

  const groups = new Map<string, { values: string[], rows: any[] }>()
  for (const row of props.filteredData) {
    const values = getBreakdownValues(row)
    const key = getBreakdownKey(values)
    const group = groups.get(key)
    if (group) {
      group.rows.push(row)
    } else {
      groups.set(key, { values, rows: [row] })
    }
  }

  return Array.from(groups.values())
    .map(group => createStatisticTableRow(group.values, group.rows, totalBase))
    .sort((a, b) => {
      if (hasNumericStatisticRows.value) {
        return b.total - a.total || b.count - a.count
      }
      return b.count - a.count
    })
})

const activeStatisticSortField = computed<StatisticColumnKey>(() => {
  const field = statisticSortField.value
  if (field && statisticTableColumns.value.some(col => col.key === field)) return field
  return hasNumericStatisticRows.value ? 'total' : 'count'
})

function getStatisticSortValue(row: StatisticTableRow, field: StatisticColumnKey): string | number | null {
  if (field.startsWith('breakdown:')) {
    return row.values[Number(field.split(':')[1])] || ''
  }

  switch (field) {
    case 'count': return row.count
    case 'unique': return row.uniqueCount
    case 'total': return row.isNumeric ? row.total : null
    case 'percent': return row.percent
    case 'max': return row.isNumeric && typeof row.max === 'number' ? row.max : null
    case 'avg': return row.isNumeric ? row.avg : null
    case 'p99': return row.isNumeric ? row.p99 : null
    case 'p90': return row.isNumeric ? row.p90 : null
    case 'p50': return row.isNumeric ? row.p50 : null
  }

  return null
}

function compareStatisticValues(a: string | number | null, b: string | number | null): number {
  if (a == null && b == null) return 0
  if (a == null) return 1
  if (b == null) return -1
  if (typeof a === 'number' && typeof b === 'number') return a - b
  return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' })
}

const sortedStatisticRows = computed(() => {
  const field = activeStatisticSortField.value
  const order = statisticSortOrder.value
  return statisticRows.value
    .map((row, index) => ({ row, index }))
    .sort((a, b) => {
      const diff = compareStatisticValues(
        getStatisticSortValue(a.row, field),
        getStatisticSortValue(b.row, field)
      )
      return diff === 0 ? a.index - b.index : diff * order
    })
    .map(item => item.row)
})

const displayedStatisticRows = computed(() => {
  return sortedStatisticRows.value.slice(0, MAX_DISPLAYED_BREAKDOWN_ROWS)
})

function setStatisticSort(field: StatisticColumnKey) {
  if (activeStatisticSortField.value === field) {
    statisticSortOrder.value = statisticSortOrder.value === 1 ? -1 : 1
  } else {
    statisticSortField.value = field
    statisticSortOrder.value = 1
  }
  statisticSortField.value = field
}

function getStatisticSortIcon(field: StatisticColumnKey): string {
  if (activeStatisticSortField.value !== field) return 'pi pi-sort-alt'
  return statisticSortOrder.value === 1 ? 'pi pi-sort-amount-up-alt' : 'pi pi-sort-amount-down'
}

watch(() => displayedTopValues.value.map(item => item.val).join('\u0000'), (topValuesKey) => {
  const allowed = new Set(topValuesKey ? topValuesKey.split('\u0000') : [])
  selectedValues.value = selectedValues.value.filter(value => allowed.has(value) && isTopValueSelectable(value))
})

function formatNumber(val: number): string {
  return val.toLocaleString(undefined, { maximumFractionDigits: 2 })
}

function copyBreakdownStats() {
  const breakdownLabels = statisticValueHeaders.value
  const headers = hasNumericStatisticRows.value
    ? [...breakdownLabels, 'Count', 'Unique', 'Total', 'Percent', 'Max', 'Avg', 'P99', 'P90', 'P50']
    : [...breakdownLabels, 'Count', 'Unique', 'Percent']
  const rows = sortedStatisticRows.value.map(row => {
    const common = [
      ...row.values,
      row.count,
      row.uniqueCount,
    ]
    if (!hasNumericStatisticRows.value) {
      return [...common, row.percent.toFixed(1) + '%']
    }
    return [
      ...common,
      row.total,
      row.percent.toFixed(1) + '%',
      row.max ?? '',
      row.avg,
      row.p99,
      row.p90,
      row.p50,
    ]
  })

  const csv = [
    headers,
    ...rows,
  ]
    .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\n')

  navigator.clipboard.writeText(csv)
}

function copyTopValues() {
  const headers = [props.title || props.field, 'Count', 'Percent']
  const rows = scopedColumnStats.value.allValues.map(item => [
    item.val,
    item.count,
    item.percent.toFixed(1) + '%',
  ])

  const csv = [
    headers,
    ...rows,
  ]
    .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\n')

  navigator.clipboard.writeText(csv)
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
  <BasicColumnFilterPopover
    ref="compactFilterPopoverRef"
    v-model:query="localQuery"
    v-model:is-regex="localIsRegex"
    v-model:is-exact="localIsExact"
    v-model:is-negate="localIsNegate"
    v-model:is-array="localIsArray"
    v-model:is-disabled="localIsDisabled"
    v-model:is-js="localIsJs"
    :field="field"
    :show-advanced="true"
    popover-class="column-filter-popover"
    :width="compactPopoverWidth"
    @apply="debouncedApplyFilter"
    @clear="clearFilter"
    @keydown="handleKeydown"
    @advanced="openAdvancedOverlay"
    @hide-column="emit('hide-column'); hide()"
  />

  <Dialog
    v-model:visible="showAdvancedOverlay"
    modal
    dismissableMask
    appendTo="body"
    class="column-filter-dialog"
    :style="{
      width: overlayWidth + 'px',
      height: overlayHeight + 'px',
      left: overlayLeft + 'px',
      top: overlayTop + 'px'
    }"
    :draggable="false"
    :closable="true"
    :pt="{
      content: { style: 'height: 100%; display: flex; flex-direction: column; min-height: 0;' },
      header: { style: 'padding: 0.35rem 0.75rem; min-height: 0; cursor: move;', onMousedown: startOverlayMove }
    }"
  >
    <template #header>
      <span class="advanced-filter-title">{{ title }}</span>
    </template>
    <div class="filter-content">
      <ColumnFilterBasicControls
        v-model:query="localQuery"
        v-model:is-regex="localIsRegex"
        v-model:is-exact="localIsExact"
        v-model:is-negate="localIsNegate"
        v-model:is-array="localIsArray"
        v-model:is-disabled="localIsDisabled"
        v-model:is-js="localIsJs"
        :field="field"
        :show-hide-column="true"
        @apply="debouncedApplyFilter"
        @clear="clearFilter"
        @keydown="handleKeydown"
        @hide-column="emit('hide-column'); showAdvancedOverlay = false"
      />

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
      
      <!-- Format Section -->
      <div class="format-section">
        <div class="format-header" @click="showFormat = !showFormat">
          <Button
            :icon="showFormat ? 'pi pi-chevron-down' : 'pi pi-chevron-right'"
            size="small"
            text
            severity="secondary"
          />
          <span class="format-title">
            Format
            <span v-if="localLinkExpression" class="has-value-indicator">●</span>
          </span>
        </div>
        <div v-if="showFormat" class="format-content">
          <!-- Link Expression -->
          <div class="link-expression-section">
            <span class="link-expression-label">Link URL Expression</span>
            <div class="link-expression-hint">
              JS expression returning URL. Use <code>$</code> for cell value, <code>$$</code> for row.
            </div>
            <div class="textarea-wrapper">
              <textarea
                v-model="localLinkExpression"
                placeholder="E.g.: `https://example.com/id/${$}` or `https://app.com/${$$.userId}`"
                class="link-expression-input"
                rows="2"
                @input="debouncedApplyFilter"
              />
              <button
                v-if="localLinkExpression"
                class="textarea-clear-btn"
                @click="localLinkExpression = ''; applyFilter()"
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
        </div>
        <div v-if="showStats" class="stats-panel">
        <!-- Statistics Table -->
        <div class="stats-breakdown">
          <div class="stats-breakdown-controls">
            <label v-if="breakdownColumns.length > 0" class="stats-breakdown-label">Break down by</label>
            <MultiSelect
              v-if="breakdownColumns.length > 0"
              v-model="pendingBreakdownFields"
              :options="breakdownColumns"
              optionLabel="label"
              optionValue="value"
              placeholder="Select columns"
              display="chip"
              filter
              class="stats-breakdown-select"
            />
            <Button
              v-if="statisticRows.length > 0"
              icon="pi pi-copy"
              size="small"
              text
              severity="secondary"
              class="stats-breakdown-copy-btn"
              v-tooltip.top="'Copy breakdown table'"
              @click="copyBreakdownStats"
            />
          </div>
          <div
            v-if="statisticRows.length > 0"
            v-memo="[breakdownFieldsKey, selectedBreakdownValue, filteredData, field, statsTableHeight, hasBreakdownFields, displayedStatisticRows, statisticTableWidth, statsColumnWidths, resizingStatsColumnKey, activeStatisticSortField, statisticSortOrder]"
            class="stats-breakdown-table-wrap"
            :class="{ 'is-compact': !hasBreakdownFields }"
            :style="hasBreakdownFields ? { height: statsTableHeight + 'px' } : undefined"
          >
            <table class="stats-breakdown-table" :style="{ width: statisticTableWidth + 'px' }">
              <colgroup>
                <col
                  v-for="col in statisticTableColumns"
                  :key="col.key"
                  :style="{ width: getStatsColumnWidth(col.key) + 'px' }"
                />
              </colgroup>
              <thead>
                <tr>
                  <th
                    v-for="col in statisticTableColumns"
                    :key="col.key"
                    class="stats-resizable-header"
                    :class="{ resizing: resizingStatsColumnKey === col.key }"
                  >
                    <button
                      type="button"
                      class="stats-sort-button"
                      :class="{ sorted: activeStatisticSortField === col.key }"
                      @click="setStatisticSort(col.key)"
                    >
                      <span class="stats-header-label">{{ col.label }}</span>
                      <i :class="getStatisticSortIcon(col.key)"></i>
                    </button>
                    <span
                      class="p-column-resizer stats-column-resize-handle"
                      @mousedown="startStatsColumnResize($event, col.key)"
                    />
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="row in displayedStatisticRows"
                  :key="row.key"
                  :class="{ 'is-selected': breakdownFields.length > 0 && selectedBreakdownValue === row.key }"
                  @click="breakdownFields.length > 0 && (selectedBreakdownValue = selectedBreakdownValue === row.key ? null : row.key)"
                >
                  <td
                    v-for="(value, index) in row.values"
                    :key="`${row.key}-${index}`"
                    class="breakdown-value breakdown-value-cell"
                    :title="value"
                  >
                    <span class="breakdown-value-text">{{ value || '(empty)' }}</span>
                    <HoverButtonBar
                      v-if="breakdownFields.length === 1 && index === 0"
                      :buttons="getBreakdownValueButtons()"
                      layout="absolute"
                      :position-below="true"
                      class="breakdown-value-actions"
                      @click="handleBreakdownValueButtonClick($event, value)"
                    />
                  </td>
                  <td>{{ row.count }}</td>
                  <td>{{ row.uniqueCount }}</td>
                  <td v-if="hasNumericStatisticRows" class="breakdown-total-cell">
                    <div class="breakdown-total-value">{{ row.isNumeric ? formatNumber(row.total) : '' }}</div>
                    <div class="breakdown-percent-row">
                      <ProgressBar
                        :value="row.percent"
                        :showValue="false"
                        class="breakdown-percent-bar"
                      />
                    </div>
                  </td>
                  <td v-if="hasBreakdownFields" class="breakdown-percent-cell">
                    <template v-if="!hasNumericStatisticRows">
                      <ProgressBar
                        :value="row.percent"
                        :showValue="false"
                        class="breakdown-percent-bar"
                      />
                    </template>
                    <span class="breakdown-percent-label">{{ row.percent.toFixed(1) }}%</span>
                  </td>
                  <td v-if="hasNumericStatisticRows">{{ row.isNumeric && typeof row.max === 'number' ? formatNumber(row.max) : '' }}</td>
                  <td v-if="hasNumericStatisticRows">{{ row.isNumeric ? formatNumber(row.avg) : '' }}</td>
                  <td v-if="hasNumericStatisticRows">{{ row.isNumeric ? formatNumber(row.p99) : '' }}</td>
                  <td v-if="hasNumericStatisticRows">{{ row.isNumeric ? formatNumber(row.p90) : '' }}</td>
                  <td v-if="hasNumericStatisticRows">{{ row.isNumeric ? formatNumber(row.p50) : '' }}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div
            v-if="statisticRows.length > 0 && hasBreakdownFields"
            class="stats-breakdown-resize-handle"
            @mousedown="startStatsTableResize"
          ></div>
        </div>

        <!-- Top Values -->
        <div class="top-values">
          <div class="top-values-header-row">
            <div class="top-values-header">
              Top Values
              <span v-if="selectedBreakdownLabel" class="top-values-scope">
                {{ selectedBreakdownLabel }}
              </span>
            </div>
            <div class="top-values-selection-actions" :class="{ 'is-inactive': selectedValues.length === 0 }">
              <Button
                label="Filter In"
                icon="pi pi-filter"
                size="small"
                outlined
                class="top-values-filter-btn"
                :disabled="selectedValues.length === 0"
                @click="applySelectedValuesFilter(false)"
              />
              <Button
                label="Filter Out"
                icon="pi pi-filter-slash"
                size="small"
                severity="secondary"
                outlined
                class="top-values-filter-btn"
                :disabled="selectedValues.length === 0"
                @click="applySelectedValuesFilter(true)"
              />
              <Button
                icon="pi pi-times"
                size="small"
                text
                severity="secondary"
                class="top-values-filter-btn top-values-clear-btn"
                :disabled="selectedValues.length === 0"
                v-tooltip.top="'Clear selection'"
                @click="clearTopValueSelection"
              />
            </div>
            <Button
              v-if="displayedTopValues.length > 0"
              icon="pi pi-copy"
              size="small"
              text
              severity="secondary"
              class="top-values-copy-btn"
              v-tooltip.top="'Copy all values'"
              @click="copyTopValues"
            />
          </div>
          <div class="top-values-list">
            <div
              v-for="(item, idx) in displayedTopValues"
              :key="idx"
              class="top-value-item"
              :class="{ 'has-highlight': getValueColor(item.val) }"
              :style="getValueColor(item.val) ? { 
                backgroundColor: getValueColor(item.val)!.bg,
                color: getValueColor(item.val)!.text 
              } : {}"
            >
              <div class="top-value-row">
                <input
                  v-if="isTopValueSelectable(item.val)"
                  type="checkbox"
                  class="top-value-checkbox"
                  :checked="isTopValueSelected(item.val)"
                  @change="toggleTopValueSelection(item.val, ($event.target as HTMLInputElement).checked)"
                  :aria-label="`Select ${item.val}`"
                  @click.stop
                />
                <span v-else class="top-value-checkbox-placeholder" aria-hidden="true"></span>
                <span class="top-value-text" :title="item.val">{{ item.val || '(empty)' }}</span>
                <HoverButtonBar
                  :buttons="getTopValueButtons(item.val)"
                  layout="absolute"
                  class="top-value-actions"
                  @click="handleTopValueButtonClick($event, item.val)"
                />
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
  </Dialog>
</template>

<style scoped>
.compact-filter-content {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.advanced-filter-title {
  font-weight: 600;
  color: var(--tdv-text);
}

:global(.column-filter-dialog.p-dialog) {
  position: fixed;
  margin: 0;
  max-width: calc(100vw - 32px);
  max-height: calc(100vh - 32px);
}

:global(.column-filter-dialog .p-dialog-header) {
  gap: 0.5rem;
}

:global(.column-filter-dialog .p-dialog-content) {
  position: relative;
  overflow: hidden;
}

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

/* Format Section */
.format-section {
  margin-top: 4px;
  border: 1px solid var(--tdv-surface-border);
  border-radius: var(--tdv-radius);
}

.format-header {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  cursor: pointer;
  user-select: none;
}

.format-header:hover {
  background: var(--tdv-surface-light);
}

.format-title {
  font-size: 0.85rem;
  color: var(--tdv-text-muted);
}

.format-content {
  padding: 8px;
  border-top: 1px solid var(--tdv-surface-border);
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.link-expression-section {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.link-expression-label {
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--tdv-text-muted);
}

.link-expression-hint {
  font-size: 0.75rem;
  color: var(--tdv-text-muted);
}

.link-expression-hint code {
  background: var(--tdv-surface-light);
  padding: 1px 4px;
  border-radius: 2px;
  font-size: 0.75rem;
}

.link-expression-input {
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

.link-expression-input:focus {
  outline: none;
  border-color: var(--tdv-primary);
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

.stats-panel {
  background: var(--tdv-surface-light);
  border-top: 1px solid var(--tdv-surface-border);
  padding: 12px;
  flex: 1;
  min-height: 150px;
  overflow-y: auto;
}

.stats-breakdown {
  margin-bottom: 12px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--tdv-surface-border);
}

.stats-breakdown-controls {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.stats-breakdown-label {
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--tdv-text-muted);
  white-space: nowrap;
}

.stats-breakdown-select {
  flex: 1;
  min-width: 0;
}

.stats-breakdown-copy-btn {
  flex-shrink: 0;
}

.stats-breakdown-table-wrap {
  overflow: auto;
  border: 1px solid var(--tdv-surface-border);
  border-radius: 4px;
  background: var(--tdv-surface);
}

.stats-breakdown-table-wrap.is-compact {
  overflow: hidden;
}

.stats-breakdown-resize-handle {
  height: 8px;
  cursor: ns-resize;
  position: relative;
}

.stats-breakdown-resize-handle::after {
  content: '';
  position: absolute;
  left: 50%;
  top: 3px;
  width: 48px;
  height: 2px;
  transform: translateX(-50%);
  border-radius: 999px;
  background: var(--tdv-surface-border);
}

.stats-breakdown-resize-handle:hover::after {
  background: var(--tdv-text-muted);
}

.stats-breakdown-table {
  border-collapse: collapse;
  table-layout: fixed;
  font-size: 0.78rem;
}

.stats-breakdown-table th,
.stats-breakdown-table td {
  padding: 5px 6px;
  border-bottom: 1px solid var(--tdv-surface-border);
  border-right: 1px solid var(--tdv-surface-border);
  text-align: left;
  vertical-align: top;
  overflow: hidden;
  text-overflow: ellipsis;
}

.stats-breakdown-table th:last-child,
.stats-breakdown-table td:last-child {
  border-right: none;
}

.stats-breakdown-table th {
  position: sticky;
  top: 0;
  z-index: 1;
  background: var(--tdv-surface-light);
  color: var(--tdv-text-muted);
  font-weight: 600;
}

.stats-resizable-header {
  padding-right: 10px !important;
}

.stats-sort-button {
  display: inline-flex;
  align-items: center;
  justify-content: flex-start;
  gap: 4px;
  width: 100%;
  min-width: 0;
  padding: 0;
  border: 0;
  background: transparent;
  color: inherit;
  font: inherit;
  font-weight: 600;
  text-align: left;
  cursor: pointer;
}

.stats-sort-button.sorted {
  color: var(--tdv-text);
}

.stats-sort-button:hover {
  color: var(--tdv-primary);
}

.stats-header-label {
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.stats-sort-button i {
  flex: 0 0 auto;
  font-size: 0.68rem;
  opacity: 0.75;
}

.stats-column-resize-handle {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  width: 8px;
  cursor: col-resize;
  z-index: 2;
}

.stats-column-resize-handle::after {
  content: '';
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  width: 1px;
  background: transparent;
  opacity: 0;
}

.stats-resizable-header:hover .stats-column-resize-handle::after,
.stats-resizable-header.resizing .stats-column-resize-handle::after {
  background: var(--tdv-primary);
  opacity: 0.8;
}

.stats-resizable-header.resizing .stats-column-resize-handle::after {
  width: 2px;
  opacity: 1;
}

.stats-breakdown-table tbody tr {
  cursor: pointer;
}

.stats-breakdown-table-wrap.is-compact tbody tr {
  cursor: default;
}

.stats-breakdown-table tbody tr:hover {
  background: var(--tdv-hover-bg);
}

.stats-breakdown-table tbody tr.is-selected,
.stats-breakdown-table tbody tr.is-selected:hover {
  background: var(--tdv-selection-bg);
  color: var(--tdv-text-bright);
  box-shadow: inset 3px 0 0 var(--tdv-primary);
}

.stats-breakdown-table tbody tr.is-selected .breakdown-percent-label {
  color: var(--tdv-text-bright);
}

.breakdown-value,
.breakdown-total-cell {
  max-width: 140px;
  overflow: hidden;
  text-overflow: ellipsis;
}

.breakdown-value {
  white-space: nowrap;
}

.breakdown-value-cell {
  position: relative;
  overflow: visible;
}

.breakdown-value-text {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
}

:global(.breakdown-value-cell:hover .breakdown-value-actions),
:global(.breakdown-value-cell:hover .hover-button-bar) {
  opacity: 1 !important;
  transition-delay: 300ms;
  pointer-events: auto;
}

.breakdown-total-value {
  margin-bottom: 3px;
  font-family: 'JetBrains Mono', monospace;
}

.breakdown-percent-row {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 120px;
}

.breakdown-percent-cell {
  min-width: 90px;
}

.breakdown-percent-cell .breakdown-percent-bar {
  margin-bottom: 3px;
}

.breakdown-percent-bar {
  flex: 1;
  height: 6px;
}

.breakdown-percent-label {
  min-width: 38px;
  color: var(--tdv-text-muted);
  font-size: 0.7rem;
  font-family: 'JetBrains Mono', monospace;
}

.top-values-header {
  font-weight: 600;
  font-size: 0.85rem;
  color: var(--tdv-text);
}

.top-values-scope {
  display: block;
  margin-top: 2px;
  color: var(--tdv-text-muted);
  font-size: 0.75rem;
  font-weight: 500;
  max-width: 260px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.top-values-header-row {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: 8px;
  margin-bottom: 8px;
  flex-wrap: wrap;
}

.top-values-selection-actions {
  display: flex;
  align-items: center;
  gap: 6px;
  min-height: 24px;
  margin-left: auto;
}

.top-values-selection-actions.is-inactive {
  visibility: hidden;
  pointer-events: none;
}

.top-values-filter-btn :deep(.p-button) {
  min-height: 22px;
  padding: 0.15rem 0.4rem;
  font-size: 0.72rem;
}

.top-values-filter-btn :deep(.p-button .p-button-icon) {
  font-size: 0.72rem;
}

.top-values-clear-btn :deep(.p-button) {
  min-width: 22px;
  padding: 0.1rem;
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

.top-value-checkbox {
  width: 14px;
  height: 14px;
  cursor: pointer;
  accent-color: var(--tdv-primary);
  flex-shrink: 0;
}

.top-value-checkbox-placeholder {
  width: 14px;
  height: 14px;
  flex-shrink: 0;
}

/* Show button bar when hovering top value row. Use !important to override HoverButtonBar's opacity:0 */
:global(.top-value-row:hover .top-value-actions),
:global(.top-value-row:hover .hover-button-bar) {
  opacity: 1 !important;
  transition-delay: 300ms;
  pointer-events: auto;
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
