<script setup lang="ts">
import { computed, ref, watch, onBeforeUnmount, nextTick } from 'vue'
import { Bar } from 'vue-chartjs'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  TimeScale,
  BarElement,
  BarController,
  LineElement,
  LineController,
  PointElement,
  Title,
  Tooltip,
  Legend,
  type ChartData,
  type ChartOptions
} from 'chart.js'
import 'chartjs-adapter-date-fns'
import type { TableRow, TableColumn, TimeBucket } from '@/utils/TableUtil'
import { detectTimeColumns, detectNumericColumns, detectGroupableColumns, detectBucketSize, detectColumnDateFormat } from '@/utils/TableUtil'
import { formatDateLikeOriginal, tryParseDate } from '@/utils/DateUtil'
import Select from 'primevue/select'
import MultiSelect from 'primevue/multiselect'
import Button from 'primevue/button'
import Checkbox from 'primevue/checkbox'
import BasicColumnFilterPopover from './BasicColumnFilterPopover.vue'
import type { FieldQuery } from '@/models/types'
import { matchFieldQuery } from '@/utils/QueryUtil'

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  TimeScale,
  BarElement,
  BarController,
  LineElement,
  LineController,
  PointElement,
  Title,
  Tooltip,
  Legend
)

const props = defineProps<{
  data: TableRow[]
  columns: TableColumn[]
  // Chart state props (for persistence across remounts)
  timeColumnModel?: string
  valueColumnModel?: string
  valueColumnsModel?: string[]
  groupColumnModel?: string
  groupColumnsModel?: string[]
  groupFilterValues?: string[] | null
  bucketSizeModel?: TimeBucket
  hiddenGroupsModel?: Set<string>
  showCountModel?: boolean
  showValueSumModel?: boolean
  valueAggModel?: ValueAggregation
  timeSelectionStartModel?: number | null
  timeSelectionEndModel?: number | null
  chartHeight?: number
}>()

const emit = defineEmits<{
  close: []
  'update:groupFilter': [field: string, values: string[]]
  'update:timeColumn': [value: string]
  'update:valueColumn': [value: string]
  'update:valueColumns': [value: string[]]
  'update:groupColumn': [value: string]
  'update:groupColumns': [value: string[]]
  'update:bucketSize': [value: TimeBucket]
  'update:hiddenGroups': [value: Set<string>]
  'update:showCount': [value: boolean]
  'update:showValueSum': [value: boolean]
  'update:valueAgg': [value: ValueAggregation]
  'update:chartHeight': [value: number]
  'update:time-range': [payload: { timeColumn: string; startMs: number | null; endMs: number | null }]
}>()

type ValueAggregation = 'avg' | 'sum' | 'max'
type SeriesKind = 'count' | 'value'

interface BucketData {
  time: Date
  count: number
  countGroups: Record<string, number>
  valueGroups: Record<string, Record<string, { sum: number; count: number; max: number }>>
}

interface SeriesSummary {
  key: string
  kind: SeriesKind
  name: string
  valueColumn?: string
  groupParts: string[]
  colorIndex: number
  max: number
  mean: number
}

interface LegendRow {
  series: SeriesSummary
  originalIndex: number
}

type LegendSortField = 'name' | 'max' | 'mean' | `group:${number}`
type LegendSortOrder = 1 | -1
type LegendColumnKey = LegendSortField

const MAX_RENDERED_SERIES = 100
const MAX_GROUPED_COUNT_SERIES = 100
const TOOLTIP_SINGLE_SERIES_THRESHOLD = 50
const DEBOUNCE_MS = 250
const LEGEND_VISIBILITY_COL_WIDTH = 26
const LEGEND_COLOR_COL_WIDTH = 16
const LEGEND_COLUMN_DEFAULT_WIDTHS: Record<string, number> = {
  name: 130,
  max: 58,
  mean: 58,
}
const LEGEND_COLUMN_MIN_WIDTHS: Record<string, number> = {
  name: 80,
  max: 48,
  mean: 48,
  group: 64,
}

// State - use props if provided, otherwise use local state
const timeColumn = ref<string>(props.timeColumnModel || '')
const valueColumns = ref<string[]>(props.valueColumnsModel?.length ? [...props.valueColumnsModel] : (props.valueColumnModel ? [props.valueColumnModel] : []))
const groupColumns = ref<string[]>(props.groupColumnsModel?.length ? [...props.groupColumnsModel] : (props.groupColumnModel ? [props.groupColumnModel] : []))
const effectiveValueColumns = ref<string[]>([...valueColumns.value])
const effectiveGroupColumns = ref<string[]>([...groupColumns.value])
const showCount = ref(props.showCountModel ?? true)
const showValueSum = ref(props.showValueSumModel ?? false)
const valueAgg = ref<ValueAggregation>(props.valueAggModel ?? 'sum')
const bucketSize = ref<TimeBucket>(props.bucketSizeModel || 'minute')
const autoDetectBucket = ref(!props.bucketSizeModel) // Auto-detect only if no saved bucket
const isMaximized = ref(false)
const hiddenGroups = ref<Set<string>>(props.hiddenGroupsModel ? new Set(props.hiddenGroupsModel) : new Set())
const explicitlyShownValueSeries = ref<Set<string>>(new Set())
const legendWidth = ref(320)
const isResizingLegend = ref(false)
const legendResizeRight = ref(0)
const timeSelectionStart = ref<number | null>(props.timeSelectionStartModel ?? null)
const timeSelectionEnd = ref<number | null>(props.timeSelectionEndModel ?? null)
const chartRef = ref<any>(null)
const isDraggingSelection = ref(false)
const dragStartClientX = ref(0)
const dragCurrentClientX = ref(0)
const legendSortField = ref<LegendSortField>('max')
const legendSortOrder = ref<LegendSortOrder>(-1)
const legendFilterQueries = ref<Record<string, FieldQuery>>({})
const activeLegendFilterField = ref<LegendSortField>('name')
const activeLegendFilterTitle = ref('Name')
const legendFilterPopoverRef = ref<InstanceType<typeof BasicColumnFilterPopover> | null>(null)
const previousChartHeight = ref<number | null>(null)
const legendColumnWidths = ref<Record<string, number>>({})
let debounceTimer: ReturnType<typeof setTimeout> | null = null
let resizeTimer: ReturnType<typeof setTimeout> | null = null
let legendFilterHoverTimer: ReturnType<typeof setTimeout> | null = null
let pendingResizeClientX: number | null = null
let resizingLegendColumnKey: LegendColumnKey | null = null
let legendColumnResizeStartX = 0
let legendColumnResizeStartWidth = 0

// Emit state changes to parent
watch(timeColumn, (val) => emit('update:timeColumn', val))
watch(valueColumns, (val) => {
  emit('update:valueColumns', [...val])
  emit('update:valueColumn', val[0] || '')
}, { deep: true })
watch(groupColumns, (val) => {
  emit('update:groupColumns', [...val])
  emit('update:groupColumn', val[0] || '')
}, { deep: true })
watch(bucketSize, (val) => emit('update:bucketSize', val))
watch(hiddenGroups, (val) => emit('update:hiddenGroups', val))
watch(showCount, (val) => emit('update:showCount', val))
watch(showValueSum, (val) => emit('update:showValueSum', val))
watch(valueAgg, (val) => emit('update:valueAgg', val))

watch([valueColumns, groupColumns], () => {
  if (debounceTimer) clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => {
    effectiveValueColumns.value = [...valueColumns.value]
    effectiveGroupColumns.value = [...groupColumns.value]
  }, DEBOUNCE_MS)
}, { deep: true })

watch(
  [timeSelectionStart, timeSelectionEnd],
  () => {
    emit('update:time-range', {
      timeColumn: timeColumn.value,
      startMs: timeSelectionStart.value,
      endMs: timeSelectionEnd.value
    })
  },
  { immediate: true }
)

