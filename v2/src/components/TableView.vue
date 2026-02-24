<script setup lang="ts">
import { ref, computed, watch, reactive, toRaw, shallowRef, onBeforeUnmount, nextTick } from 'vue'
import type { TDNode } from 'treedoc'
import { TDNodeType, TDJSONWriter, TDJSONWriterOption } from 'treedoc'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
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
import AutoCompleteInput from './AutoCompleteInput.vue'
import PresetSelector from './PresetSelector.vue'
import TimeSeriesChart from './TimeSeriesChart.vue'
import type { QueryPreset } from '@/models/types'
import type { ExpandState } from './ExpandControl.vue'
import type { FieldQuery } from './ColumnFilterDialog.vue'
import type { ColumnVisibility } from './ColumnSelector.vue'
import { Logger } from '@/utils/Logger'
import { 
  getCellValue, 
  getCellNode, 
  isComplexValue, 
  getCellTimestampHint,
  getComplexValueSummary,
  copyCellValue,
  copyAsJSON,
  copyAsCSV,
  shouldExpandColumns,
  detectTimeColumns
} from '@/utils/TableUtil'
import { matchFieldQuery, matchPattern, createExtendedFieldsFunc } from '@/utils/QueryUtil'
import { getValueColorStyle, applyValueColorsFromFieldQueries } from '@/utils/ValueColorService'

const logger = new Logger('TableView')
const COL_VALUE = '@value'
const COL_NO = '#'
const COL_KEY = '@key'

const STORAGE_KEY_JS_QUERY = 'tdv_recent_js_queries'
const STORAGE_KEY_EXTENDED_FIELDS = 'tdv_recent_extended_fields'

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

const store = useTreeStore()
const { textWrap, maxPane } = storeToRefs(store)

const localSelectedNode = shallowRef<TDNode | null>(null)

const expandControlRef = ref<InstanceType<typeof ExpandControl>>()
const isColumnExpanded = ref(false)
const showAdvancedQuery = ref(false)
const jsQuery = ref('$')
const extendedFields = ref('')
const showExtendedFields = ref(false)
const showChart = ref(false)
const first = ref(0)
const rows = ref(100)

// Chart state (lifted up to survive fullscreen toggle)
const chartTimeColumn = ref('')
const chartValueColumn = ref('')
const chartGroupColumn = ref('')
const chartBucketSize = ref<import('@/utils/TableUtil').TimeBucket>('minute')
const chartHiddenGroups = ref<Set<string>>(new Set())

const activeFilterColumn = ref<TableColumn | null>(null)
const columnFilterRef = ref<InstanceType<typeof ColumnFilterDialog> | null>(null)
let hoverTimeout: ReturnType<typeof setTimeout> | null = null
let hoverTargetEvent: MouseEvent | null = null

const columnSelectorRef = ref<InstanceType<typeof ColumnSelector> | null>(null)
const columnVisibility = ref<ColumnVisibility[]>([])

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
  isFieldExtended?: boolean  // True if created by field-level extended fields
}

interface TableRow {
  [key: string]: TDNode | string | number | undefined
  __node?: TDNode
}

const columns = ref<TableColumn[]>([])
const tableData = ref<TableRow[]>([])
const fieldQueries = ref<Record<string, FieldQuery>>({})
const sortField = ref<string>('')
const sortOrder = ref<1 | -1 | 0>(0)

function createFieldQuery(): FieldQuery {
  return {
    query: '',
    isRegex: false,
    isNegate: false,
    isArray: false,
    isPattern: false,
    isDisabled: false,
    patternFields: [],
  }
}

function getFieldQuery(field: string): FieldQuery {
  if (!fieldQueries.value[field]) {
    fieldQueries.value[field] = createFieldQuery()
  }
  return fieldQueries.value[field]
}

function hasActiveFilter(field: string): boolean {
  const fq = fieldQueries.value[field]
  return fq?.query?.length > 0 && !fq.isDisabled
}

function hasDisabledFilter(field: string): boolean {
  const fq = fieldQueries.value[field]
  return fq?.query?.length > 0 && fq.isDisabled
}

const activeFilterCount = computed(() => {
  return Object.values(fieldQueries.value).filter(fq => fq.query?.length > 0 && !fq.isDisabled).length
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
  columns: columns.value.map(c => ({ field: c.field, visible: c.visible })),
  extendedFields: extendedFields.value,
  fieldQueries: { ...fieldQueries.value },
  jsQuery: jsQuery.value,
  expandLevel: expandControlRef.value?.state?.expandLevel,
}))

