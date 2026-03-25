<script setup lang="ts">
import { ref, computed, watch, reactive, toRaw, shallowRef, onBeforeUnmount, nextTick } from 'vue'
import type { TDNode } from 'treedoc'
import { TDNodeType, TDJSONWriter, TDJSONWriterOption } from 'treedoc'
import DataTable from 'primevue/datatable'
import PVColumn from 'primevue/column'
import InputText from 'primevue/inputtext'
import Button from 'primevue/button'
import Paginator from 'primevue/paginator'
import { useTreeStore } from '../stores/treeStore'
import { storeToRefs } from 'pinia'
import JsonPath from './JsonPath.vue'
import ExpandControl from './ExpandControl.vue'
import SimpleValue from './SimpleValue.vue'
import ColumnFilterDialog from './ColumnFilterDialog.vue'
import ColumnSelector from './ColumnSelector.vue'
import ExtendFieldDialog from './ExtendFieldDialog.vue'
import type { ExtendFieldResult } from './ExtendFieldDialog.vue'
import AutoCompleteInput from './AutoCompleteInput.vue'
import PresetSelector from './PresetSelector.vue'
import TimeSeriesChart from './TimeSeriesChart.vue'
import HoverButtonBar, { type HoverButton } from './HoverButtonBar.vue'
import type { QueryPreset, FieldQuery, Column, TableNodeState } from '@/models/types'
import { columnsToFieldQueries, getPresetConfigForPath } from '@/models/types'
import type { ExpandState } from './ExpandControl.vue'
import type { ColumnVisibility } from './ColumnSelector.vue'
import { Logger } from '@/utils/Logger'
import { 
  getCellValue, 
  getCellNode, 
  isComplexValue, 
  getComplexValueSummary,
  copyCellValue,
  copyAsJSON as copy,
  shouldExpandColumns,
  detectTimeColumns
} from '@/utils/TableUtil'
import { matchFieldQuery, matchPattern, createExtendedFieldsFunc, parsePatterns, serializePatterns } from '@/utils/QueryUtil'
import { getValueColorStyle, applyValueColorsFromColumns } from '@/utils/ValueColorService'
import { TableDataProcessor, type TableRow as ProcessorTableRow, type ProcessingConfig } from '@/utils/TableDataProcessor'
import { ColumnManager, type TableColumn as ManagerTableColumn } from '@/utils/ColumnManager'
import { isFilterActive, isFilterDisabled, clearFilterFields } from '@/utils/FieldQueryUtils'

const logger = new Logger('TableView')
const COL_VALUE = '@value'
const COL_NO = '#'
const COL_KEY = '@key'
const CHART_TIME_RANGE_MARKER = '/*tdv_chart_time_range*/'

const STORAGE_KEY_JS_QUERY = 'tdv_recent_js_queries'
const STORAGE_KEY_EXTENDED_FIELDS = 'tdv_recent_extended_fields'

// Recursively remove $$-prefixed keys from an object (TDNode internal metadata)
function cleanInternalKeys(obj: any): any {
  if (obj === null || typeof obj !== 'object') {
    return obj
  }
  // Check if it's a TDNode (has 'type' and 'key' properties)
  if ('type' in obj && 'key' in obj) {
    return obj // Return TDNode as-is
  }
  if (Array.isArray(obj)) {
    return obj.map(cleanInternalKeys)
  }
  const result: Record<string, any> = {}
  for (const [key, value] of Object.entries(obj)) {
    if (!key.startsWith('$$')) {
      result[key] = cleanInternalKeys(value)
    }
  }
  return result
}

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
  
  // Handle plain objects/arrays - clean $$-prefixed keys
  if (typeof value === 'object') {
    return JSON.stringify(cleanInternalKeys(value))
  }
  
  return String(value)
}

const store = useTreeStore()
const { textWrap, maxPane } = storeToRefs(store)

const localSelectedNode = shallowRef<TDNode | null>(null)

const expandControlRef = ref<InstanceType<typeof ExpandControl>>()
const isColumnExpanded = ref(false)
const showAdvancedQuery = ref(false)
const jsQuery = ref('$')
const extendedFields = ref('')
const showExtendedFields = ref(false)
const selectedPresetName = ref<string | null>(null)
const showChart = ref(false)
const first = ref(0)
const rows = ref(100)

// Chart state (lifted up to survive fullscreen toggle)
const chartTimeColumn = ref('')
const chartValueColumn = ref('')
const chartGroupColumn = ref('')
const chartBucketSize = ref<import('@/utils/TableUtil').TimeBucket>('minute')
const chartHiddenGroups = ref<Set<string>>(new Set())
const chartTimeSelectionStart = ref<number | null>(null)
const chartTimeSelectionEnd = ref<number | null>(null)
const chartTimeSelectionColumn = ref('')

const activeFilterColumn = ref<TableColumn | null>(null)
const columnFilterRef = ref<InstanceType<typeof ColumnFilterDialog> | null>(null)
let hoverTimeout: ReturnType<typeof setTimeout> | null = null
let hoverTargetEvent: MouseEvent | null = null

const columnSelectorRef = ref<InstanceType<typeof ColumnSelector> | null>(null)
const columnVisibility = ref<ColumnVisibility[]>([])

// File input for open file in fullscreen mode
const fileInputRef = ref<HTMLInputElement | null>(null)

function openFile() {
  fileInputRef.value?.click()
}

function handleFileSelect(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  
  const reader = new FileReader()
  reader.onload = (e) => {
    const text = e.target?.result as string
    if (text) {
      store.setRawText(text)
    }
  }
  reader.readAsText(file)
  input.value = ''
}

// ExtendFieldDialog state
const showExtendFieldDialog = ref(false)
const extendFieldCellValue = ref<any>(null)
const extendFieldColumn = ref<string>('')

const expandState = reactive<ExpandState>({
  expandLevel: 0,
  minLevel: 0,
  fullyExpand: false,
  moreLevel: false,
  showChildrenSummary: true,
})

interface TableColumn {
  field: string
  header: string
  sortable: boolean
  filterable: boolean
  visible: boolean
  isDerived?: boolean  // True if created by pattern or extended fields
}

interface TableRow {
  [key: string]: TDNode | string | number | undefined
  __node?: TDNode
}

const columns = ref<TableColumn[]>([])
const tableData = ref<TableRow[]>([])
const fieldQueries = ref<Record<string, FieldQuery>>({})

// Keep columnVisibility in sync with columns (auto-update when columns change)
watch(columns, (cols) => {
  // console.log('[TableView] columns watcher triggered, count:', cols.length, 'fields:', cols.map(c => c.field))
  columnVisibility.value = cols.map(c => ({
    field: c.field,
    header: c.header,
    visible: c.visible,
  }))
}, { deep: true })

// Computed to get current column's extendedFields for ExtendFieldDialog
const currentColumnExtendedFields = computed(() => {
  const field = extendFieldColumn.value
  if (!field) return ''
  return fieldQueries.value[field]?.extendedFields || ''
})

// Computed to get current column's patternExtract for ExtendFieldDialog
const currentColumnPatternExtract = computed(() => {
  const field = extendFieldColumn.value
  if (!field) return ''
  return fieldQueries.value[field]?.patternExtract || ''
})

const sortField = ref<string>('')
const sortOrder = ref<1 | -1 | 0>(0)

function createFieldQuery(field: string): FieldQuery {
  return {
    field,
    patternExtract: undefined,
    patternFilter: false,
  }
}

function getFieldQuery(field: string): FieldQuery {
  if (!fieldQueries.value[field]) {
    fieldQueries.value[field] = createFieldQuery(field)
  }
  return fieldQueries.value[field]
}