// Detect columns
const timeColumns = computed(() => detectTimeColumns(props.data, props.columns))
const timeColumnFormat = computed(() => timeColumn.value ? detectColumnDateFormat(props.data, timeColumn.value) : null)
const numericColumns = computed(() => detectNumericColumns(props.data, props.columns))
const GROUP_BY_MAX_UNIQUE_VALUES = 1000
const groupableColumns = computed(() => detectGroupableColumns(props.data, props.columns, GROUP_BY_MAX_UNIQUE_VALUES))

const groupColumnCardinality = computed<Record<string, number>>(() => {
  const result: Record<string, number> = {}

  for (const col of props.columns) {
    if (col.field === '__node') continue

    const uniqueValues = new Set<string>()
    for (const row of props.data) {
      const val = row[col.field]
      if (val && typeof val === 'object' && 'type' in val) {
        uniqueValues.add(String((val as any).value ?? ''))
      } else if (val === undefined || val === null) {
        uniqueValues.add('')
      } else {
        uniqueValues.add(String(val))
      }
    }

    result[col.field] = uniqueValues.size
  }

  return result
})

const groupColumnOptions = computed(() => {
  return [
    { label: 'None', value: '' },
    ...groupableColumns.value
      .filter(field => field !== timeColumn.value)
      .map(field => ({
        label: `${field} (${groupColumnCardinality.value[field] ?? 0})`,
        value: field,
      }))
  ]
})

const groupMultiSelectOptions = computed(() => groupColumnOptions.value.filter(option => option.value))
const countSeriesCount = computed(() => {
  if (!showCount.value) return 0
  if (effectiveGroupColumns.value.length === 0) return 1
  if (groupedCountEnabled.value) return visibleCountGroupKeys.value.length
  return visibleCountGroupKeys.value.length > MAX_GROUPED_COUNT_SERIES ? 1 : 0
})
const chartHasData = computed(() => chartBuckets.value.length > 0 && (countSeriesCount.value > 0 || valueSeriesSummaries.value.length > 0))
const chartLayoutStyle = computed(() => {
  const height = props.chartHeight ?? 250
  return {
    height: `${height}px`,
    minHeight: `${height}px`
  }
})

// Auto-select first time column
watch(timeColumns, (cols) => {
  if (cols.length > 0 && !timeColumn.value) {
    timeColumn.value = cols[0]
  }
}, { immediate: true })

// Auto-detect bucket size when time column changes
watch([() => timeColumn.value, () => props.data], () => {
  if (autoDetectBucket.value && timeColumn.value && props.data.length > 0) {
    bucketSize.value = detectBucketSize(props.data, timeColumn.value)
  }
}, { immediate: true })

// Reset hidden series when grouping changes
watch(groupColumns, (newCols, oldCols) => {
  hiddenGroups.value = new Set()
  explicitlyShownValueSeries.value = new Set()
  const newSet = new Set(newCols)
  for (const oldCol of oldCols || []) {
    if (!newSet.has(oldCol)) emit('update:groupFilter', oldCol, [])
  }
}, { deep: true })

watch(timeColumn, () => {
  if (timeColumn.value && groupColumns.value.includes(timeColumn.value)) {
    groupColumns.value = groupColumns.value.filter(field => field !== timeColumn.value)
  }
  resetTimeSelection()
})

function getCellAnyValue(row: TableRow, field: string): unknown {
  const val = row[field]
  if (val && typeof val === 'object' && 'type' in val && 'value' in val) {
    return (val as any).value
  }
  return val
}

function getNumericValue(row: TableRow, field: string): number | null {
  const val = getCellAnyValue(row, field)
  if (val === null || val === undefined || val === '') return null
  const num = Number(val)
  return Number.isFinite(num) ? num : null
}

function getStringValue(row: TableRow, field: string): string {
  const val = getCellAnyValue(row, field)
  if (val === null || val === undefined || val === '') return '(empty)'
  return String(val)
}

function getGroupParts(row: TableRow): string[] {
  return effectiveGroupColumns.value.map(field => getStringValue(row, field))
}

function getGroupKey(parts: string[]): string {
  return parts.length ? parts.join(' | ') : 'All'
}

function getBucketKey(date: Date, bucket: TimeBucket): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hour = String(date.getHours()).padStart(2, '0')
  const minute = date.getMinutes()

  switch (bucket) {
    case 'second':
      return `${year}-${month}-${day} ${hour}:${String(minute).padStart(2, '0')}:${String(date.getSeconds()).padStart(2, '0')}`
    case 'minute':
      return `${year}-${month}-${day} ${hour}:${String(minute).padStart(2, '0')}`
    case '5min':
      return `${year}-${month}-${day} ${hour}:${String(Math.floor(minute / 5) * 5).padStart(2, '0')}`
    case '10min':
      return `${year}-${month}-${day} ${hour}:${String(Math.floor(minute / 10) * 10).padStart(2, '0')}`
    case '30min':
      return `${year}-${month}-${day} ${hour}:${String(Math.floor(minute / 30) * 30).padStart(2, '0')}`
    case 'hour':
      return `${year}-${month}-${day} ${hour}:00`
    case 'day':
      return `${year}-${month}-${day}`
    case 'week': {
      const d = new Date(date)
      const dayOfWeek = d.getDay()
      d.setDate(d.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1))
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    }
    case 'month':
      return `${year}-${month}`
  }
}

function getBucketStartDate(key: string, bucket: TimeBucket): Date {
  if (bucket === 'month') {
    const [year, month] = key.split('-').map(Number)
    return new Date(year, month - 1, 1)
  }
  if (bucket === 'day' || bucket === 'week') {
    const [year, month, day] = key.split('-').map(Number)
    return new Date(year, month - 1, day)
  }
  const [datePart, timePart] = key.split(' ')
  const [year, month, day] = datePart.split('-').map(Number)
  const [hour, minute, second = 0] = timePart.split(':').map(Number)
  return new Date(year, month - 1, day, hour, minute, second)
}

const chartBuckets = computed<BucketData[]>(() => {
  if (!timeColumn.value || props.data.length === 0) return []

  const buckets = new Map<string, BucketData>()

  for (const row of props.data) {
    const date = tryParseDate(getCellAnyValue(row, timeColumn.value))
    if (!date) continue

    const bucketKey = getBucketKey(date, bucketSize.value)
    let bucket = buckets.get(bucketKey)
    if (!bucket) {
      bucket = {
        time: getBucketStartDate(bucketKey, bucketSize.value),
        count: 0,
        countGroups: {},
        valueGroups: {}
      }
      buckets.set(bucketKey, bucket)
    }

    const groupParts = getGroupParts(row)
    const groupKey = getGroupKey(groupParts)
    bucket.count++
    bucket.countGroups[groupKey] = (bucket.countGroups[groupKey] || 0) + 1

    for (const column of effectiveValueColumns.value) {
      const numericValue = getNumericValue(row, column)
      if (numericValue === null) continue
      bucket.valueGroups[column] ||= {}
      const stats = bucket.valueGroups[column][groupKey] ||= { sum: 0, count: 0, max: -Infinity }
      stats.sum += numericValue
      stats.count++
      stats.max = Math.max(stats.max, numericValue)
    }
  }

  return Array.from(buckets.values()).sort((a, b) => a.time.getTime() - b.time.getTime())
})

const countGroupKeys = computed(() => {
  const keys = new Set<string>()
  for (const bucket of chartBuckets.value) {
    for (const key of Object.keys(bucket.countGroups)) keys.add(key)
  }
  return Array.from(keys).sort()
})

const visibleCountGroupKeys = computed(() => {
  let keys = countGroupKeys.value

  // Table group filters are the source of truth when they are simple selected-value filters.
  if (
    effectiveGroupColumns.value.length === 1
    && props.groupFilterValues
    && props.groupFilterValues.length > 0
  ) {
    const selected = new Set(props.groupFilterValues)
    keys = keys.filter(key => selected.has(key))
  }

  // When the group selection table is visible, count follows the same visible group selection.
  if (effectiveValueColumns.value.length > 0 && effectiveGroupColumns.value.length > 0) {
    keys = keys.filter(key => valueSeriesSummaries.value.some((series, index) => {
      return getGroupKey(series.groupParts) === key && isValueSeriesVisible(series, index)
    }))
  }

  return keys
})