// Apply a loaded preset
function applyPreset(preset: QueryPreset) {
  // Apply column visibility
  const visibilityMap = new Map(preset.columns.map(c => [c.field, c.visible]))
  columns.value.forEach(col => {
    if (visibilityMap.has(col.field)) {
      col.visible = visibilityMap.get(col.field)!
    }
  })
  
  // Apply extended fields
  extendedFields.value = preset.extendedFields || ''
  
  // Apply field queries
  fieldQueries.value = { ...preset.fieldQueries }
  
  // Apply JS query
  jsQuery.value = preset.jsQuery || '$'
  
  // Apply value colors from field queries
  applyValueColorsFromFieldQueries(preset.fieldQueries)
  
  // Rebuild table to apply changes
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
  
  // Hide existing popover first, reset size, then show for new column
  columnFilterRef.value?.hide()
  columnFilterRef.value?.resetSize()
  
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
    // Hide existing popover first, reset size
    columnFilterRef.value?.hide()
    columnFilterRef.value?.resetSize()
    
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

// Track field-extended columns to update outside computed
let pendingFieldExtendedColumns: Set<string> | null = null
let fieldExtendedUpdateScheduled = false

function scheduleFieldExtendedColumnUpdate(newColumns: Set<string>) {
  pendingFieldExtendedColumns = newColumns
  if (!fieldExtendedUpdateScheduled) {
    fieldExtendedUpdateScheduled = true
    nextTick(() => {
      fieldExtendedUpdateScheduled = false
      if (pendingFieldExtendedColumns) {
        updateFieldExtendedColumns(pendingFieldExtendedColumns)
        pendingFieldExtendedColumns = null
      }
    })
  }
}

function updateFieldExtendedColumns(newFieldExtendedColumns: Set<string>) {
  // Remove old field-extended columns that are no longer needed
  const columnsToRemove = columns.value.filter(col => 
    col.isFieldExtended && !newFieldExtendedColumns.has(col.field)
  )
  
  if (columnsToRemove.length > 0) {
    columns.value = columns.value.filter(col => {
      if (!col.isFieldExtended) return true
      return newFieldExtendedColumns.has(col.field)
    })
  }
  
  // Add new field extended columns
  for (const colName of newFieldExtendedColumns) {
    if (!columns.value.find(c => c.field === colName)) {
      columns.value.push({
        field: colName,
        header: colName,
        sortable: true,
        filterable: true,
        visible: true,
        isFieldExtended: true,
      })
    }
  }
}


function updateFieldQuery(query: FieldQuery) {
  if (activeFilterColumn.value) {
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


// Track pattern-extracted columns
const patternExtractedColumns = ref<Set<string>>(new Set())

const filteredData = computed(() => {
  let data = [...tableData.value]
  logger.log(`Filtering data: initial count=${data.length}`)
  
  // Clear and rebuild pattern extracted columns
  const newPatternColumns = new Set<string>()
  
  // Apply field queries
  for (const [field, fq] of Object.entries(fieldQueries.value)) {
    // Skip disabled filters
    if (fq.isDisabled) continue
    
    if (fq.query) {
      if (fq.isPattern && fq.patternFields && fq.patternFields.length > 0) {
        // Pattern matching with value extraction
        const filteredRows: typeof data = []
        for (const row of data) {
          const value = row[field]
          // Use valueToSearchString to include all descendants for complex objects
          const strValue = valueToSearchString(value)
          
          const extracted = matchPattern(strValue, fq.query)
          if (extracted) {
            // Create a new row object with extracted values
            const newRow = { ...row }
            for (const [key, val] of Object.entries(extracted)) {
              const colName = `⊛${key}`
              newRow[colName] = val
              newPatternColumns.add(colName)
            }
            filteredRows.push(newRow)
          }
        }
        data = filteredRows
      } else {
        // Standard filtering - use valueToSearchString to include all descendants for complex objects
        data = data.filter(row => {
          const value = row[field]
          const strValue = valueToSearchString(value)
          return matchFieldQuery(strValue, fq)
        })
      }
    }
  }
  
  // Update pattern extracted columns and add to columns list
  if (newPatternColumns.size !== patternExtractedColumns.value.size ||
      [...newPatternColumns].some(c => !patternExtractedColumns.value.has(c))) {
    patternExtractedColumns.value = newPatternColumns
    // Add pattern columns to the columns list if not already present
    for (const colName of newPatternColumns) {
      if (!columns.value.find(c => c.field === colName)) {
        columns.value.push({
          field: colName,
          header: colName,
          sortable: true,
          filterable: true,
          visible: true,
        })
      }
    }
  }
  
  // Apply field-level extended fields
  const newFieldExtendedColumns = new Set<string>()
  for (const [field, fq] of Object.entries(fieldQueries.value)) {
    if (!fq.extendedFields) continue
    
    const extFunc = createExtendedFieldsFunc(fq.extendedFields)
    if (!extFunc) continue
    
    data = data.map(row => {
      const cellValue = row[field]
      let obj: any = null
      
      // Get the object to apply extended fields to
      if (cellValue && typeof cellValue === 'object' && 'type' in cellValue) {
        // It's a TDNode - convert to object
        obj = (cellValue as TDNode).toObject(true)
      } else if (typeof cellValue === 'string') {
        // Try to parse as JSON if it looks like JSON
        const trimmed = cellValue.trim()
        if ((trimmed.startsWith('{') && trimmed.endsWith('}')) ||
            (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
          try {
            obj = JSON.parse(trimmed)
          } catch {
            // Not valid JSON, skip
          }
        }
      }
      
      if (!obj) return row
      
      try {
        const extracted = extFunc(obj)
        if (extracted && Object.keys(extracted).length > 0) {
          const newRow = { ...row }
          for (const [key, val] of Object.entries(extracted)) {
            newRow[key] = val
            newFieldExtendedColumns.add(key)
          }
          return newRow
        }
      } catch (e) {
        // Ignore errors for individual rows
      }
      
      return row
    })
  }
  
  // Schedule column updates outside of computed (to avoid side effects in computed)
  scheduleFieldExtendedColumnUpdate(newFieldExtendedColumns)
  
  // Apply JS query if specified
  if (jsQuery.value && jsQuery.value !== '$') {
    try {
      const queryFn = new Function('$', `return ${jsQuery.value}`)
      data = data.filter(row => {
        try {
          const obj = row.__node?.toObject(true) || row
          return queryFn(obj)
        } catch {
          return true
        }
      })
    } catch (e) {
      console.warn('Invalid JS query:', e)
    }
  }
  
  return data
})

const paginatedData = computed(() => {
  return filteredData.value.slice(first.value, first.value + rows.value)
})


// Add extended object to row, handling spread notation (keys ending with _)
function addExtObject(key: string, val: any, row: TableRow) {
  if (key.endsWith('_') && val) {
    // Spread the children
    if (Array.isArray(val)) {
      for (let i = 0; i < val.length; i++) {
        const field = key + i
        addColumn(field, field, true)
        row[field] = val[i]?.$$tdNode || val[i]
      }
      return
    } else if (typeof val === 'object') {
      for (const k of Object.keys(val)) {
        if (k.startsWith('$$')) continue
        const field = key + k
        addColumn(field, field, true)
        row[field] = val[k]?.$$tdNode || val[k]
      }
      return
    }
  }
  // Regular field
  addColumn(key, key, true)
  row[key] = val?.$$tdNode || val
}

// Used during rebuild to preserve column visibility
let savedColumnVisibility: Map<string, boolean> | null = null

function addColumn(field: string, header: string, isExtended: boolean = false) {
  if (!columns.value.find(c => c.field === field)) {
    // Check if we have saved visibility for this column
    const visible = savedColumnVisibility?.get(field) ?? true
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
  logger.log(`Building table for node: ${node?.key}, restoreState=${restoreState}`)
  
  // Save current column visibility before rebuilding (for non-restore rebuilds)
  const currentFieldQueries = { ...fieldQueries.value }
  if (!restoreState) {
    savedColumnVisibility = new Map<string, boolean>()
    for (const col of columns.value) {
      savedColumnVisibility.set(col.field, col.visible)
    }
  } else {
    savedColumnVisibility = null
  }
  
  columns.value = []
  tableData.value = []
  if (restoreState) {
    fieldQueries.value = {}
  }
  if (!node || !node.children) return
  
  // Check if we have cached state for this node - do this BEFORE adding columns
  const cachedState = store.getTableState(node)
  if (cachedState && restoreState) {
    isColumnExpanded.value = cachedState.isColumnExpanded
    // Restore query state
    jsQuery.value = cachedState.query.jsQuery || '$'
    extendedFields.value = cachedState.query.extendedFields || ''
    // Restore field queries
    if (cachedState.query.fieldQueries) {
      for (const [field, fq] of Object.entries(cachedState.query.fieldQueries)) {
        fieldQueries.value[field] = { ...fq }
      }
    }
    // Set up column visibility from cache for addColumn to use
    if (cachedState.columns) {
      savedColumnVisibility = new Map<string, boolean>()
      for (const col of cachedState.columns) {
        if (col.visible !== undefined) {
          savedColumnVisibility.set(col.field, col.visible)
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
  const keyColVisible = savedColumnVisibility?.get(keyCol) ?? true
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
          const visible = savedColumnVisibility?.get(field) ?? true
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
        const visible = savedColumnVisibility?.get(COL_VALUE) ?? true
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
        console.error(e)
      }
    }
    
    tableData.value.push(row)
  }
  
  // Clear saved visibility after build is complete
  savedColumnVisibility = null
  
  // Update column visibility state for selector
  columnVisibility.value = columns.value.map(c => ({
    field: c.field,
    header: c.header,
    visible: c.visible,
  }))
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
  fieldQueries.value = {}
}

function filterCellValue(field: string, value: any, isNegate: boolean) {
  const strValue = value === null || value === undefined 
    ? '' 
    : typeof value === 'object' && 'value' in value 
      ? String((value as TDNode).value) 
      : String(value)
  
  const currentFq = fieldQueries.value[field]
  
  // If existing filter has different negate mode, override it
  if (currentFq && currentFq.isArray && currentFq.isNegate !== isNegate) {
    fieldQueries.value[field] = {
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

function rebuildTable() {
  const node = localSelectedNode.value
  if (node) buildTable(toRaw(node), false)
  first.value = 0
}

function saveCurrentTableState() {
  const node = localSelectedNode.value
  if (node) {
    const sortDir = sortOrder.value === 1 ? 'asc' : sortOrder.value === -1 ? 'desc' : ''
    store.saveTableState(toRaw(node), {
      query: { 
        limit: rows.value, 
        offset: first.value, 
        sortField: sortField.value,
        sortDir,
        jsQuery: jsQuery.value,
        extendedFields: extendedFields.value,
        fieldQueries: { ...fieldQueries.value }
      },
      expandedLevel: expandState.expandLevel,
      columns: columns.value.map(c => ({ field: c.field, visible: c.visible })),
      isColumnExpanded: isColumnExpanded.value,
      chartState: {
        showChart: showChart.value,
        timeColumn: chartTimeColumn.value,
        valueColumn: chartValueColumn.value,
        groupColumn: chartGroupColumn.value,
        bucketSize: chartBucketSize.value,
        hiddenGroups: Array.from(chartHiddenGroups.value)
      }
    })
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
    logger.log(`Selected node changed: ${newNode?.key}`)
    localSelectedNode.value = newNode
    if (newNode) {
      buildTable(newNode)
      first.value = 0
    }
    logger.log(`Selected node changed end`)
  },
  { immediate: true }
)

watch(isColumnExpanded, () => {
  if (isBuilding) return
  logger.log(`isColumnExpanded changed: ${isColumnExpanded.value}`)
  const node = localSelectedNode.value
  if (node) {
    saveCurrentTableState()
    buildTable(toRaw(node), false)
  }
  logger.log(`isColumnExpanded changed end`)
})

defineExpose({ onKeyPress })

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
    
    <!-- Column Selector Popover -->
    <ColumnSelector
      ref="columnSelectorRef"
      :columns="columnVisibility"
      @update:columns="updateColumnVisibility"
    />
    
    <!-- Full header in normal mode -->
    <div class="table-header">
      <JsonPath :tree-node="rawSelectedNode" @node-clicked="nodeClicked" />
      
      <div class="table-toolbar">
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
          :currentState="currentPresetState"
          @load="applyPreset"
        />
        
        <div class="toolbar-separator" />
        
        <Button
          icon="pi pi-copy"
          size="small"
          text
          @click="copyAsJSON(filteredData as any, visibleColumns as any)"
          v-tooltip.top="'Copy as JSON'"
        />
        
        <Button
          icon="pi pi-file-export"
          size="small"
          text
          @click="copyAsCSV(filteredData as any, visibleColumns as any)"
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
          @click="showExtendedFields = !showExtendedFields"
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
      @close="showChart = false"
      @update:group-filter="onChartGroupFilter"
      @update:time-column="chartTimeColumn = $event"
      @update:value-column="chartValueColumn = $event"
      @update:group-column="chartGroupColumn = $event"
      @update:bucket-size="chartBucketSize = $event"
      @update:hidden-groups="chartHiddenGroups = $event"
    />
    
    <div class="table-content">
      <DataTable
        :value="paginatedData"
        :sortField="sortField"
        :sortOrder="sortOrder"
        @sort="e => { sortField = e.sortField as string; sortOrder = e.sortOrder as 1 | -1 | 0 }"
        stripedRows
        size="small"
        tableStyle="min-width: 100%"
      >
        <Column
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
          <template #body="{ data }">
            <div class="cell-outer" :class="{ 'has-color': getCellColorStyle(data, col.field) }" :style="getCellColorStyle(data, col.field)">
              <div class="cell-wrapper">
                <div class="cell-content" v-tooltip.top="getCellTimestampHint(data, col.field)">
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
                    <SimpleValue
                      :tnode="getCellNode(data, col.field)!"
                      :is-in-table="true"
                      :text-wrap="textWrap"
                      @node-clicked="nodeClicked([$event])"
                    />
                  </template>
                  <template v-else>
                    <span class="simple-cell-value" :style="{ whiteSpace: whiteSpaceStyle }">{{ getCellValue(data, col.field) }}</span>
                  </template>
                </div>
              </div>
              <div class="cell-button-bar">
                <button 
                  class="cell-action-btn cell-copy-btn"
                  title="Copy cell"
                  @click.stop="copyCellValue(data, col.field)"
                >
                  <i class="pi pi-copy"></i>
                </button>
                <button 
                  class="cell-action-btn cell-filter-in"
                  title="Filter in this value"
                  @click.stop="filterCellValue(col.field, data[col.field], false)"
                >
                  <i class="pi pi-filter"></i>
                </button>
                <button 
                  class="cell-action-btn cell-filter-out"
                  title="Filter out this value"
                  @click.stop="filterCellValue(col.field, data[col.field], true)"
                >
                  <i class="pi pi-filter-slash"></i>
                </button>
                <button 
                  v-if="shouldShowOpenInNewTab(data, col.field)"
                  class="cell-action-btn cell-open-new"
                  title="Open in new tab"
                  @click.stop="openCellInNewTab(data, col.field)"
                >
                  <i class="pi pi-external-link"></i>
                </button>
              </div>
            </div>
          </template>
        </Column>
        
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
  overflow: auto;
}

.table-content :deep(.p-paginator) {
  border-top: 1px solid var(--tdv-surface-border);
  padding: 8px;
  background: var(--tdv-surface);
  flex-shrink: 0;
}

.paginator-total {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 0.85rem;
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
  position: static;
  display: block;
  width: 100%;
}

/* When cell has color, create an absolute overlay for the background */
.cell-outer.has-color {
  position: static;
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

.cell-button-bar {
  position: absolute;
  top: 50%;
  right: 4px;
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

/* For first column (key column): position to the right of text with offset to expose the link */
:deep(.p-datatable-tbody > tr > td:first-child) .cell-button-bar {
  right: auto;
  left: 1.5em;  /* Leave at least 1-2 characters visible */
}

/* Show button bar when hovering cell outer */
.cell-outer:hover .cell-button-bar {
  opacity: 1;
  transition-delay: 100ms;
  pointer-events: auto;
}

.cell-action-btn {
  background: transparent;
  border: none;
  cursor: pointer;
  color: var(--tdv-text-muted);
  padding: 3px 5px;
  border-radius: 3px;
  font-size: 1rem;
  transition: color 0.15s, background 0.15s;
  display: flex;
  align-items: center;
  justify-content: center;
}

.cell-action-btn:hover {
  background: var(--tdv-hover-bg);
}

.cell-copy-btn:hover {
  color: var(--tdv-primary);
}

.cell-filter-in:hover {
  color: var(--tdv-success);
}

.cell-filter-out:hover {
  color: var(--tdv-danger);
}

.cell-action-btn i {
  font-size: 11px;
}

/* PrimeVue DataTable overrides */
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
}

:deep(.p-datatable-tbody > tr > td:last-child) {
  border-right: none;
}

:deep(.p-column-header-content) {
  width: 100%;
}
</style>