function hasActiveFilter(field: string): boolean {
  return isFilterActive(fieldQueries.value[field])
}

function hasDisabledFilter(field: string): boolean {
  return isFilterDisabled(fieldQueries.value[field])
}

const activeFilterCount = computed(() => {
  const columnFilterCount = Object.values(fieldQueries.value).filter(fq => isFilterActive(fq)).length
  const hasJsQueryFilter = jsQuery.value.trim() !== '$'
  return columnFilterCount + (hasJsQueryFilter ? 1 : 0)
})

const visibleColumns = computed(() => {
  return columns.value.filter(col => col.visible)
})

const hiddenColumnCount = computed(() => {
  return columns.value.filter(col => !col.visible).length
})

// Check if there are any timestamp columns for chart feature
const hasTimeColumns = computed(() => {
  return detectTimeColumns(tableData.value as any, columns.value as any).length > 0
})

// Current state for preset selector
const currentPresetState = computed(() => ({
  columns: columns.value.map(c => ({
    field: c.field,
    visible: c.visible,
    ...(fieldQueries.value[c.field] ? { ...fieldQueries.value[c.field] } : {}),
  })),
  jsQuery: jsQuery.value,
  expandLevel: expandControlRef.value?.state?.expandLevel,
  currentPath: localSelectedNode.value?.pathAsString || '',
}))

// Persistent preset visibility for columns
const presetColumnVisibility = ref<Map<string, boolean> | null>(null)
// Flag to indicate we're explicitly applying a preset (vs. rebuilding due to query changes)
const isApplyingPreset = ref(false)

// Apply a loaded preset
function applyPreset(preset: QueryPreset) {
  // The selectedPresetName should already be set by PresetSelector via v-model
  // but let's ensure it's set in case it wasn't
  if (selectedPresetName.value !== preset.name) {
    selectedPresetName.value = preset.name
  }

  // Get the current node path for path-based rule matching
  const currentPath = localSelectedNode.value?.pathAsString || ''
  
  // Get the effective configuration for this path
  const config = getPresetConfigForPath(preset, currentPath)
  
  // If no path rule matches, don't apply any configuration
  if (!config) {
    logger.log(`No matching path rule for "${currentPath}" in preset "${preset.name}"`)
    return
  }

  // Set flag to indicate we're explicitly applying a preset
  isApplyingPreset.value = true

  // Save preset column order and visibility for use after rebuild
  presetColumnOrder.value = config.columns.map(c => c.field)
  presetColumnVisibility.value = new Map(
    config.columns
      .filter(c => c.visible !== undefined)
      .map(c => [c.field, c.visible as boolean])
  )

  // Derive extendedFields from the first column that has one (global)
  const colWithExt = config.columns.find(c => c.extendedFields)
  extendedFields.value = colWithExt?.extendedFields || ''

  // Apply field queries from preset columns
  fieldQueries.value = columnsToFieldQueries(config.columns)

  // Apply JS query
  jsQuery.value = config.jsQuery || '$'

  // Apply value colors from preset columns
  applyValueColorsFromColumns(config.columns)

  // Rebuild table to apply changes (derived columns will be positioned using presetColumnOrder)
  rebuildTable()
}

const rawSelectedNode = computed(() => {
  const node = localSelectedNode.value
  return node ? toRaw(node) : null
})

function hideColumn(field: string) {
  const col = columns.value.find(c => c.field === field)
  if (col) {
    col.visible = false
    columnVisibility.value = columns.value.map(c => ({
      field: c.field,
      header: c.header,
      visible: c.visible
    }))
  }
}

function updateColumnVisibility(cols: ColumnVisibility[]) {
  for (const col of cols) {
    const found = columns.value.find(c => c.field === col.field)
    if (found) {
      found.visible = col.visible
    }
  }
  // Update columnVisibility ref for the dialog
  columnVisibility.value = columns.value.map(c => ({
    field: c.field,
    header: c.header,
    visible: c.visible,
  }))
}

function showColumnPopover(event: MouseEvent, col: TableColumn) {
  // Cancel any pending hover timeout
  cancelHoverTimeout()
  
  // Hide existing popover first, then show for new column.
  // Keep user-resized popover dimensions.
  columnFilterRef.value?.hide()
  
  // Set the active column  
  activeFilterColumn.value = col
  nextTick(() => {
    // Use the original event for correct positioning
    columnFilterRef.value?.show(event)
  })
}

function onColumnHeaderMouseEnter(event: MouseEvent, col: TableColumn) {
  // Store the event target for later use
  const targetElement = event.currentTarget as HTMLElement
  
  // Cancel any existing timeout
  cancelHoverTimeout()
  
  // Start 500ms hover timeout
  hoverTimeout = setTimeout(() => {
    // Hide existing popover first; keep user-resized popover dimensions.
    columnFilterRef.value?.hide()
    
    activeFilterColumn.value = col
    nextTick(() => {
      // Create a fake event object that PrimeVue can use for positioning
      const fakeEvent = {
        currentTarget: targetElement,
        target: targetElement,
        preventDefault: () => {},
        stopPropagation: () => {}
      }
      columnFilterRef.value?.show(fakeEvent as unknown as Event)
    })
  }, 500)
}

function onColumnHeaderMouseLeave() {
  cancelHoverTimeout()
}

function cancelHoverTimeout() {
  if (hoverTimeout) {
    clearTimeout(hoverTimeout)
    hoverTimeout = null
  }
}



function updateFieldQuery(query: FieldQuery) {
  if (activeFilterColumn.value) {
    // console.log(`[updateFieldQuery] Field: ${activeFilterColumn.value.field}, patternExtract: "${query.patternExtract}", extendedFields: "${query.extendedFields}"`)
    fieldQueries.value[activeFilterColumn.value.field] = query
  }
}

// Handle chart group filter sync
function onChartGroupFilter(field: string, values: string[]) {
  if (values.length === 0) {
    // Clear the filter for this field
    if (fieldQueries.value[field]) {
      fieldQueries.value[field] = {
        ...fieldQueries.value[field],
        query: '',
        isArray: false,
        isDisabled: false,
      }
    }
  } else {
    // Set array filter with selected values
    fieldQueries.value[field] = {
      field,
      query: values.join(','),
      isRegex: false,
      isNegate: false,
      isArray: true,
      isPattern: false,
      isDisabled: false,
      patternFields: [],
    }
  }
}

function onChartTimeRange(payload: { timeColumn: string; startMs: number | null; endMs: number | null }) {
  const prevColumn = chartTimeSelectionColumn.value

  chartTimeSelectionColumn.value = payload.timeColumn
  chartTimeSelectionStart.value = payload.startMs
  chartTimeSelectionEnd.value = payload.endMs

  if (prevColumn && prevColumn !== payload.timeColumn) {
    clearChartTimeRangeFilter(prevColumn)
  }

  if (!payload.timeColumn || payload.startMs == null || payload.endMs == null) {
    if (payload.timeColumn) {
      clearChartTimeRangeFilter(payload.timeColumn)
    }
    return
  }

  const lower = Math.min(payload.startMs, payload.endMs)
  const upper = Math.max(payload.startMs, payload.endMs)
  const rangeExpression = buildChartTimeRangeExpression(lower, upper)
  const existing = fieldQueries.value[payload.timeColumn] || createFieldQuery(payload.timeColumn)

  fieldQueries.value[payload.timeColumn] = {
    ...existing,
    jsExpression: rangeExpression,
    isDisabled: false,
  }
}

function isChartTimeRangeExpression(jsExpression?: string): boolean {
  return !!jsExpression && jsExpression.includes(CHART_TIME_RANGE_MARKER)
}