const groupedCountEnabled = computed(() => {
  return effectiveGroupColumns.value.length > 0
    && visibleCountGroupKeys.value.length > 0
    && visibleCountGroupKeys.value.length <= MAX_GROUPED_COUNT_SERIES
})

function aggregateValues(values: number[]): { max: number; mean: number } {
  if (values.length === 0) return { max: 0, mean: 0 }
  return {
    max: Math.max(...values),
    mean: values.reduce((sum, value) => sum + value, 0) / values.length
  }
}

function getValueForStats(stats: { sum: number; count: number; max: number } | undefined): number | null {
  if (!stats || stats.count === 0) return null
  if (valueAgg.value === 'sum') return stats.sum
  if (valueAgg.value === 'max') return stats.max
  return stats.sum / stats.count
}

const valueSeriesSummaries = computed<SeriesSummary[]>(() => {
  const series = new Map<string, { valueColumn: string; groupParts: string[]; values: number[] }>()

  for (const bucket of chartBuckets.value) {
    for (const column of effectiveValueColumns.value) {
      const groups = bucket.valueGroups[column] || {}
      for (const [groupKey, stats] of Object.entries(groups)) {
        const value = getValueForStats(stats)
        if (value === null) continue
        const key = `value:${column}:${groupKey}`
        if (!series.has(key)) {
          series.set(key, {
            valueColumn: column,
            groupParts: groupKey === 'All' ? [] : groupKey.split(' | '),
            values: []
          })
        }
        series.get(key)!.values.push(value)
      }
    }
  }

  return Array.from(series.entries()).map(([key, data]) => {
    const stats = aggregateValues(data.values)
    return {
      key,
      kind: 'value' as const,
      name: data.groupParts.length ? `${data.valueColumn} | ${data.groupParts.join(' | ')}` : data.valueColumn,
      valueColumn: data.valueColumn,
      groupParts: data.groupParts,
      colorIndex: 0,
      max: stats.max,
      mean: stats.mean
    }
  }).sort((a, b) => b.max - a.max).map((summary, index) => ({
    ...summary,
    colorIndex: index,
  }))
})

function isValueSeriesVisible(series: SeriesSummary, index: number): boolean {
  if (hiddenGroups.value.has(series.key)) return false
  return index < MAX_RENDERED_SERIES || explicitlyShownValueSeries.value.has(series.key)
}

const visibleValueSeries = computed(() => valueSeriesSummaries.value.filter((series, index) => isValueSeriesVisible(series, index)))
const hasVisibleValueSeries = computed(() => visibleValueSeries.value.length > 0)
const totalSeriesCount = computed(() => countSeriesCount.value + visibleValueSeries.value.length + (showValueSum.value && hasVisibleValueSeries.value ? 1 : 0))
const allValueSeriesHidden = computed(() => valueSeriesSummaries.value.length > 0 && valueSeriesSummaries.value.every((series, index) => !isValueSeriesVisible(series, index)))

const legendResizableColumnKeys = computed<LegendColumnKey[]>(() => [
  'name',
  ...effectiveGroupColumns.value.map((_, index) => `group:${index}` as const),
  'max',
  'mean',
])

function getLegendColumnWidth(key: LegendColumnKey): number {
  return legendColumnWidths.value[key] ?? LEGEND_COLUMN_DEFAULT_WIDTHS[key] ?? 120
}

function getLegendColumnMinWidth(key: LegendColumnKey): number {
  return key.startsWith('group:') ? LEGEND_COLUMN_MIN_WIDTHS.group : LEGEND_COLUMN_MIN_WIDTHS[key] ?? 48
}

const legendTableWidth = computed(() => {
  const resizableWidth = legendResizableColumnKeys.value.reduce((sum, key) => sum + getLegendColumnWidth(key), 0)
  return LEGEND_VISIBILITY_COL_WIDTH + LEGEND_COLOR_COL_WIDTH + resizableWidth
})

const filteredLegendRows = computed<LegendRow[]>(() => {
  const rows = valueSeriesSummaries.value
    .map((series, originalIndex) => ({ series, originalIndex }))
    .filter(({ series }) => {
      if (!matchesLegendFilter('name', `${series.name} ${series.valueColumn || ''}`)) return false

      for (let index = 0; index < effectiveGroupColumns.value.length; index++) {
        if (!matchesLegendFilter(`group:${index}`, series.groupParts[index] || '')) return false
      }

      if (!matchesLegendMetricFilter('max', series.max)) return false
      if (!matchesLegendMetricFilter('mean', series.mean)) return false
      return true
    })

  const field = legendSortField.value
  const order = legendSortOrder.value
  return rows.sort((a, b) => compareLegendRows(a, b, field) * order)
})

function createLegendFilterQuery(field: LegendSortField): FieldQuery {
  return {
    field,
    query: '',
    isRegex: false,
    isNegate: false,
    isArray: false,
    isPattern: false,
    isDisabled: false,
    patternFields: []
  }
}

function getLegendFilterQuery(field: LegendSortField): FieldQuery {
  if (!legendFilterQueries.value[field]) {
    legendFilterQueries.value[field] = createLegendFilterQuery(field)
  }
  return legendFilterQueries.value[field]
}

const activeLegendFilterQuery = computed(() => getLegendFilterQuery(activeLegendFilterField.value))
const activeLegendFilterText = computed({
  get: () => {
    const query = activeLegendFilterQuery.value
    if (query.jsExpression) return query.jsExpression === 'true' ? '' : query.jsExpression
    return query.query || ''
  },
  set: (value: string) => {
    const query = activeLegendFilterQuery.value
    if (query.jsExpression) {
      query.jsExpression = value || 'true'
      query.query = ''
    } else {
      query.query = value
    }
  }
})
const activeLegendFilterIsJs = computed({
  get: () => !!activeLegendFilterQuery.value.jsExpression,
  set: (value: boolean) => {
    const query = activeLegendFilterQuery.value
    if (value) {
      query.jsExpression = query.query || 'true'
      query.query = ''
      query.isRegex = false
      query.isNegate = false
      query.isArray = false
    } else {
      query.query = query.jsExpression === 'true' ? '' : query.jsExpression || query.query || ''
      query.jsExpression = undefined
    }
  }
})

function matchesLegendFilter(field: LegendSortField, value: string): boolean {
  return matchesLegendFilterValue(field, value, value)
}

function matchesLegendFilterValue(field: LegendSortField, displayValue: string, rawValue: unknown): boolean {
  const query = getLegendFilterQuery(field)
  if (query.isDisabled) return true

  if (query.jsExpression) {
    if (query.jsExpression === 'true') return true
    try {
      const filterFn = new Function('$', `return ${query.jsExpression}`) as (value: unknown) => boolean
      return !!filterFn(rawValue)
    } catch {
      return true
    }
  }

  if (!query.query) return true
  return matchFieldQuery(displayValue, query)
}

function matchesLegendMetricFilter(field: 'max' | 'mean', value: number): boolean {
  return matchesLegendFilterValue(field, `${formatMetric(value)} ${String(value)}`, value)
}

function compareLegendRows(a: LegendRow, b: LegendRow, field: LegendSortField): number {
  if (field === 'max' || field === 'mean') {
    const diff = a.series[field] - b.series[field]
    return diff === 0 ? a.originalIndex - b.originalIndex : diff
  }

  const aValue = field === 'name'
    ? a.series.name
    : a.series.groupParts[Number(field.split(':')[1])] || ''
  const bValue = field === 'name'
    ? b.series.name
    : b.series.groupParts[Number(field.split(':')[1])] || ''
  const diff = aValue.localeCompare(bValue, undefined, { numeric: true, sensitivity: 'base' })
  return diff === 0 ? a.originalIndex - b.originalIndex : diff
}

function setLegendSort(field: LegendSortField) {
  if (legendSortField.value === field) {
    legendSortOrder.value = legendSortOrder.value === 1 ? -1 : 1
  } else {
    legendSortField.value = field
    legendSortOrder.value = field === 'max' || field === 'mean' ? -1 : 1
  }
}

