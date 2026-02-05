<script setup lang="ts">
import { ref, computed, watch, reactive } from 'vue'
import type { TDNode } from 'treedoc'
import { TDNodeType, TD } from 'treedoc'
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
import type { ExpandState } from './ExpandControl.vue'
import type { FieldQuery } from './ColumnFilterDialog.vue'
import type { ColumnVisibility } from './ColumnSelector.vue'
import logger from '@/utils/Logger'

const COL_VALUE = '@value'
const COL_NO = '#'
const COL_KEY = '@key'

const store = useTreeStore()
const { selectedNode, textWrap, maxPane } = storeToRefs(store)

const expandControlRef = ref<InstanceType<typeof ExpandControl>>()
const isColumnExpanded = ref(false)
const showAdvancedQuery = ref(false)
const jsQuery = ref('$')
const extendedFields = ref('')
const showExtendedFields = ref(false)
const first = ref(0)
const rows = ref(100)

// Filter dialog state
const filterDialogVisible = ref(false)
const activeFilterColumn = ref<TableColumn | null>(null)

// Column selector state
const columnSelectorVisible = ref(false)
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

// Create default field query
function createFieldQuery(): FieldQuery {
  return {
    query: '',
    isRegex: false,
    isNegate: false,
    isArray: false,
  }
}

// Get or create field query for a column
function getFieldQuery(field: string): FieldQuery {
  if (!fieldQueries.value[field]) {
    fieldQueries.value[field] = createFieldQuery()
  }
  return fieldQueries.value[field]
}

// Check if a column has an active filter
function hasActiveFilter(field: string): boolean {
  const fq = fieldQueries.value[field]
  return fq?.query?.length > 0
}

// Get count of active filters
const activeFilterCount = computed(() => {
  return Object.values(fieldQueries.value).filter(fq => fq.query?.length > 0).length
})

// Visible columns only
const visibleColumns = computed(() => {
  return columns.value.filter(col => col.visible)
})

// Hidden column count
const hiddenColumnCount = computed(() => {
  return columns.value.filter(col => !col.visible).length
})

// Update column visibility from selector
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

// Open filter dialog for a column
function openFilterDialog(col: TableColumn) {
  activeFilterColumn.value = col
  filterDialogVisible.value = true
}

// Update field query from dialog
function updateFieldQuery(query: FieldQuery) {
  if (activeFilterColumn.value) {
    fieldQueries.value[activeFilterColumn.value.field] = query
  }
}

// Match a value against a field query
function matchFieldQuery(value: string, fq: FieldQuery): boolean {
  if (!fq.query) return true
  
  let queries: string[]
  if (fq.isArray) {
    // Parse as comma-separated array
    queries = fq.query.split(',').map(q => q.trim()).filter(q => q)
  } else {
    queries = [fq.query]
  }
  
  let matched = false
  for (const q of queries) {
    if (fq.isRegex) {
      try {
        const regex = new RegExp(q, 'i')
        if (regex.test(value)) {
          matched = true
          break
        }
      } catch {
        // Invalid regex, fall back to string match
        if (value.toLowerCase().includes(q.toLowerCase())) {
          matched = true
          break
        }
      }
    } else {
      if (value.toLowerCase().includes(q.toLowerCase())) {
        matched = true
        break
      }
    }
  }
  
  return fq.isNegate ? !matched : matched
}