function clearChartTimeRangeFilter(field: string) {
  const existing = fieldQueries.value[field]
  if (!existing || !isChartTimeRangeExpression(existing.jsExpression)) return
  fieldQueries.value[field] = {
    ...existing,
    jsExpression: undefined,
  }
}

function buildChartTimeRangeExpression(startMs: number, endMs: number): string {
  return `${CHART_TIME_RANGE_MARKER} Number($) >= ${startMs} && Number($) <= ${endMs}`
}


// Track derived columns (both pattern-matched and extended fields)
const patternExtractedColumns = ref<string[]>([])
// Track source field for each derived column (persists for column ordering)
const derivedColumnSourceMap = ref<Map<string, string>>(new Map())

// Data processor instance for testable data transformation logic
const dataProcessor = new TableDataProcessor(valueToSearchString)

const filteredData = computed(() => {
  // logger.log(`Filtering data: initial count=${tableData.value.length}`)
  
  // Use TableDataProcessor for core data transformation
  const config: ProcessingConfig = {
    fieldQueries: fieldQueries.value,
    columnOrder: columns.value.map(c => c.field),
    jsQuery: jsQuery.value,
    valueToString: valueToSearchString
  }
  
  const result = dataProcessor.processData(tableData.value as ProcessorTableRow[], config)
  const { data, derivedColumns: newDerivedColumns, derivedColumnSources: derivedColumnSource } = result
  
  // Update derived columns (unified handling for both pattern and extended field columns)
  const newDerivedSet = new Set(newDerivedColumns)
  const derivedColumnsChanged = newDerivedColumns.length !== patternExtractedColumns.value.length ||
      newDerivedColumns.some((c, i) => patternExtractedColumns.value[i] !== c)
  
  if (derivedColumnsChanged) {
    patternExtractedColumns.value = [...newDerivedColumns]
    
    // Update the global source map with new entries
    for (const [col, source] of derivedColumnSource) {
      derivedColumnSourceMap.value.set(col, source)
    }
    // Remove entries for columns no longer present
    for (const key of derivedColumnSourceMap.value.keys()) {
      if (!newDerivedSet.has(key)) {
        derivedColumnSourceMap.value.delete(key)
      }
    }
    
    // Remove old derived columns that are no longer present
    const columnsToRemove = columns.value.filter(col => 
      col.isDerived && !newDerivedSet.has(col.field)
    )
    if (columnsToRemove.length > 0) {
      columns.value = columns.value.filter(col => 
        !col.isDerived || newDerivedSet.has(col.field)
      )
    }
    
    // Add all derived columns to the columns list
    for (const colName of newDerivedColumns) {
      if (!columns.value.find(c => c.field === colName)) {
        const sourceField = derivedColumnSourceMap.value.get(colName)
        
        // Check visibility from multiple sources: preset (only when applying), saved state, then default to true
        const presetVisible = isApplyingPreset.value ? presetColumnVisibility.value?.get(colName) : undefined
        const savedVisible = savedColumnVisibility.value?.get(colName)
        const visible = presetVisible !== undefined ? presetVisible : (savedVisible !== undefined ? savedVisible : true)
        
        const newCol = {
          field: colName,
          header: colName,
          sortable: true,
          filterable: true,
          visible,
          isDerived: true,
        }
        
        // If we have a preset order, check if this column should go at a specific position
        if (presetColumnOrder.value) {
          const presetIndex = presetColumnOrder.value.indexOf(colName)
          if (presetIndex !== -1) {
            // Find the best position based on preset order
            let insertIndex = 0
            for (let i = 0; i < columns.value.length; i++) {
              const existingPresetIndex = presetColumnOrder.value.indexOf(columns.value[i].field)
              if (existingPresetIndex !== -1 && existingPresetIndex < presetIndex) {
                insertIndex = i + 1
              }
            }
            columns.value.splice(insertIndex, 0, newCol)
            continue
          }
        }
        
        // Fallback: insert after source field
        if (sourceField) {
          const sourceIndex = columns.value.findIndex(c => c.field === sourceField)
          if (sourceIndex !== -1) {
            // Find the last consecutive derived column after source to insert after all of them
            let insertIndex = sourceIndex + 1
            while (insertIndex < columns.value.length) {
              const col = columns.value[insertIndex]
              // Check if this column was also derived from the same source (use global map)
              if (col.isDerived && derivedColumnSourceMap.value.get(col.field) === sourceField) {
                insertIndex++
              } else {
                break
              }
            }
            columns.value.splice(insertIndex, 0, newCol)
            continue
          }
        }
        // Final fallback: push to end if source not found
        columns.value.push(newCol)
      }
    }
  }
  
  // Apply preset order and visibility OUTSIDE the derivedColumnsChanged block
  // This ensures they're applied even when reapplying the same preset
  if (tableData.value.length > 0) {
    if (presetColumnOrder.value && presetColumnOrder.value.length > 0) {
      const orderMap = new Map(presetColumnOrder.value.map((field, i) => [field, i]))
      columns.value.sort((a, b) => {
        const aOrder = orderMap.get(a.field) ?? Infinity
        const bOrder = orderMap.get(b.field) ?? Infinity
        return aOrder - bOrder
      })
      // Clear preset order after applying (only apply once)
      presetColumnOrder.value = null
    }
    
    // Apply preset visibility to all columns ONLY when explicitly applying a preset
    // (not during subsequent rebuilds like adding extended fields)
    if (isApplyingPreset.value && presetColumnVisibility.value && presetColumnVisibility.value.size > 0) {
      for (const col of columns.value) {
        const presetVisible = presetColumnVisibility.value.get(col.field)
        if (presetVisible !== undefined) {
          col.visible = presetVisible
        }
      }
      // Clear the flag after applying - subsequent rebuilds won't reapply visibility
      isApplyingPreset.value = false
    }
  }
  
  // JS query is already applied by the processor
  return data as TableRow[]
})

const paginatedData = computed(() => {
  return filteredData.value.slice(first.value, first.value + rows.value)
})


// Get the value for an extended field, preferring TDNode if available
function getExtValue(val: any): any {
  if (!val || typeof val !== 'object') return val
  // If $$tdNode exists and is a TDNode (has 'type' property), use it
  const tdNode = val.$$tdNode
  if (tdNode && typeof tdNode === 'object' && 'type' in tdNode) {
    return tdNode
  }
  // Otherwise clean $$-prefixed keys from the object
  return cleanInternalKeys(val)
}

// Add extended object to row, handling spread notation (keys ending with _)
function addExtObject(key: string, val: any, row: TableRow) {
  if (key.endsWith('_') && val) {
    // Spread the children
    if (Array.isArray(val)) {
      for (let i = 0; i < val.length; i++) {
        const field = key + i
        addColumn(field, field, true)
        row[field] = getExtValue(val[i])
      }
      return
    } else if (typeof val === 'object') {
      for (const k of Object.keys(val)) {
        if (k.startsWith('$$')) continue
        const field = key + k
        addColumn(field, field, true)
        row[field] = getExtValue(val[k])
      }
      return
    }
  }
  // Regular field
  addColumn(key, key, true)
  row[key] = getExtValue(val)
}

// Persistent column visibility from saved state (survives until derived columns are processed)
const savedColumnVisibility = ref<Map<string, boolean> | null>(null)
// Temporary column order for reordering during rebuild
let savedColumnOrder: string[] | null = null

// Persistent preset column order for derived columns positioning
const presetColumnOrder = ref<string[] | null>(null)