function getLegendSortIcon(field: LegendSortField): string {
  if (legendSortField.value !== field) return 'pi pi-sort-alt'
  return legendSortOrder.value === 1 ? 'pi pi-sort-amount-up-alt' : 'pi pi-sort-amount-down'
}

function clearLegendFilters() {
  legendFilterQueries.value = {}
}

function isLegendFilterActive(field: LegendSortField): boolean {
  const query = legendFilterQueries.value[field]
  return (!!query?.query?.trim() || (!!query?.jsExpression && query.jsExpression !== 'true')) && !query.isDisabled
}

function hasLegendFilter(field: LegendSortField): boolean {
  const query = legendFilterQueries.value[field]
  return !!query?.query?.trim() || (!!query?.jsExpression && query.jsExpression !== 'true')
}

function isLegendFilterDisabled(field: LegendSortField): boolean {
  const query = legendFilterQueries.value[field]
  return (!!query?.query?.trim() || (!!query?.jsExpression && query.jsExpression !== 'true')) && !!query.isDisabled
}

function clearLegendFilter(field: LegendSortField) {
  legendFilterQueries.value[field] = createLegendFilterQuery(field)
}

function clearActiveLegendFilter() {
  clearLegendFilter(activeLegendFilterField.value)
}

function showLegendFilterPopover(event: Event, field: LegendSortField, title: string) {
  cancelLegendFilterHover()
  legendFilterPopoverRef.value?.hide()
  activeLegendFilterField.value = field
  activeLegendFilterTitle.value = title
  nextTick(() => {
    legendFilterPopoverRef.value?.show(event)
  })
}

function onLegendHeaderMouseEnter(event: MouseEvent, field: LegendSortField, title: string) {
  const targetElement = event.currentTarget as HTMLElement
  cancelLegendFilterHover()
  legendFilterHoverTimer = setTimeout(() => {
    const fakeEvent = {
      currentTarget: targetElement,
      target: targetElement,
      preventDefault: () => {},
      stopPropagation: () => {}
    }
    showLegendFilterPopover(fakeEvent as unknown as Event, field, title)
  }, 500)
}

function cancelLegendFilterHover() {
  if (legendFilterHoverTimer) {
    clearTimeout(legendFilterHoverTimer)
    legendFilterHoverTimer = null
  }
}

function onLegendFilterKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    legendFilterPopoverRef.value?.hide()
  }
}

function toggleMaximizedChart() {
  if (isMaximized.value) {
    isMaximized.value = false
    emit('update:chartHeight', previousChartHeight.value ?? 250)
    previousChartHeight.value = null
    return
  }

  previousChartHeight.value = props.chartHeight ?? 250
  isMaximized.value = true
  emit('update:chartHeight', Math.max(400, window.innerHeight - 300))
}

// Color palette for stacked bars
const colorPalette = [
  { bg: 'rgba(54, 162, 235, 0.6)', border: 'rgba(54, 162, 235, 1)' },
  { bg: 'rgba(255, 99, 132, 0.6)', border: 'rgba(255, 99, 132, 1)' },
  { bg: 'rgba(75, 192, 192, 0.6)', border: 'rgba(75, 192, 192, 1)' },
  { bg: 'rgba(255, 206, 86, 0.6)', border: 'rgba(255, 206, 86, 1)' },
  { bg: 'rgba(153, 102, 255, 0.6)', border: 'rgba(153, 102, 255, 1)' },
  { bg: 'rgba(255, 159, 64, 0.6)', border: 'rgba(255, 159, 64, 1)' },
  { bg: 'rgba(199, 199, 199, 0.6)', border: 'rgba(199, 199, 199, 1)' },
  { bg: 'rgba(83, 102, 255, 0.6)', border: 'rgba(83, 102, 255, 1)' },
  { bg: 'rgba(255, 99, 255, 0.6)', border: 'rgba(255, 99, 255, 1)' },
  { bg: 'rgba(99, 255, 132, 0.6)', border: 'rgba(99, 255, 132, 1)' },
]

type TimeUnit = 'second' | 'minute' | 'hour' | 'day' | 'week' | 'month'

// Get time unit for chart.js based on bucket size
function getTimeUnit(bucket: TimeBucket): TimeUnit {
  switch (bucket) {
    case 'second': return 'second'
    case 'minute': 
    case '5min':
    case '10min':
    case '30min':
      return 'minute'
    case 'hour': return 'hour'
    case 'day': return 'day'
    case 'week': return 'week'
    case 'month': return 'month'
    default: return 'minute'
  }
}

// Get step size for chart.js based on bucket size
function getStepSize(bucket: TimeBucket): number {
  switch (bucket) {
    case '5min': return 5
    case '10min': return 10
    case '30min': return 30
    default: return 1
  }
}

// Get bucket duration in milliseconds
function getBucketDuration(bucket: TimeBucket): number {
  switch (bucket) {
    case 'second': return 1000
    case 'minute': return 60 * 1000
    case '5min': return 5 * 60 * 1000
    case '10min': return 10 * 60 * 1000
    case '30min': return 30 * 60 * 1000
    case 'hour': return 60 * 60 * 1000
    case 'day': return 24 * 60 * 60 * 1000
    case 'week': return 7 * 24 * 60 * 60 * 1000
    case 'month': return 30 * 24 * 60 * 60 * 1000
    default: return 60 * 1000
  }
}

function getUnitDuration(unit: TimeUnit): number {
  switch (unit) {
    case 'second': return 1000
    case 'minute': return 60 * 1000
    case 'hour': return 60 * 60 * 1000
    case 'day': return 24 * 60 * 60 * 1000
    case 'week': return 7 * 24 * 60 * 60 * 1000
    case 'month': return 30 * 24 * 60 * 60 * 1000
  }
}

function getSeriesColor(series: SeriesSummary) {
  return colorPalette[(series.colorIndex + 2) % colorPalette.length]
}

function getSafeTimeTickConfig(bucket: TimeBucket, range: { min?: number; max?: number }): { unit: TimeUnit; stepSize?: number } {
  const units: TimeUnit[] = ['second', 'minute', 'hour', 'day', 'week', 'month']
  const maxGeneratedTicks = 1000
  const rangeMs = range.min !== undefined && range.max !== undefined ? range.max - range.min : 0
  let unit = getTimeUnit(bucket)
  let stepSize = getStepSize(bucket)

  for (const candidate of units.slice(units.indexOf(unit))) {
    const candidateStep = candidate === unit ? stepSize : 1
    const tickCount = rangeMs / (getUnitDuration(candidate) * candidateStep)
    if (tickCount <= maxGeneratedTicks) {
      return { unit: candidate, stepSize: candidateStep }
    }
  }

  unit = 'month'
  stepSize = Math.max(1, Math.ceil(rangeMs / (getUnitDuration(unit) * maxGeneratedTicks)))
  return { unit, stepSize }
}

function getHighlightedTooltipDatasetIndex(chart: any): number | null {
  const value = chart?.$tdvHighlightedTooltipDatasetIndex
  return typeof value === 'number' ? value : null
}

function isHighlightedTooltipItem(item: any): boolean {
  const tooltipItemCount = item.chart?.tooltip?.dataPoints?.length || 0
  return tooltipItemCount > 1 && item.datasetIndex === getHighlightedTooltipDatasetIndex(item.chart)
}

// Calculate time range with padding to include edge data points
const timeRange = computed(() => {
  if (chartBuckets.value.length === 0) return { min: undefined, max: undefined }
  
  const times = chartBuckets.value.map(d => d.time.getTime())
  const minTime = Math.min(...times)
  const maxTime = Math.max(...times)
  const bucketDuration = getBucketDuration(bucketSize.value)
  
  return {
    min: minTime - bucketDuration,
    max: maxTime + bucketDuration
  }
})

const effectiveTimeRange = computed(() => {
  if (timeSelectionStart.value == null || timeSelectionEnd.value == null) {
    return timeRange.value
  }
  const start = Math.min(timeSelectionStart.value, timeSelectionEnd.value)
  const end = Math.max(timeSelectionStart.value, timeSelectionEnd.value)
  return {
    min: start,
    max: end
  }
})