const filteredData = computed(() => {
  let data = [...tableData.value]
  logger.log(`Filtering data: initial count=${data.length}`)
  // Apply field queries
  for (const [field, fq] of Object.entries(fieldQueries.value)) {
    if (fq.query) {
      data = data.filter(row => {
        const value = row[field]
        if (value === undefined || value === null) {
          return matchFieldQuery('', fq)
        }
        const strValue = typeof value === 'object' && 'value' in value 
          ? String((value as TDNode).value) 
          : String(value)
        return matchFieldQuery(strValue, fq)
      })
    }
  }
  
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

// Parse extended fields expression and create evaluator function
function createExtendedFieldsFunc(): ((obj: any) => Record<string, any>) | null {
  if (!extendedFields.value || !extendedFields.value.trim()) return null
  
  const exp = `
    with($) {
      return {${extendedFields.value}}
    }
  `
  try {
    return new Function('$', exp) as (obj: any) => Record<string, any>
  } catch (e) {
    console.error('Error parsing extended fields:', exp)
    console.error(e)
    return null
  }
}

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

// Helper to add column if not exists
function addColumn(field: string, header: string, isExtended: boolean = false) {
  if (!columns.value.find(c => c.field === field)) {
    columns.value.push({
      field,
      header: isExtended ? `⊕${header}` : header,
      sortable: true,
      filterable: true,
      visible: true,
    })
  }
}

function buildTable(node: TDNode | null) {
  logger.log(`Building table for node: ${node?.key}, node.children=${node?.children?.length}`)
  columns.value = []
  tableData.value = []
  fieldQueries.value = {}
  if (!node || !node.children) return
  const isArray = node.type === TDNodeType.ARRAY
  const keyCol = isArray ? COL_NO : COL_KEY
  
  // Add key column
  columns.value.push({
    field: keyCol,
    header: keyCol,
    sortable: true,
    filterable: true,
    visible: true,
  })
  
  // Determine if we should expand columns
  if (shouldExpandColumns(node)) {
    isColumnExpanded.value = true
  }
  
  // Create extended fields evaluator
  const extFunc = createExtendedFieldsFunc()
  
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
          columns.value.push({
            field,
            header: field,
            sortable: true,
            filterable: true,
            visible: true,
          })
        }
        row[field] = grandChild
      }
    } else {
      // Just add value column
      if (!columns.value.find(c => c.field === COL_VALUE)) {
        columns.value.push({
          field: COL_VALUE,
          header: COL_VALUE,
          sortable: true,
          filterable: true,
          visible: true,
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
  
  // Update column visibility state for selector
  columnVisibility.value = columns.value.map(c => ({
    field: c.field,
    header: c.header,
    visible: c.visible,
  }))
}

function shouldExpandColumns(node: TDNode): boolean {
  if (!node.children || node.children.length === 0) return false
  
  const cols = new Set<string>()
  let cellCount = 0
  
  for (const child of node.children) {
    if (child.children) {
      for (const grandChild of child.children) {
        cols.add(grandChild.key!)
        cellCount++
      }
    }
  }
  
  // Heuristic: expand if mostly uniform structure
  const rowCount = node.children.length
  const colCount = cols.size
  if (colCount === 0 || colCount > 100) return false
  
  // Threshold: at least 80% fill rate
  const threshold = 0.8
  const maxCells = rowCount * colCount
  return cellCount >= maxCells * threshold
}

function nodeClicked(path: string[]) {
  store.selectNode(path)
}

function copyAsJSON() {
  const data = filteredData.value.map(row => {
    if (row.__node) {
      return row.__node.toObject(true)
    }
    return row
  })
  navigator.clipboard.writeText(TD.stringify(data))
}

function copyAsCSV() {
  const visibleCols = columns.value
  const header = visibleCols.map(c => c.header).join(',')
  const csvRows = filteredData.value.map(row => {
    return visibleCols.map(col => {
      const val = row[col.field]
      if (val === undefined || val === null) return ''
      if (typeof val === 'object' && 'value' in val) {
        const v = (val as TDNode).value
        return typeof v === 'string' ? `"${v.replace(/"/g, '""')}"` : String(v)
      }
      return String(val)
    }).join(',')
  })
  const csv = [header, ...csvRows].join('\n')
  navigator.clipboard.writeText(csv)
}

function getCellValue(row: TableRow, field: string): string {
  const val = row[field]
  if (val === undefined || val === null) return ''
  if (typeof val === 'object' && 'value' in val) {
    return String((val as TDNode).value ?? '')
  }
  return String(val)
}

function getCellNode(row: TableRow, field: string): TDNode | null {
  const val = row[field]
  if (val && typeof val === 'object' && 'type' in val) {
    return val as TDNode
  }
  return null
}

function isComplexValue(row: TableRow, field: string): boolean {
  const node = getCellNode(row, field)
  return node !== null && node.type !== TDNodeType.SIMPLE
}

// Generate a summary for complex JSON values
function getComplexValueSummary(row: TableRow, field: string): string {
  const node = getCellNode(row, field) as TDNode
  return node.toStringInternal('', true, false, 100);
  // if (!node) return '{...}'
  
  // if (node.type === TDNodeType.ARRAY) {
  //   const len = node.children?.length || 0
  //   if (len === 0) return '[]'
  //   // Show first few items if they're simple
  //   if (node.children && len <= 3) {
  //     const items = node.children.map(c => {
  //       if (c.type === TDNodeType.SIMPLE) {
  //         const v = c.value
  //         if (typeof v === 'string') return `"${v.length > 10 ? v.substring(0, 10) + '...' : v}"`
  //         return String(v)
  //       }
  //       return c.type === TDNodeType.ARRAY ? '[...]' : '{...}'
  //     })
  //     return `[${items.join(', ')}]`
  //   }
  //   return `[${len} items]`
  // }
  
  // if (node.type === TDNodeType.MAP) {
  //   const len = node.children?.length || 0
  //   if (len === 0) return '{}'
  //   // Show first few keys
  //   if (node.children) {
  //     const keys = node.children.slice(0, 3).map(c => c.key)
  //     const suffix = len > 3 ? `, +${len - 3} more` : ''
  //     return `{${keys.join(', ')}${suffix}}`
  //   }
  //   return `{${len} keys}`
  // }
  
  // return '{...}'
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

function rebuildTable() {
  buildTable(selectedNode.value)
  first.value = 0
}

// Watch for selection changes
watch(selectedNode, node => {
  logger.log(`Selected node changed: ${node?.key}`)
  if (node) {
    buildTable(node)
    first.value = 0
  }
}, { immediate: true })

// Watch column expansion toggle
watch(isColumnExpanded, () => {
  buildTable(selectedNode.value)
})

defineExpose({ onKeyPress })

const whiteSpaceStyle = computed(() => (textWrap.value ? 'pre-wrap' : 'pre'))
</script>

<template>
  <div class="table-view" tabindex="0">
    <!-- Filter Dialog -->
    <ColumnFilterDialog
      v-if="activeFilterColumn"
      :visible="filterDialogVisible"
      :field="activeFilterColumn.field"
      :title="activeFilterColumn.header"
      :field-query="getFieldQuery(activeFilterColumn.field)"
      :filtered-data="filteredData"
      @update:visible="filterDialogVisible = $event"
      @update:field-query="updateFieldQuery"
    />
    
    <!-- Column Selector Dialog -->
    <ColumnSelector
      :visible="columnSelectorVisible"
      :columns="columnVisibility"
      @update:visible="columnSelectorVisible = $event"
      @update:columns="updateColumnVisibility"
    />
    
    <!-- Full header in normal mode -->
    <div class="table-header">
      <JsonPath :tree-node="selectedNode" @node-clicked="nodeClicked" />
      
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
          @click="columnSelectorVisible = true"
          v-tooltip.top="'Select columns (' + visibleColumns.length + '/' + columns.length + ')'"
        />
        
        <Button
          icon="pi pi-copy"
          size="small"
          text
          @click="copyAsJSON"
          v-tooltip.top="'Copy as JSON'"
        />
        
        <Button
          icon="pi pi-file-export"
          size="small"
          text
          @click="copyAsCSV"
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
        <InputText
          v-model="jsQuery"
          placeholder="Custom query in JS. E.g. $.name.length > 10"
          class="query-input"
        />
      </label>
    </div>
    
    <div v-if="showExtendedFields" class="extended-fields-panel">
      <label class="extended-fields-label">
        Extended Fields:
        <InputText
          v-model="extendedFields"
          placeholder="Add computed columns. E.g. fullName: $.first + ' ' + $.last, tags_: $.metadata.tags"
          class="extended-fields-input"
          @blur="rebuildTable"
          @keydown.enter="rebuildTable"
        />
        <Button
          icon="pi pi-play"
          size="small"
          severity="success"
          @click="rebuildTable"
          v-tooltip.top="'Apply extended fields'"
        />
      </label>
      <div class="extended-fields-help">
        <small>
          Syntax: <code>fieldName: $.path.to.value</code> • 
          Spread arrays/objects: <code>items_: $.children</code> (adds items_0, items_1, ...)
        </small>
      </div>
    </div>
    
    <!-- Filter Summary -->
    <div v-if="activeFilterCount > 0" class="filter-summary">
      <span class="filter-summary-text">
        <i class="pi pi-filter"></i>
        {{ filteredData.length }} / {{ tableData.length }} rows
      </span>
    </div>
    
    <div class="table-content">
      <DataTable
        :value="paginatedData"
        :sortField="sortField"
        :sortOrder="sortOrder"
        @sort="e => { sortField = e.sortField as string; sortOrder = e.sortOrder as 1 | -1 | 0 }"
        scrollable
        scrollHeight="flex"
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
            <div class="column-header">
              <span class="column-title" :class="{ 'has-filter': hasActiveFilter(col.field) }">
                {{ col.header }}
              </span>
              <Button
                :icon="hasActiveFilter(col.field) ? 'pi pi-filter-fill' : 'pi pi-filter'"
                size="small"
                text
                :severity="hasActiveFilter(col.field) ? 'success' : 'secondary'"
                class="column-filter-btn"
                @click.stop="openFilterDialog(col)"
                v-tooltip.top="'Filter ' + col.header"
              />
            </div>
          </template>
          <template #body="{ data }">
            <template v-if="isComplexValue(data, col.field)">
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
              {{ getCellValue(data, col.field) }}
            </template>
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
        v-if="filteredData.length > rows"
        :first="first"
        :rows="rows"
        :totalRecords="filteredData.length"
        :rowsPerPageOptions="[100, 200, 500]"
        @page="onPage"
      />
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

.query-input {
  flex: 1;
  max-width: 100%;
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
  min-width: 300px;
  max-width: 600px;
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

.filter-summary {
  padding: 6px 12px;
  background: var(--tdv-selection-bg);
  border-bottom: 1px solid var(--tdv-surface-border);
  font-size: 0.85rem;
}

.filter-summary-text {
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--tdv-primary);
  font-weight: 500;
}

.table-content {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.column-header {
  display: flex;
  align-items: center;
  gap: 4px;
  justify-content: space-between;
  width: 100%;
}

.column-title {
  font-weight: 600;
}

.column-title.has-filter {
  color: var(--tdv-success);
}

.column-filter-btn {
  padding: 4px;
  width: 24px;
  height: 24px;
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
  white-space: nowrap;
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

/* PrimeVue DataTable overrides */
:deep(.p-datatable) {
  flex: 1;
}

:deep(.p-datatable-wrapper) {
  flex: 1;
}

:deep(.p-datatable-thead > tr > th) {
  background: var(--tdv-surface-light);
  color: var(--tdv-text);
  font-weight: 600;
  font-size: 0.85rem;
  padding: 8px 10px;
}

:deep(.p-datatable-tbody > tr > td) {
  padding: 6px 10px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.85rem;
}

:deep(.p-column-header-content) {
  width: 100%;
}
</style>