function addColumn(field: string, header: string, isExtended: boolean = false) {
  if (!columns.value.find(c => c.field === field)) {
    // Check if we have saved visibility for this column
    const visible = savedColumnVisibility.value?.get(field) ?? true
    columns.value.push({
      field,
      header: isExtended ? `⊕${header}` : header,
      sortable: true,
      filterable: true,
      visible,
    })
  }
}

let isBuilding = false

function buildTable(node: TDNode | null, restoreState = true) {
  isBuilding = true
  try {
    buildTableInternal(node, restoreState)
  } finally {
    isBuilding = false
  }
}

function buildTableInternal(node: TDNode | null, restoreState = true) {
  // logger.log(`Building table for node: ${node?.key}, restoreState=${restoreState}`)
  
  // Save current column visibility and order before rebuilding (for non-restore rebuilds)
  const currentFieldQueries = { ...fieldQueries.value }
  if (!restoreState) {
    savedColumnVisibility.value = new Map<string, boolean>()
    savedColumnOrder = []
    for (const col of columns.value) {
      savedColumnVisibility.value.set(col.field, col.visible)
      savedColumnOrder.push(col.field)
    }
  } else {
    savedColumnVisibility.value = null
    savedColumnOrder = null
  }
  
  columns.value = []
  tableData.value = []
  // Always clear derived column tracking when columns are cleared
  // This ensures derived columns get re-added in filteredData computed
  patternExtractedColumns.value = []
  derivedColumnSourceMap.value = new Map()
  if (restoreState) {
    fieldQueries.value = {}
  }
  if (!node || !node.children) return
  
  // Check if we have cached state for this node - do this BEFORE adding columns
  const cachedState = store.getTableState(node)
  
  // Always restore UI state if available (independent of restoreState flag)
  if (cachedState) {
    // Restore with explicit false default to prevent panel from showing unexpectedly
    showExtendedFields.value = cachedState.showExtendedFields ?? false
    showAdvancedQuery.value = cachedState.showAdvancedQuery ?? false
    // Only restore selectedPresetName if we're doing a full state restore
    // (not when rebuilding after applying a preset)
    if (restoreState) {
      selectedPresetName.value = cachedState.selectedPresetName ?? null
    }
  }
  
  if (cachedState && restoreState) {
    isColumnExpanded.value = cachedState.isColumnExpanded
    // Restore query state
    jsQuery.value = cachedState.query.jsQuery || '$'
    // Restore field queries and extendedFields from cached columns
    const cachedColumns = cachedState.query.columns || []
    for (const col of cachedColumns) {
      fieldQueries.value[col.field] = { ...col }
      if (col.extendedFields) extendedFields.value = col.extendedFields
    }
    // Set up column visibility from cache for addColumn and derived columns to use
    if (cachedColumns.length > 0) {
      savedColumnVisibility.value = new Map<string, boolean>()
      for (const col of cachedColumns) {
        if (col.visible !== undefined) {
          savedColumnVisibility.value.set(col.field, col.visible)
        }
      }
    }
    // Restore chart state
    if (cachedState.chartState) {
      showChart.value = cachedState.chartState.showChart ?? false
      chartTimeColumn.value = cachedState.chartState.timeColumn ?? ''
      chartValueColumn.value = cachedState.chartState.valueColumn ?? ''
      chartGroupColumn.value = cachedState.chartState.groupColumn ?? ''
      chartBucketSize.value = (cachedState.chartState.bucketSize as import('@/utils/TableUtil').TimeBucket) ?? 'minute'
      chartHiddenGroups.value = new Set(cachedState.chartState.hiddenGroups ?? [])
      chartTimeSelectionStart.value = cachedState.chartState.timeSelectionStart ?? null
      chartTimeSelectionEnd.value = cachedState.chartState.timeSelectionEnd ?? null
      chartTimeSelectionColumn.value = cachedState.chartState.timeSelectionColumn ?? ''
    }
  } else if (!cachedState) {
    // First time visiting this node - auto-detect
    isColumnExpanded.value = shouldExpandColumns(node)
  }
  
  // Restore current field queries if not restoring from cache
  if (!restoreState) {
    fieldQueries.value = currentFieldQueries
  }
  
  const isArray = node.type === TDNodeType.ARRAY
  const keyCol = isArray ? COL_NO : COL_KEY
  
  // Add key column (use saved visibility if available)
  const keyColVisible = savedColumnVisibility.value?.get(keyCol) ?? true
  columns.value.push({
    field: keyCol,
    header: keyCol,
    sortable: true,
    filterable: true,
    visible: keyColVisible,
  })
  
  // Create extended fields evaluator
  const extFunc = createExtendedFieldsFunc(extendedFields.value)
  
  // Build rows
  for (const child of node.children) {
    const row: TableRow = {
      [keyCol]: isArray ? Number(child.key) : child.key,
      __node: child,
    }
    
    if (isColumnExpanded.value && child.children) {
      // Expand child properties as columns
      for (const grandChild of child.children) {
        const field = grandChild.key!
        if (!columns.value.find(c => c.field === field)) {
          const visible = savedColumnVisibility.value?.get(field) ?? true
          columns.value.push({
            field,
            header: field,
            sortable: true,
            filterable: true,
            visible,
          })
        }
        row[field] = grandChild
      }
    } else {
      // Just add value column
      if (!columns.value.find(c => c.field === COL_VALUE)) {
        const visible = savedColumnVisibility.value?.get(COL_VALUE) ?? true
        columns.value.push({
          field: COL_VALUE,
          header: COL_VALUE,
          sortable: true,
          filterable: true,
          visible,
        })
      }
      row[COL_VALUE] = child
    }
    
    // Apply extended fields
    if (extFunc) {
      try {
        const obj = child.toObject(true, true)
        const ext = extFunc(obj)
        for (const k in ext) {
          addExtObject(k, ext[k], row)
        }
      } catch (e) {
        console.error('Error evaluating extended fields:', extendedFields.value)
        // console.error(e)
      }
    }
    
    tableData.value.push(row)
  }
  
  // Reorder columns to match saved order (for non-restore rebuilds)
  if (savedColumnOrder && savedColumnOrder.length > 0) {
    const currentColumnsMap = new Map(columns.value.map(c => [c.field, c]))
    const reorderedColumns: typeof columns.value = []
    
    // First, add columns in saved order (if they exist)
    for (const field of savedColumnOrder) {
      const col = currentColumnsMap.get(field)
      if (col) {
        reorderedColumns.push(col)
        currentColumnsMap.delete(field)
      }
    }
    
    // Then, append any new columns that weren't in saved order
    for (const col of currentColumnsMap.values()) {
      reorderedColumns.push(col)
    }
    
    columns.value = reorderedColumns
  }
  
  // Clear saved order after build is complete (visibility is kept for derived columns)
  savedColumnOrder = null
  
  // Note: columnVisibility is auto-updated by the watcher on columns
  // savedColumnVisibility is NOT cleared here - it's kept for derived columns in filteredData
}

function nodeClicked(path: string[]) {
  store.selectNode(path)
}


function isKeyColumn(field: string): boolean {
  return field === COL_NO || field === COL_KEY
}

function getCellColorStyle(data: any, field: string): Record<string, string> | null {
  const value = getCellValue(data, field)
  const style = getValueColorStyle(field, String(value))
  if (style) {
    // Add CSS variable for pseudo-element background
    return {
      ...style,
      '--cell-bg-color': style.backgroundColor,
    }
  }
  return style
}

function getRowNodePath(row: TableRow): string[] {
  const node = row.__node
  return node ? ['', ...node.path] : []
}