// Chart.js data
const chartJsData = computed<ChartData<'bar'>>(() => {
  const datasets: any[] = []
  
  if (showCount.value && groupedCountEnabled.value && visibleCountGroupKeys.value.length > 0) {
    visibleCountGroupKeys.value.forEach((group, index) => {
      const color = colorPalette[index % colorPalette.length]
      const key = `count:${group}`
      datasets.push({
        label: group,
        data: chartBuckets.value.map(d => ({ x: d.time.getTime(), y: d.countGroups[group] || 0 })),
        backgroundColor: color.bg,
        borderColor: color.border,
        borderWidth: 1,
        yAxisID: 'y',
        stack: 'stack0',
        seriesKey: key
      })
    })
  } else if (
    showCount.value
    && (
      effectiveGroupColumns.value.length === 0
      || visibleCountGroupKeys.value.length > MAX_GROUPED_COUNT_SERIES
    )
  ) {
    datasets.push({
      label: 'Row Count',
      data: chartBuckets.value.map(d => ({ x: d.time.getTime(), y: d.count })),
      backgroundColor: 'rgba(54, 162, 235, 0.6)',
      borderColor: 'rgba(54, 162, 235, 1)',
      borderWidth: 1,
      yAxisID: 'y',
      seriesKey: 'count:All'
    })
  }
  
  visibleValueSeries.value.forEach((series, index) => {
    const color = getSeriesColor(series)
    datasets.push({
      label: `${valueAgg.value.toUpperCase()} ${series.name}`,
      data: chartBuckets.value.map(bucket => {
        const groupKey = getGroupKey(series.groupParts)
        const value = getValueForStats(bucket.valueGroups[series.valueColumn!]?.[groupKey])
        return { x: bucket.time.getTime(), y: value }
      }),
      type: 'line' as const,
      borderColor: color.border,
      backgroundColor: color.bg,
      borderWidth: 2,
      pointRadius: 2,
      yAxisID: 'y1',
      seriesKey: series.key,
      seriesKind: 'value',
      tension: 0.1
    })
  })

  if (showValueSum.value && visibleValueSeries.value.length > 0) {
    datasets.push({
      label: `SUM visible ${valueAgg.value.toUpperCase()}`,
      data: chartBuckets.value.map(bucket => {
        let sum = 0
        let count = 0
        for (const series of visibleValueSeries.value) {
          const groupKey = getGroupKey(series.groupParts)
          const value = getValueForStats(bucket.valueGroups[series.valueColumn!]?.[groupKey])
          if (value === null || !Number.isFinite(value)) continue
          sum += value
          count++
        }
        return { x: bucket.time.getTime(), y: count > 0 ? sum : null }
      }),
      type: 'line' as const,
      borderColor: 'rgba(17, 24, 39, 1)',
      backgroundColor: 'rgba(17, 24, 39, 0.14)',
      borderWidth: 3,
      pointRadius: 0,
      yAxisID: 'y1',
      seriesKey: 'value-sum:visible',
      seriesKind: 'value-sum',
      tension: 0.1
    })
  }
  
  return { datasets }
})

// Chart.js options
const chartOptions = computed<ChartOptions<'bar'>>(() => {
  const isStacked = !!(showCount.value && groupedCountEnabled.value && visibleCountGroupKeys.value.length > 0)
  const tickConfig = getSafeTimeTickConfig(bucketSize.value, effectiveTimeRange.value)
  
  const options: ChartOptions<'bar'> = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: totalSeriesCount.value > TOOLTIP_SINGLE_SERIES_THRESHOLD ? 'nearest' : 'index',
      intersect: false
    },
    onHover: (event: any, _elements: any[], chart: any) => {
      const nativeEvent = event?.native
      const nearest = nativeEvent
        ? chart.getElementsAtEventForMode(nativeEvent, 'nearest', { intersect: false }, false)
        : []
      const nextDatasetIndex = nearest[0]?.datasetIndex ?? null

      if (chart.$tdvHighlightedTooltipDatasetIndex !== nextDatasetIndex) {
        chart.$tdvHighlightedTooltipDatasetIndex = nextDatasetIndex
        chart.update('none')
      }
    },
    plugins: {
      legend: {
        display: false,
        position: 'top',
        labels: {
          filter: (item: any, data: any) => {
            const dataset = data.datasets[item.datasetIndex] as any
            return dataset?.seriesKind !== 'value' && dataset?.seriesKind !== 'value-sum'
          }
        }
      },
      title: {
        display: false
      },
      tooltip: {
        backgroundColor: 'rgba(17, 24, 39, 0.6)',
        borderColor: 'rgba(255, 255, 255, 0.18)',
        borderWidth: 1,
        callbacks: {
          title: (items: any[]) => {
            const x = items[0]?.parsed?.x
            if (typeof x !== 'number') return ''
            return formatDateLikeOriginal(new Date(x), timeColumnFormat.value)
          },
          label: (item: any) => {
            const label = item.dataset?.label ? `${item.dataset.label}: ` : ''
            const marker = isHighlightedTooltipItem(item) ? '▶ ' : ''
            return `${marker}${label}${item.formattedValue}`
          },
          labelTextColor: (item: any) => {
            return isHighlightedTooltipItem(item) ? '#ffffff' : 'rgba(255, 255, 255, 0.72)'
          },
          labelColor: (item: any) => {
            const dataset = item.dataset || {}
            const highlighted = isHighlightedTooltipItem(item)
            return {
              borderColor: highlighted ? '#ffffff' : dataset.borderColor,
              backgroundColor: dataset.backgroundColor || dataset.borderColor,
              borderWidth: highlighted ? 3 : 1,
              borderRadius: 2
            }
          }
        }
      }
    },
    scales: {
      x: {
        type: 'time',
        stacked: isStacked,
        min: effectiveTimeRange.value.min,
        max: effectiveTimeRange.value.max,
        time: {
          unit: tickConfig.unit,
          displayFormats: {
            second: 'HH:mm:ss',
            minute: 'HH:mm',
            hour: 'MMM d HH:mm',
            day: 'MMM d',
            week: 'MMM d',
            month: 'MMM yyyy'
          }
        },
        ticks: {
          source: 'auto',
          autoSkip: true,
          maxRotation: 45,
          stepSize: tickConfig.stepSize
        }
      },
    }
  }

  if (showCount.value) {
    ;(options.scales as any).y = {
        type: 'linear',
        display: true,
        position: 'left',
        title: {
          display: true,
          text: 'Row Count'
        },
        beginAtZero: true,
        stacked: isStacked
    }
  }
  
  if (effectiveValueColumns.value.length > 0) {
    (options.scales as any).y1 = {
      type: 'linear',
      display: true,
      position: 'right',
      title: {
        display: true,
        text: valueAgg.value.toUpperCase()
      },
      grid: {
        drawOnChartArea: false
      }
    }
  }
  
  return options
})

// Bucket options for dropdown
const bucketOptions = [
  { label: 'Second', value: 'second' },
  { label: 'Minute', value: 'minute' },
  { label: '5 Minutes', value: '5min' },
  { label: '10 Minutes', value: '10min' },
  { label: '30 Minutes', value: '30min' },
  { label: 'Hour', value: 'hour' },
  { label: 'Day', value: 'day' },
  { label: 'Week', value: 'week' },
  { label: 'Month', value: 'month' }
]

const valueAggOptions: { label: string; value: ValueAggregation }[] = [
  { label: 'Sum', value: 'sum' },
  { label: 'Avg', value: 'avg' },
  { label: 'Max', value: 'max' }
]

function onBucketChange() {
  autoDetectBucket.value = false
}

function formatMetric(value: number): string {
  if (!Number.isFinite(value)) return ''
  return Math.abs(value) >= 1000 ? value.toLocaleString(undefined, { maximumFractionDigits: 1 }) : value.toLocaleString(undefined, { maximumFractionDigits: 3 })
}