function onKeyPress(e: KeyboardEvent) {
  expandControlRef.value?.onKeyPress(e)
  if (e.key === 'f') {
    store.toggleMaxPane('table')
  } else if (e.key === 'w') {
    textWrap.value = !textWrap.value
  }
}

function onPage(event: { first: number; rows: number }) {
  first.value = event.first
  rows.value = event.rows
}

function clearAllFilters() {
  // Clear only filtering state; preserve other configuration (extended fields, chart, layout, etc.)
  const nextQueries: Record<string, FieldQuery> = {}
  for (const [field, fq] of Object.entries(fieldQueries.value)) {
    nextQueries[field] = clearFilterFields(fq)
  }
  fieldQueries.value = nextQueries
  jsQuery.value = '$'
}

function filterCellValue(field: string, value: any, isNegate: boolean) {
  const strValue = value === null || value === undefined 
    ? '' 
    : typeof value === 'object' && 'value' in value 
      ? String((value as TDNode).value) 
      : String(value)
  
  const currentFq = fieldQueries.value[field]
  
  // If existing filter has different negate mode, override it
  if (currentFq && currentFq.isArray && !!currentFq.isNegate !== isNegate) {
    fieldQueries.value[field] = {
      field,
      query: strValue,
      isRegex: false,
      isNegate: isNegate,
      isArray: true,
      isPattern: false,
      isDisabled: false,
      patternFields: []
    }
    return
  }
  
  // Add to existing array filter or create new one
  if (currentFq && currentFq.isArray && currentFq.query) {
    const existingValues = currentFq.query.split(',').map(v => v.trim())
    if (!existingValues.includes(strValue)) {
      existingValues.push(strValue)
      fieldQueries.value[field] = {
        ...currentFq,
        query: existingValues.join(',')
      }
    }
  } else {
    fieldQueries.value[field] = {
      field,
      query: strValue,
      isRegex: false,
      isNegate: isNegate,
      isArray: true,
      isPattern: false,
      isDisabled: false,
      patternFields: []
    }
  }
}

function shouldShowOpenInNewTab(row: TableRow, field: string): boolean {
  if (isComplexValue(row, field)) return true
  const value = getCellValue(row, field)
  return typeof value === 'string' && value.length > 200
}

function openCellInNewTab(row: TableRow, field: string) {
  const node = getCellNode(row, field)
  let content: string
  
  if (node && isComplexValue(row, field)) {
    // Complex value - serialize as JSON
    content = TDJSONWriter.get().writeAsString(node, new TDJSONWriterOption().setIndentFactor(2))
  } else {
    // Simple value (either TDNode with simple type, or plain value)
    const value = getCellValue(row, field)
    if (!value) return
    content = value
  }
  
  const dataKey = `tdv_temp_${Date.now()}`
  try {
    localStorage.setItem(dataKey, content)
    const newUrl = `${window.location.origin}${window.location.pathname}#/?data=${dataKey}`
    window.open(newUrl, '_blank')
    setTimeout(() => localStorage.removeItem(dataKey), 5000)
  } catch (e) {
    console.error('Failed to open in new tab', e)
  }
}

function openExtendFieldDialog(row: TableRow, field: string) {
  extendFieldCellValue.value = row[field]
  extendFieldColumn.value = field
  showExtendFieldDialog.value = true
}

// Evaluate link expression for a cell
// Expression can use $ for cell value and $$ for row
function evaluateLinkExpression(row: TableRow, field: string): string | null {
  const fq = fieldQueries.value[field]
  if (!fq?.linkExpression) return null
  
  try {
    const cellValue = getCellValue(row, field)
    // Create function with $ (cell value) and $$ (row) as parameters
    const fn = new Function('$', '$$', `return ${fq.linkExpression}`)
    const result = fn(cellValue, row)
    return typeof result === 'string' ? result : null
  } catch (e) {
    console.warn(`Link expression error for field ${field}:`, e)
    return null
  }
}

// Check if a column has a link expression configured
function hasLinkExpression(field: string): boolean {
  return !!fieldQueries.value[field]?.linkExpression
}

// Generate buttons for cell hover bar
function getCellButtons(row: TableRow, field: string): HoverButton[] {
  return [
    { id: 'copy', icon: 'pi-copy', title: 'Copy cell', variant: 'copy' },
    { id: 'filter-in', icon: 'pi-filter', title: 'Filter in this value', variant: 'filter-in' },
    { id: 'filter-out', icon: 'pi-filter-slash', title: 'Filter out this value', variant: 'filter-out' },
    { id: 'open-new', icon: 'pi-external-link', title: 'Open in new tab', variant: 'link', visible: shouldShowOpenInNewTab(row, field) },
    { id: 'extend', icon: 'pi-plus-circle', title: 'Create pattern or extract fields', variant: 'extend' }
  ]
}

// Handle cell button bar clicks
function handleCellButtonClick(buttonId: string, row: TableRow, field: string) {
  switch (buttonId) {
    case 'copy':
      copyCellValue(row, field)
      break
    case 'filter-in':
      filterCellValue(field, row[field], false)
      break
    case 'filter-out':
      filterCellValue(field, row[field], true)
      break
    case 'open-new':
      openCellInNewTab(row, field)
      break
    case 'extend':
      openExtendFieldDialog(row, field)
      break
  }
}

function handleExtendFieldResult(result: ExtendFieldResult) {
  const field = extendFieldColumn.value
  if (!field) return
  
  const existingQuery = fieldQueries.value[field] || {
    query: '',
    isRegex: false,
    isNegate: false,
    isArray: false,
    isPattern: false,
    isDisabled: false,
    patternFields: [],
  }
  
  if (result.type === 'pattern' && result.pattern) {
    const newPattern = result.pattern
    const existingPatterns = parsePatterns(existingQuery.patternExtract || '')
    let allPatterns: string[]
    
    if (result.originalPattern && existingPatterns.includes(result.originalPattern)) {
      // Replace the original pattern with the new one (in the same position)
      allPatterns = existingPatterns.map(p => p === result.originalPattern ? newPattern : p)
    } else {
      // Add new pattern to front, skip if already exists
      if (existingPatterns.includes(newPattern)) {
        return  // Pattern already exists, nothing to do
      }
      allPatterns = [newPattern, ...existingPatterns]
    }
    
    fieldQueries.value[field] = {
      ...existingQuery,
      patternExtract: serializePatterns(allPatterns),
    }
  }
  // Note: jsonpath is now handled by immediate sync via handleUpdateExtendedFields
}

// Handle immediate sync of JSON path extended fields from ExtendFieldDialog
function handleUpdateExtendedFields(fields: string) {
  const field = extendFieldColumn.value
  // console.log('[TableView] handleUpdateExtendedFields called, field:', field, 'fields:', fields)
  if (!field) return
  
  const existingQuery = fieldQueries.value[field] || {
    query: '',
    isRegex: false,
    isNegate: false,
    isArray: false,
    isPattern: false,
    isDisabled: false,
    patternFields: [],
  }
  
  fieldQueries.value[field] = {
    ...existingQuery,
    extendedFields: fields,
  }
}

function rebuildTable() {
  const node = localSelectedNode.value
  if (node) buildTable(toRaw(node), false)
  first.value = 0
}

function toggleExtendedFields() {
  showExtendedFields.value = !showExtendedFields.value
}