function toggleSeriesVisibility(series: SeriesSummary, index: number) {
  const next = new Set(hiddenGroups.value)
  const nextExplicitlyShown = new Set(explicitlyShownValueSeries.value)

  if (isValueSeriesVisible(series, index)) {
    next.add(series.key)
    nextExplicitlyShown.delete(series.key)
  } else {
    next.delete(series.key)
    if (index >= MAX_RENDERED_SERIES) nextExplicitlyShown.add(series.key)
  }

  hiddenGroups.value = next
  explicitlyShownValueSeries.value = nextExplicitlyShown
}

function toggleAllValueSeries() {
  const next = new Set(hiddenGroups.value)
  const nextExplicitlyShown = new Set<string>()

  if (allValueSeriesHidden.value) {
    filteredLegendRows.value.forEach(({ series, originalIndex }) => {
      next.delete(series.key)
      if (originalIndex >= MAX_RENDERED_SERIES) nextExplicitlyShown.add(series.key)
    })
  } else {
    for (const series of valueSeriesSummaries.value) next.add(series.key)
  }

  hiddenGroups.value = next
  explicitlyShownValueSeries.value = nextExplicitlyShown
}

function startLegendResize(event: MouseEvent) {
  const chartRect = chartRef.value?.chart?.canvas?.getBoundingClientRect()
  if (!chartRect) return
  legendResizeRight.value = chartRect.right + legendWidth.value
  isResizingLegend.value = true
  window.addEventListener('mousemove', updateLegendResize)
  window.addEventListener('mouseup', stopLegendResize)
  event.preventDefault()
}

function updateLegendResize(event: MouseEvent) {
  if (!isResizingLegend.value) return
  pendingResizeClientX = event.clientX
  if (resizeTimer) return
  resizeTimer = setTimeout(() => {
    resizeTimer = null
    if (pendingResizeClientX == null) return
    legendWidth.value = Math.max(220, legendResizeRight.value - pendingResizeClientX)
  }, 32)
}

function stopLegendResize() {
  if (pendingResizeClientX != null) {
    legendWidth.value = Math.max(220, legendResizeRight.value - pendingResizeClientX)
    pendingResizeClientX = null
  }
  if (resizeTimer) {
    clearTimeout(resizeTimer)
    resizeTimer = null
  }
  isResizingLegend.value = false
  window.removeEventListener('mousemove', updateLegendResize)
  window.removeEventListener('mouseup', stopLegendResize)
}

function startLegendColumnResize(event: MouseEvent, key: LegendColumnKey) {
  resizingLegendColumnKey = key
  legendColumnResizeStartX = event.clientX
  legendColumnResizeStartWidth = getLegendColumnWidth(key)
  window.addEventListener('mousemove', updateLegendColumnResize)
  window.addEventListener('mouseup', stopLegendColumnResize)
  event.preventDefault()
  event.stopPropagation()
}

function updateLegendColumnResize(event: MouseEvent) {
  if (!resizingLegendColumnKey) return
  const minWidth = getLegendColumnMinWidth(resizingLegendColumnKey)
  const width = Math.max(minWidth, legendColumnResizeStartWidth + event.clientX - legendColumnResizeStartX)
  legendColumnWidths.value = {
    ...legendColumnWidths.value,
    [resizingLegendColumnKey]: Math.round(width),
  }
}

function stopLegendColumnResize() {
  resizingLegendColumnKey = null
  window.removeEventListener('mousemove', updateLegendColumnResize)
  window.removeEventListener('mouseup', stopLegendColumnResize)
}

function getChartTimeFromClientX(clientX: number): number | null {
  const chart = chartRef.value?.chart
  const xScale = chart?.scales?.x
  const canvas: HTMLCanvasElement | undefined = chart?.canvas
  if (!xScale || !canvas) return null

  const rect = canvas.getBoundingClientRect()
  const pixelInCanvas = clientX - rect.left
  const clampedPixel = Math.max(xScale.left, Math.min(xScale.right, pixelInCanvas))
  const value = xScale.getValueForPixel(clampedPixel)
  if (typeof value === 'number' && !Number.isNaN(value)) return value
  if (value instanceof Date) return value.getTime()
  return null
}

function resetTimeSelection() {
  timeSelectionStart.value = null
  timeSelectionEnd.value = null
}

const hasTimeSelection = computed(() => timeSelectionStart.value != null && timeSelectionEnd.value != null)

const dragOverlayStyle = computed(() => {
  if (!isDraggingSelection.value) return { display: 'none' }
  const left = Math.min(dragStartClientX.value, dragCurrentClientX.value)
  const width = Math.abs(dragCurrentClientX.value - dragStartClientX.value)
  return {
    left: `${left}px`,
    width: `${width}px`
  }
})

function startTimeSelectionDrag(event: MouseEvent) {
  if (event.button !== 0 || !timeColumn.value || chartBuckets.value.length === 0) return
  const chart = chartRef.value?.chart
  const canvas: HTMLCanvasElement | undefined = chart?.canvas
  const chartArea = chart?.chartArea
  if (!canvas || !chartArea) return

  const rect = canvas.getBoundingClientRect()
  const x = Math.max(0, Math.min(rect.width, event.clientX - rect.left))
  const y = Math.max(0, Math.min(rect.height, event.clientY - rect.top))

  // Only start drag inside the plot area; legend/title clicks should be ignored.
  if (x < chartArea.left || x > chartArea.right || y < chartArea.top || y > chartArea.bottom) {
    return
  }

  dragStartClientX.value = x
  dragCurrentClientX.value = dragStartClientX.value
  isDraggingSelection.value = true

  window.addEventListener('mousemove', updateTimeSelectionDrag)
  window.addEventListener('mouseup', endTimeSelectionDrag)
  event.preventDefault()
}

function updateTimeSelectionDrag(event: MouseEvent) {
  if (!isDraggingSelection.value) return
  const chart = chartRef.value?.chart
  const canvas: HTMLCanvasElement | undefined = chart?.canvas
  if (!canvas) return

  const rect = canvas.getBoundingClientRect()
  dragCurrentClientX.value = Math.max(0, Math.min(rect.width, event.clientX - rect.left))
}

function endTimeSelectionDrag() {
  if (!isDraggingSelection.value) return
  isDraggingSelection.value = false

  window.removeEventListener('mousemove', updateTimeSelectionDrag)
  window.removeEventListener('mouseup', endTimeSelectionDrag)

  const rectLeft = chartRef.value?.chart?.canvas?.getBoundingClientRect().left
  if (rectLeft == null) return

  const startMs = getChartTimeFromClientX(dragStartClientX.value + rectLeft)
  const endMs = getChartTimeFromClientX(dragCurrentClientX.value + rectLeft)

  if (startMs == null || endMs == null || startMs === endMs) return
  timeSelectionStart.value = Math.min(startMs, endMs)
  timeSelectionEnd.value = Math.max(startMs, endMs)
}

onBeforeUnmount(() => {
  if (debounceTimer) clearTimeout(debounceTimer)
  if (resizeTimer) clearTimeout(resizeTimer)
  if (legendFilterHoverTimer) clearTimeout(legendFilterHoverTimer)
  window.removeEventListener('mousemove', updateTimeSelectionDrag)
  window.removeEventListener('mouseup', endTimeSelectionDrag)
  window.removeEventListener('mousemove', updateLegendResize)
  window.removeEventListener('mouseup', stopLegendResize)
  window.removeEventListener('mousemove', updateLegendColumnResize)
  window.removeEventListener('mouseup', stopLegendColumnResize)
})
</script>

<template>
  <div class="time-series-chart">
    <div class="chart-controls">
      <div class="control-group">
        <label>Time Column:</label>
        <Select
          v-model="timeColumn"
          :options="timeColumns"
          placeholder="Select time column"
          class="control-select"
        />
      </div>
      
      <div class="control-group">
        <label>Aggregation:</label>
        <Select
          v-model="bucketSize"
          :options="bucketOptions"
          optionLabel="label"
          optionValue="value"
          class="control-select"
          @change="onBucketChange"
        />
      </div>
      
      <div class="control-group">
        <label>Group By:</label>
        <MultiSelect
          v-model="groupColumns"
          :options="groupMultiSelectOptions"
          optionLabel="label"
          optionValue="value"
          placeholder="None"
          class="control-select multi-control"
          display="chip"
          :maxSelectedLabels="2"
        />
      </div>
      
      <div class="control-group">
        <label>Values:</label>
        <MultiSelect
          v-model="valueColumns"
          :options="numericColumns"
          placeholder="None"
          class="control-select multi-control"
          display="chip"
          :maxSelectedLabels="2"
        />
      </div>

      <div class="control-group">
        <label>Value Agg:</label>
        <Select
          v-model="valueAgg"
          :options="valueAggOptions"
          optionLabel="label"
          optionValue="value"
          class="control-select agg-select"
        />
      </div>

      <label class="control-group checkbox-control">
        <Checkbox v-model="showCount" :binary="true" />
        <span>Count</span>
      </label>

      <label class="control-group checkbox-control">
        <Checkbox v-model="showValueSum" :binary="true" :disabled="valueSeriesSummaries.length === 0" />
        <span>Sum</span>
      </label>

      <div class="control-group">
        <Button
          icon="pi pi-refresh"
          size="small"
          text
          severity="secondary"
          :disabled="!hasTimeSelection"
          @click="resetTimeSelection"
          v-tooltip.top="'Reset time selection'"
        />
      </div>

      <div class="chart-actions">
        <Button
          :icon="isMaximized ? 'pi pi-window-minimize' : 'pi pi-window-maximize'"
          text
          severity="secondary"
          @click="toggleMaximizedChart"
          v-tooltip.top="isMaximized ? 'Minimize chart' : 'Maximize chart'"
        />
        <Button
          icon="pi pi-times"
          text
          severity="secondary"
          @click="emit('close')"
          v-tooltip.top="'Close chart'"
        />
      </div>
    </div>
    
    <div
      class="chart-layout"
      :class="{ maximized: isMaximized }"
      :style="chartLayoutStyle"
      v-if="timeColumn && chartHasData"
    >
      <div class="chart-container" @mousedown.capture="startTimeSelectionDrag">
        <Bar
          ref="chartRef"
          :data="chartJsData"
          :options="chartOptions"
        />
        <div v-if="isDraggingSelection" class="selection-overlay" :style="dragOverlayStyle" />
      </div>

      <div
        v-if="valueColumns.length > 0"
        class="legend-divider"
        :class="{ resizing: isResizingLegend }"
        @mousedown="startLegendResize"
      />

      <aside
        v-if="valueColumns.length > 0"
        class="value-legend"
        :style="{ width: `${legendWidth}px` }"
      >
        <table :style="{ minWidth: `${legendTableWidth}px` }">
          <colgroup>
            <col :style="{ width: `${LEGEND_VISIBILITY_COL_WIDTH}px` }" />
            <col :style="{ width: `${LEGEND_COLOR_COL_WIDTH}px` }" />
            <col :style="{ width: `${getLegendColumnWidth('name')}px` }" />
            <col
              v-for="(_, groupIndex) in effectiveGroupColumns"
              :key="`group-col:${groupIndex}`"
              :style="{ width: `${getLegendColumnWidth(`group:${groupIndex}`)}px` }"
            />
            <col :style="{ width: `${getLegendColumnWidth('max')}px` }" />
            <col :style="{ width: `${getLegendColumnWidth('mean')}px` }" />
          </colgroup>
          <thead>
            <tr>
              <th class="visibility-col">
                <Button
                  :icon="allValueSeriesHidden ? 'pi pi-eye' : 'pi pi-eye-slash'"
                  text
                  size="small"
                  severity="secondary"
                  @click="toggleAllValueSeries"
                  v-tooltip.top="allValueSeriesHidden ? 'Show matching value series' : 'Hide all value series'"
                />
              </th>
              <th class="color-col"></th>
              <th
                class="legend-filterable-header legend-resizable-header"
                @mouseenter="onLegendHeaderMouseEnter($event, 'name', 'Name')"
                @mouseleave="cancelLegendFilterHover"
              >
                <div class="legend-header-content">
                  <button
                    type="button"
                    class="legend-sort-button"
                    :class="{ 'has-filter': isLegendFilterActive('name'), 'has-disabled-filter': isLegendFilterDisabled('name') }"
                    @click="setLegendSort('name')"
                  >
                    <span>Name</span>
                    <i :class="getLegendSortIcon('name')"></i>
                  </button>
                  <i
                    class="pi pi-filter legend-filter-indicator"
                    :class="{ active: isLegendFilterActive('name'), 'filter-disabled': isLegendFilterDisabled('name') }"
                    @click.stop="showLegendFilterPopover($event, 'name', 'Name')"
                  ></i>
                </div>
                <span
                  class="legend-column-resize-handle"
                  @mousedown="startLegendColumnResize($event, 'name')"
                />
              </th>
              <th
                v-for="(groupColumnName, groupIndex) in effectiveGroupColumns"
                :key="groupColumnName"
                class="legend-filterable-header legend-resizable-header"
                @mouseenter="onLegendHeaderMouseEnter($event, `group:${groupIndex}`, groupColumnName)"
                @mouseleave="cancelLegendFilterHover"
              >
                <div class="legend-header-content">
                  <button
                    type="button"
                    class="legend-sort-button"
                    :class="{ 'has-filter': isLegendFilterActive(`group:${groupIndex}`), 'has-disabled-filter': isLegendFilterDisabled(`group:${groupIndex}`) }"
                    @click="setLegendSort(`group:${groupIndex}`)"
                  >
                    <span>{{ groupColumnName }}</span>
                    <i :class="getLegendSortIcon(`group:${groupIndex}`)"></i>
                  </button>
                  <i
                    class="pi pi-filter legend-filter-indicator"
                    :class="{ active: isLegendFilterActive(`group:${groupIndex}`), 'filter-disabled': isLegendFilterDisabled(`group:${groupIndex}`) }"
                    @click.stop="showLegendFilterPopover($event, `group:${groupIndex}`, groupColumnName)"
                  ></i>
                </div>
                <span
                  class="legend-column-resize-handle"
                  @mousedown="startLegendColumnResize($event, `group:${groupIndex}`)"
                />
              </th>
              <th
                class="numeric-col legend-filterable-header legend-resizable-header"
                @mouseenter="onLegendHeaderMouseEnter($event, 'max', 'Max')"
                @mouseleave="cancelLegendFilterHover"
              >
                <div class="legend-header-content">
                  <button
                    type="button"
                    class="legend-sort-button numeric-sort"
                    :class="{ 'has-filter': isLegendFilterActive('max'), 'has-disabled-filter': isLegendFilterDisabled('max') }"
                    @click="setLegendSort('max')"
                  >
                    <span>Max</span>
                    <i :class="getLegendSortIcon('max')"></i>
                  </button>
                  <i
                    class="pi pi-filter legend-filter-indicator"
                    :class="{ active: isLegendFilterActive('max'), 'filter-disabled': isLegendFilterDisabled('max') }"
                    @click.stop="showLegendFilterPopover($event, 'max', 'Max')"
                  ></i>
                </div>
                <span
                  class="legend-column-resize-handle"
                  @mousedown="startLegendColumnResize($event, 'max')"
                />
              </th>
              <th
                class="numeric-col legend-filterable-header legend-resizable-header"
                @mouseenter="onLegendHeaderMouseEnter($event, 'mean', 'Mean')"
                @mouseleave="cancelLegendFilterHover"
              >
                <div class="legend-header-content">
                  <button
                    type="button"
                    class="legend-sort-button numeric-sort"
                    :class="{ 'has-filter': isLegendFilterActive('mean'), 'has-disabled-filter': isLegendFilterDisabled('mean') }"
                    @click="setLegendSort('mean')"
                  >
                    <span>Mean</span>
                    <i :class="getLegendSortIcon('mean')"></i>
                  </button>
                  <i
                    class="pi pi-filter legend-filter-indicator"
                    :class="{ active: isLegendFilterActive('mean'), 'filter-disabled': isLegendFilterDisabled('mean') }"
                    @click.stop="showLegendFilterPopover($event, 'mean', 'Mean')"
                  ></i>
                </div>
                <span
                  class="legend-column-resize-handle"
                  @mousedown="startLegendColumnResize($event, 'mean')"
                />
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="filteredLegendRows.length === 0">
              <td class="legend-empty" :colspan="effectiveGroupColumns.length + 5">
                No series match the legend filters
              </td>
            </tr>
            <template v-else>
              <tr
                v-for="{ series, originalIndex } in filteredLegendRows"
                :key="series.key"
                :class="{ hidden: !isValueSeriesVisible(series, originalIndex) }"
              >
                <td class="visibility-col">
                  <Button
                    :icon="isValueSeriesVisible(series, originalIndex) ? 'pi pi-eye' : 'pi pi-eye-slash'"
                    text
                    size="small"
                    severity="secondary"
                    @click="toggleSeriesVisibility(series, originalIndex)"
                    v-tooltip.top="isValueSeriesVisible(series, originalIndex) ? 'Hide series' : 'Show series'"
                  />
                </td>
                <td class="color-col">
                  <span
                    class="series-color"
                    :style="{ backgroundColor: getSeriesColor(series).border }"
                  />
                </td>
                <td class="series-name" :title="series.name">{{ series.valueColumn }}</td>
                <td
                  v-for="(_, index) in effectiveGroupColumns"
                  :key="`${series.key}:${index}`"
                  :title="series.groupParts[index] || ''"
                >
                  {{ series.groupParts[index] || '' }}
                </td>
                <td class="numeric-col">{{ formatMetric(series.max) }}</td>
                <td class="numeric-col">{{ formatMetric(series.mean) }}</td>
              </tr>
            </template>
          </tbody>
        </table>
        <BasicColumnFilterPopover
          ref="legendFilterPopoverRef"
          v-model:query="activeLegendFilterText"
          v-model:is-regex="activeLegendFilterQuery.isRegex"
          v-model:is-negate="activeLegendFilterQuery.isNegate"
          v-model:is-array="activeLegendFilterQuery.isArray"
          v-model:is-disabled="activeLegendFilterQuery.isDisabled"
          v-model:is-js="activeLegendFilterIsJs"
          :field="activeLegendFilterTitle"
          :show-js="true"
          :show-hide-column="false"
          popover-class="legend-filter-popover"
          :width="320"
          @clear="clearActiveLegendFilter"
          @keydown="onLegendFilterKeydown"
        />
      </aside>
    </div>
    
    <div class="no-data" v-else-if="timeColumn">
      <i class="pi pi-info-circle"></i>
      <span>Enable count or select value columns to display the chart</span>
    </div>

    <div class="no-data" v-else-if="timeColumns.length === 0">
      <i class="pi pi-info-circle"></i>
      <span>No timestamp columns detected in the data</span>
    </div>
    
    <div class="no-data" v-else-if="!timeColumn">
      <i class="pi pi-info-circle"></i>
      <span>Select a time column to display the chart</span>
    </div>
  </div>