function saveCurrentTableState() {
  const node = localSelectedNode.value
  if (node) {
    const sortDir: 'asc' | 'desc' | '' = sortOrder.value === 1 ? 'asc' : sortOrder.value === -1 ? 'desc' : ''
    const stateToSave: TableNodeState = {
      query: {
        limit: rows.value,
        offset: first.value,
        sortField: sortField.value,
        sortDir,
        jsQuery: jsQuery.value,
        columns: columns.value.map(c => ({
          ...c,
          ...(fieldQueries.value[c.field] ? { ...fieldQueries.value[c.field] } : {}),
          // Ensure actual column visibility is preserved (not overwritten by fieldQueries)
          visible: c.visible,
        })),
      },
      expandedLevel: expandState.expandLevel,
      isColumnExpanded: isColumnExpanded.value,
      showExtendedFields: showExtendedFields.value,
      showAdvancedQuery: showAdvancedQuery.value,
      selectedPresetName: selectedPresetName.value,
      chartState: {
        showChart: showChart.value,
        timeColumn: chartTimeColumn.value,
        valueColumn: chartValueColumn.value,
        groupColumn: chartGroupColumn.value,
        bucketSize: chartBucketSize.value,
        hiddenGroups: Array.from(chartHiddenGroups.value),
        timeSelectionStart: chartTimeSelectionStart.value,
        timeSelectionEnd: chartTimeSelectionEnd.value,
        timeSelectionColumn: chartTimeSelectionColumn.value
      }
    }
    store.saveTableState(toRaw(node), stateToSave)
  }
}

// Save state before component unmounts (e.g., when toggling fullscreen)
onBeforeUnmount(() => {
  saveCurrentTableState()
})

watch(
  () => store.nodeVersion,
  () => {
    // Save current node's state before switching
    saveCurrentTableState()
    
    const newNode = store.getRawSelectedNode()
    // logger.log(`Selected node changed: ${newNode?.key}`)
    localSelectedNode.value = newNode
    if (newNode) {
      buildTable(newNode)
      first.value = 0
    }
    // logger.log(`Selected node changed end`)
  },
  { immediate: true }
)

watch(isColumnExpanded, () => {
  if (isBuilding) return
  // logger.log(`isColumnExpanded changed: ${isColumnExpanded.value}`)
  const node = localSelectedNode.value
  if (node) {
    saveCurrentTableState()
    buildTable(toRaw(node), false)
  }
  // logger.log(`isColumnExpanded changed end`)
})

defineExpose({ onKeyPress, applyPreset })

const whiteSpaceStyle = computed(() => (textWrap.value ? 'pre-wrap' : 'pre'))
</script>