</template>

<style scoped>
.time-series-chart {
  display: flex;
  flex-direction: column;
  background: var(--tdv-surface);
  border: 1px solid var(--tdv-surface-border);
  border-radius: var(--tdv-radius);
  margin-bottom: 8px;
}

.chart-controls {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 8px 12px;
  border-bottom: 1px solid var(--tdv-surface-border);
  flex-wrap: wrap;
}

.control-group {
  display: flex;
  align-items: center;
  gap: 6px;
}

.control-group label {
  font-size: 0.8rem;
  color: var(--tdv-text-muted);
  white-space: nowrap;
}

.control-select {
  min-width: 120px;
}

.multi-control {
  min-width: 180px;
  max-width: 280px;
}

.agg-select {
  min-width: 90px;
}

.checkbox-control {
  cursor: pointer;
  user-select: none;
}

.chart-actions {
  margin-left: auto;
  display: flex;
  gap: 4px;
}

.chart-layout {
  display: flex;
  min-height: 250px;
  height: 250px;
  transition: height 0.2s ease;
}

.chart-container {
  position: relative;
  flex: 1 1 auto;
  min-width: 0;
  padding: 12px;
}

.selection-overlay {
  position: absolute;
  top: 12px;
  bottom: 12px;
  background: rgba(37, 99, 235, 0.2);
  border: 1px solid rgba(37, 99, 235, 0.6);
  z-index: 3;
  pointer-events: none;
}

.legend-divider {
  flex: 0 0 6px;
  cursor: col-resize;
  border-left: 1px solid var(--tdv-surface-border);
  border-right: 1px solid var(--tdv-surface-border);
  background: var(--tdv-surface-light);
}

.legend-divider:hover,
.legend-divider.resizing {
  background: var(--tdv-hover-bg);
}

.value-legend {
  flex: 0 0 auto;
  min-width: 220px;
  overflow: auto;
  border-left: 1px solid var(--tdv-surface-border);
}

.value-legend table {
  width: 100%;
  border-collapse: collapse;
  table-layout: fixed;
  font-size: 0.72rem;
  line-height: 1.15;
}

.value-legend th,
.value-legend td {
  padding: 2px 4px;
  border-bottom: 1px solid var(--tdv-surface-border);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  text-align: left;
}

.value-legend th {
  position: sticky;
  top: 0;
  z-index: 1;
  overflow: visible;
  background: var(--tdv-surface);
  color: var(--tdv-text-muted);
  font-weight: 600;
}

.legend-resizable-header {
  position: sticky;
  padding-right: 8px;
}

.legend-column-resize-handle {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  width: 8px;
  cursor: col-resize;
  z-index: 2;
}

.legend-column-resize-handle::after {
  content: '';
  position: absolute;
  top: 4px;
  right: 0;
  bottom: 4px;
  width: 1px;
  background: var(--tdv-surface-border);
  opacity: 0;
}

.legend-resizable-header:hover .legend-column-resize-handle::after {
  opacity: 1;
}

.legend-header-content {
  display: flex;
  align-items: center;
  min-width: 0;
  gap: 2px;
}

.legend-sort-button {
  display: inline-flex;
  align-items: center;
  justify-content: flex-start;
  gap: 2px;
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

.legend-sort-button span {
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
}

.legend-sort-button i {
  flex: 0 0 auto;
  font-size: 0.62rem;
  opacity: 0.75;
}

.legend-sort-button.has-filter {
  color: var(--tdv-success);
}

.legend-sort-button.has-disabled-filter {
  color: var(--tdv-warning, #f59e0b);
  font-style: italic;
}

.numeric-sort {
  justify-content: flex-end;
}

.legend-filter-indicator {
  flex: 0 0 auto;
  font-size: 0.6rem;
  opacity: 0;
}

.legend-filterable-header:hover .legend-filter-indicator,
.legend-filterable-header:focus-within .legend-filter-indicator,
.legend-filter-indicator.active {
  opacity: 0.8;
}

.legend-filter-indicator.active {
  color: var(--tdv-primary);
}

.legend-filter-indicator.filter-disabled {
  color: var(--tdv-warning, #f59e0b);
}

:global(.legend-filter-popover.p-popover) {
  max-width: 360px;
}

:global(.legend-filter-popover .p-popover-content) {
  padding: 8px;
}

.legend-filter-popover-content {
  width: 320px;
}

.legend-empty {
  padding: 10px 6px !important;
  color: var(--tdv-text-muted);
  text-align: center !important;
}

.value-legend tr.hidden {
  opacity: 0.5;
}

.visibility-col {
  width: 26px;
  text-align: center;
}

.color-col {
  width: 16px;
  text-align: center;
}

.value-legend .visibility-col :deep(.p-button) {
  width: 20px;
  height: 20px;
  padding: 0;
}

.value-legend .visibility-col :deep(.p-button-icon) {
  font-size: 0.72rem;
}

.series-color {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  vertical-align: middle;
}

.series-name {
  font-weight: 600;
}

.numeric-col {
  text-align: right !important;
}

.no-data {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 24px;
  color: var(--tdv-text-muted);
  font-size: 0.9rem;
}

.no-data i {
  font-size: 1.2rem;
}
</style>