<template>
  <div class="table-view" tabindex="0">
    <!-- Column Filter Popover -->
    <ColumnFilterDialog
      v-if="activeFilterColumn"
      ref="columnFilterRef"
      :field="activeFilterColumn.field"
      :title="activeFilterColumn.header"
      :field-query="getFieldQuery(activeFilterColumn.field)"
      :filtered-data="filteredData"
      @update:field-query="updateFieldQuery"
      @hide-column="hideColumn(activeFilterColumn.field)"
    />
    
    <!-- Extend Field Dialog -->
    <ExtendFieldDialog
      v-model:visible="showExtendFieldDialog"
      :cell-value="extendFieldCellValue"
      :column-field="extendFieldColumn"
      :current-extended-fields="currentColumnExtendedFields"
      :current-pattern-extract="currentColumnPatternExtract"
      @apply="handleExtendFieldResult"
      @update-extended-fields="handleUpdateExtendedFields"
    />
    
    <!-- Column Selector Popover -->
    <ColumnSelector
      ref="columnSelectorRef"
      :columns="columnVisibility"
      @update:columns="updateColumnVisibility"
    />
    
    <!-- Hidden file input for open file -->
    <input
      ref="fileInputRef"
      type="file"
      accept=".json,.txt,.xml,.yaml,.yml,.csv,.log,*"
      style="display: none"
      @change="handleFileSelect"
    />
    
    <!-- Full header in normal mode -->
    <div class="table-header">
      <JsonPath :tree-node="rawSelectedNode" @node-clicked="nodeClicked" />
      
      <div class="table-toolbar">
        <!-- Open file button (only in fullscreen mode) -->
        <Button
          v-if="maxPane === 'table'"
          icon="pi pi-folder-open"
          size="small"
          text
          @click="openFile"
          v-tooltip.top="'Open File'"
        />
        
        <div v-if="maxPane === 'table'" class="toolbar-separator" />
        
        <ExpandControl
          v-if="store.hasTreeInTable"
          ref="expandControlRef"
          :state="expandState"
          :active="true"
        />
        
        <Button
          icon="pi pi-arrows-h"
          size="small"
          :severity="isColumnExpanded ? 'primary' : 'secondary'"
          text
          @click="isColumnExpanded = !isColumnExpanded"
          v-tooltip.top="'Expand children as columns'"
        />
        
        <Button
          icon="pi pi-table"
          size="small"
          :severity="hiddenColumnCount > 0 ? 'warning' : 'secondary'"
          text
          @click="columnSelectorRef?.toggle($event)"
          v-tooltip.top="'Select columns (' + visibleColumns.length + '/' + columns.length + ')'"
        />
        
        <div class="toolbar-separator" />
        
        <PresetSelector
          v-model="selectedPresetName"
          :currentState="currentPresetState"
          @load="applyPreset"
        />
        
        <div class="toolbar-separator" />
        
        <Button
          icon="pi pi-copy"
          size="small"
          text
          @click="copy(filteredData as any, visibleColumns as any, false)"
          v-tooltip.top="'Copy as JSON'"
        />
        
        <Button
          icon="pi pi-file-export"
          size="small"
          text
          @click="copy(filteredData as any, visibleColumns as any, true)"
          v-tooltip.top="'Copy as CSV'"
        />
        
        <Button
          :icon="textWrap ? 'pi pi-align-left' : 'pi pi-align-justify'"
          size="small"
          :severity="textWrap ? 'primary' : 'secondary'"
          text
          @click="textWrap = !textWrap"
          v-tooltip.top="'Wrap text <w>'"
        />
        
        <Button
          v-if="hasTimeColumns"
          icon="pi pi-chart-bar"
          size="small"
          :severity="showChart ? 'primary' : 'secondary'"
          text
          @click="showChart = !showChart"
          v-tooltip.top="'Time series chart'"
        />
        
        <Button
          icon="pi pi-code"
          size="small"
          :severity="showAdvancedQuery ? 'primary' : 'secondary'"
          text
          @click="showAdvancedQuery = !showAdvancedQuery"
          v-tooltip.top="'Advanced JS Query'"
        />
        
        <Button
          icon="pi pi-plus-circle"
          size="small"
          :severity="showExtendedFields ? 'primary' : (extendedFields ? 'success' : 'secondary')"
          text
          @click="toggleExtendedFields"
          v-tooltip.top="'Extended Fields (add computed columns)'"
        />
        
        <template v-if="activeFilterCount > 0">
          <Button
            icon="pi pi-filter-slash"
            size="small"
            severity="warning"
            text
            @click="clearAllFilters"
            v-tooltip.top="'Clear all filters (' + activeFilterCount + ')'"
          />
        </template>
        
        <Button
          icon="pi pi-expand"
          size="small"
          :severity="maxPane === 'table' ? 'primary' : 'secondary'"
          text
          @click="store.toggleMaxPane('table')"
          v-tooltip.top="'Toggle fullscreen <f>'"
        />
        
        <div class="nav-buttons">
          <Button
            icon="pi pi-arrow-left"
            size="small"
            text
            :disabled="!store.canBack"
            @click="store.back()"
            v-tooltip.top="'Go back [<]'"
          />
          <Button
            icon="pi pi-arrow-right"
            size="small"
            text
            :disabled="!store.canForward"
            @click="store.forward()"
            v-tooltip.top="'Go forward [>]'"
          />
        </div>
      </div>
    </div>
    
    <div v-if="showAdvancedQuery" class="advanced-query">
      <label>
        JS Query:
        <div class="input-with-clear">
          <AutoCompleteInput
            v-model="jsQuery"
            placeholder="Custom query in JS. E.g. $.name.length > 10"
            :storage-key="STORAGE_KEY_JS_QUERY"
            input-class="query-input"
          />
          <Button
            v-if="jsQuery && jsQuery !== '$'"
            icon="pi pi-times"
            size="small"
            severity="secondary"
            text
            class="clear-btn"
            @click="jsQuery = '$'"
            v-tooltip.top="'Clear JS Query'"
          />
        </div>
      </label>
    </div>
    
    <div v-if="showExtendedFields" class="extended-fields-panel">
      <label class="extended-fields-label">
        Extended Fields:
        <div class="input-with-clear">
          <AutoCompleteInput
            v-model="extendedFields"
            placeholder="Add computed columns. E.g. fullName: $.first + ' ' + $.last, tags_: $.metadata.tags"
            :storage-key="STORAGE_KEY_EXTENDED_FIELDS"
            input-class="extended-fields-input"
            @blur="rebuildTable"
            @enter="rebuildTable"
          />
          <Button
            v-if="extendedFields"
            icon="pi pi-times"
            size="small"
            severity="secondary"
            text
            class="clear-btn"
            @click="extendedFields = ''; rebuildTable()"
            v-tooltip.top="'Clear Extended Fields'"
          />
        </div>
      </label>
      <div class="extended-fields-help">
        <small>
          Syntax: <code>fieldName: $.path.to.value</code> • 
          Spread arrays/objects: <code>items_: $.children</code> (adds items_0, items_1, ...)
        </small>
      </div>
    </div>
    
    <TimeSeriesChart
      v-if="showChart && hasTimeColumns"
      :data="filteredData as any"
      :columns="columns as any"
      :time-column-model="chartTimeColumn"
      :value-column-model="chartValueColumn"
      :group-column-model="chartGroupColumn"
      :bucket-size-model="chartBucketSize"
      :hidden-groups-model="chartHiddenGroups"
      :time-selection-start-model="chartTimeSelectionStart"
      :time-selection-end-model="chartTimeSelectionEnd"
      @close="showChart = false"
      @update:group-filter="onChartGroupFilter"
      @update:time-column="chartTimeColumn = $event"
      @update:value-column="chartValueColumn = $event"
      @update:group-column="chartGroupColumn = $event"
      @update:bucket-size="chartBucketSize = $event"
      @update:hidden-groups="chartHiddenGroups = $event"
      @update:time-range="onChartTimeRange"
    />
    
    <div class="table-content">
      <DataTable
        :value="paginatedData"
        :sortField="sortField"
        :sortOrder="sortOrder"
        @sort="e => { sortField = e.sortField as string; sortOrder = e.sortOrder as 1 | -1 | 0 }"
        sortMode="multiple"
        removableSort
        stripedRows
        size="small"
        tableStyle="min-width: 100%"
        resizableColumns
        columnResizeMode="expand"
        scrollable 
        scrollHeight="flex"
      >
        <PVColumn
          v-for="col in visibleColumns"
          :key="col.field"
          :field="col.field"
          :sortable="col.sortable"
        >
          <template #header="{ column }">
            <div 
              class="column-header"
              @click.stop="showColumnPopover($event, col)"
              @mouseenter="onColumnHeaderMouseEnter($event, col)"
              @mouseleave="onColumnHeaderMouseLeave"
            >
              <span class="column-title" :class="{ 'has-filter': hasActiveFilter(col.field), 'has-disabled-filter': hasDisabledFilter(col.field) }">
                {{ col.header }}
              </span>
              <i 
                v-if="hasActiveFilter(col.field)" 
                class="pi pi-filter-fill column-filter-indicator"
                :class="{ 'filter-disabled': hasDisabledFilter(col.field) }"
              />
            </div>
          </template>
          <template #body="{ data, index }">
            <div class="cell-outer" :class="{ 'has-color': getCellColorStyle(data, col.field) }" :style="getCellColorStyle(data, col.field)">
              <div class="cell-wrapper">
                <div class="cell-content">
                  <template v-if="isKeyColumn(col.field)">
                    <a 
                      href="#" 
                      class="key-link"
                      @click.prevent="nodeClicked(getRowNodePath(data))"
                    >
                      {{ getCellValue(data, col.field) }}
                    </a>
                  </template>
                  <template v-else-if="isComplexValue(data, col.field)">
                    <a 
                      href="#" 
                      class="complex-value-link"
                      @click.prevent="nodeClicked(['', ...getCellNode(data, col.field)!.path])"
                    >
                      <span class="complex-value-summary" :style="{ whiteSpace: whiteSpaceStyle }">
                        {{ getComplexValueSummary(data, col.field) }}
                      </span>
                    </a>
                  </template>
                  <template v-else-if="getCellNode(data, col.field)">
                    <a 
                      v-if="evaluateLinkExpression(data, col.field)"
                      :href="evaluateLinkExpression(data, col.field)!"
                      target="_blank"
                      class="cell-link"
                    >
                      <SimpleValue
                        :tnode="getCellNode(data, col.field)!"
                        :is-in-table="true"
                        :text-wrap="textWrap"
                      />
                    </a>
                    <SimpleValue
                      v-else
                      :tnode="getCellNode(data, col.field)!"
                      :is-in-table="true"
                      :text-wrap="textWrap"
                      @node-clicked="nodeClicked([$event])"
                    />
                  </template>
                  <template v-else>
                    <a 
                      v-if="evaluateLinkExpression(data, col.field)"
                      :href="evaluateLinkExpression(data, col.field)!"
                      target="_blank"
                      class="cell-link"
                    >
                      <span class="simple-cell-value" :style="{ whiteSpace: whiteSpaceStyle }">{{ getCellValue(data, col.field) }}</span>
                    </a>
                    <span v-else class="simple-cell-value" :style="{ whiteSpace: whiteSpaceStyle }">{{ getCellValue(data, col.field) }}</span>
                  </template>
                </div>
              </div>
              <HoverButtonBar
                v-if="data[col.field] != null"
                :buttons="getCellButtons(data, col.field)"
                layout="absolute"
                :position-below="index === 0"
                class="cell-button-bar"
                @click="handleCellButtonClick($event, data, col.field)"
              />
            </div>
          </template>
        </PVColumn>
        
        <template #empty>
          <div class="empty-table">
            <i class="pi pi-inbox"></i>
            <span>No data available</span>
          </div>
        </template>
      </DataTable>
      
      <Paginator
        v-if="filteredData.length > 0"
        :first="first"
        :rows="rows"
        :totalRecords="filteredData.length"
        :rowsPerPageOptions="[50, 100, 200, 500, 1000]"
        @page="onPage"
      >
        <template #end>
          <span class="paginator-total">
            <template v-if="activeFilterCount > 0">
              <i class="pi pi-filter"></i>
              {{ filteredData.length }} / {{ tableData.length }}
            </template>
            <template v-else>
              Total: {{ tableData.length }}
            </template>
          </span>
        </template>
      </Paginator>
    </div>
  </div>
</template>

<style scoped>
.table-view {
  display: flex;
  flex-direction: column;
  height: 100%;
  outline: none;
  position: relative;
}

.table-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  background: var(--tdv-surface-light);
  border-bottom: 1px solid var(--tdv-surface-border);
  border-radius: var(--tdv-radius) var(--tdv-radius) 0 0;
  flex-wrap: wrap;
  gap: 8px;
}

.table-toolbar {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-wrap: wrap;
}

.toolbar-separator {
  width: 1px;
  height: 20px;
  background: var(--tdv-surface-border);
  margin: 0 4px;
}

.nav-buttons {
  display: flex;
  gap: 2px;
  margin-left: 8px;
  padding-left: 8px;
  border-left: 1px solid var(--tdv-surface-border);
}

.fullscreen-toolbar {
  position: absolute;
  top: 8px;
  right: 8px;
  z-index: 100;
  opacity: 0.3;
  transition: opacity 0.2s ease;
}

.fullscreen-toolbar:hover {
  opacity: 1;
}

.advanced-query {
  padding: 8px 12px;
  background: var(--tdv-surface);
  border-bottom: 1px solid var(--tdv-surface-border);
}

.advanced-query label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.85rem;
  color: var(--tdv-text-muted);
}

.input-with-clear {
  display: flex;
  align-items: center;
  gap: 4px;
  flex: 1;
}

.clear-btn {
  flex-shrink: 0;
}

.query-input {
  flex: 1;
  width: 100%;
}

.extended-fields-panel {
  padding: 8px 12px;
  background: var(--tdv-surface);
  border-bottom: 1px solid var(--tdv-surface-border);
}

.extended-fields-label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.85rem;
  color: var(--tdv-text-muted);
  flex-wrap: wrap;
}

.extended-fields-input {
  flex: 1;
  width: 100%;
  min-width: 300px;
}

.extended-fields-help {
  margin-top: 6px;
  font-size: 0.75rem;
  color: var(--tdv-text-muted);
}

.extended-fields-help code {
  background: var(--tdv-surface-light);
  padding: 1px 4px;
  border-radius: 3px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.7rem;
}

.table-content {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.table-content :deep(.p-datatable) {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.table-content :deep(.p-datatable-table-container) {
  flex: 1;
  min-height: 0;
}

.table-content :deep(.p-paginator) {
  border-top: 1px solid var(--tdv-surface-border);
  padding: 4px 8px;
  background: var(--tdv-surface);
  flex-shrink: 0;
  min-height: auto;
  gap: 2px;
}

.table-content :deep(.p-paginator .p-paginator-first),
.table-content :deep(.p-paginator .p-paginator-prev),
.table-content :deep(.p-paginator .p-paginator-next),
.table-content :deep(.p-paginator .p-paginator-last),
.table-content :deep(.p-paginator .p-paginator-page) {
  min-width: 1.5rem;
  height: 1.5rem;
  padding: 0;
  font-size: 0.75rem;
}

.table-content :deep(.p-paginator .p-select) {
  height: 1.5rem;
  font-size: 0.75rem;
}

.table-content :deep(.p-paginator .p-select-label) {
  padding: 0 0.5rem;
  font-size: 0.75rem;
}

.table-content :deep(.p-paginator .p-select-dropdown) {
  width: 1.5rem;
}

.paginator-total {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 0.75rem;
  color: var(--tdv-text-muted);
  margin-left: 8px;
}

.paginator-total .pi-filter {
  color: var(--tdv-primary);
}

.column-header {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  cursor: pointer;
}

.column-header:hover {
  background: var(--tdv-hover-bg);
}

.column-title {
  font-weight: 600;
  flex: 1;
}

.column-title.has-filter {
  color: var(--tdv-success);
}

.column-title.has-disabled-filter {
  color: var(--tdv-warning, #f59e0b);
  font-style: italic;
}

.column-filter-indicator {
  font-size: 0.75rem;
  color: var(--tdv-success);
}

.column-filter-indicator.filter-disabled {
  color: var(--tdv-warning, #f59e0b);
}

.key-link {
  color: var(--tdv-key);
  text-decoration: none;
  font-weight: 600;
}

.key-link:hover {
  color: var(--tdv-primary);
  text-decoration: underline;
}

.complex-value-link {
  color: var(--tdv-primary);
  cursor: pointer;
  text-decoration: none;
}

.complex-value-link:hover {
  color: var(--tdv-primary-light);
  text-decoration: underline;
}

.cell-link {
  color: var(--tdv-primary);
  text-decoration: none;
}

.cell-link:hover {
  text-decoration: underline;
}

.complex-value-summary {
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.8rem;
  background: var(--tdv-selection-bg);
  padding: 2px 6px;
  border-radius: 4px;
  display: inline-block;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  /* white-space is controlled by inline style via whiteSpaceStyle computed property */
}

.simple-cell-value {
  display: inline-block;
  max-width: 100%;
  overflow-wrap: anywhere;
  /* white-space is controlled by inline style via whiteSpaceStyle computed property */
}

.empty-table {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px;
  color: var(--tdv-text-muted);
  gap: 8px;
}

.empty-table i {
  font-size: 2rem;
}

.cell-outer {
  position: relative;
  display: block;
  width: 100%;
}

/* When cell has color, create an absolute overlay for the background */
.cell-outer.has-color {
  position: relative;
}

.cell-outer.has-color::before {
  content: '';
  position: absolute;
  inset: 0;
  background-color: var(--cell-bg-color);
  z-index: 0;
  pointer-events: none;
}

.cell-outer.has-color > .cell-wrapper {
  position: relative;
  z-index: 1;
}

.cell-wrapper {
  display: block;
  width: 100%;
  max-width: 80vw;
  max-height: 50vh;
  overflow: hidden;
  border-radius: 3px;
  scrollbar-width: thin;
}

/* Webkit/Chrome scrollbar - minimal 4px size */
.cell-wrapper::-webkit-scrollbar {
  width: 4px;
  height: 4px;
}

.cell-wrapper::-webkit-scrollbar-thumb {
  background: var(--tdv-surface-border);
  border-radius: 2px;
}

.cell-wrapper::-webkit-scrollbar-thumb:hover {
  background: var(--tdv-text-muted);
}

.cell-wrapper::-webkit-scrollbar-track {
  background: transparent;
}

.cell-outer:hover .cell-wrapper {
  overflow: auto;
  overflow: overlay; /* Chromium overlay scrollbars */
}

.cell-content {
  width: 100%;
}

/* Show button bar when hovering cell-outer (text container). Use :global() so selector works across
   DataTable/VirtualScroller component boundaries. Use !important to override
   HoverButtonBar's default opacity:0 (child component styles can win cascade order). */
:global(.cell-outer:hover .cell-button-bar),
:global(.cell-outer:hover .hover-button-bar) {
  opacity: 1 !important;
  transition-delay: 300ms;
  pointer-events: auto;
}

/* PrimeVue DataTable overrides */
/* Ensure sticky header stays above hovered cells (z-index: 100) when scrolling */
:deep(.p-datatable-thead) {
  z-index: 200 !important;
}

:deep(.p-datatable-thead > tr > th) {
  background: var(--tdv-surface-light);
  color: var(--tdv-text);
  font-weight: 600;
  font-size: 0.85rem;
  padding: 4px 4px;
  border-right: 1px solid var(--tdv-surface-border);
}

:deep(.p-datatable-thead > tr > th:last-child) {
  border-right: none;
}

:deep(.p-datatable-tbody > tr > td) {
  padding: 3px 4px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.85rem;
  border-right: 1px solid var(--tdv-surface-border);
  position: relative;
  overflow: visible !important; /* Allow hover button bar to overflow cell boundaries */
}

/* Ensure hovered cell's button bar appears above other cells */
:deep(.p-datatable-tbody > tr > td:hover) {
  z-index: 100;
}

:deep(.p-datatable-tbody > tr > td:last-child) {
  border-right: none;
}

:deep(.p-column-header-content) {
  width: 100%;
}
</style>
