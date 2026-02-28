<script setup lang="ts">
import { computed, ref, watch } from 'vue'
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
import type { TableRow, TableColumn, TimeBucket, TimeSeriesDataPoint } from '@/utils/TableUtil'
import { detectTimeColumns, detectNumericColumns, detectGroupableColumns, detectBucketSize, aggregateByTime } from '@/utils/TableUtil'
import Select from 'primevue/select'
import Button from 'primevue/button'

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
  groupColumnModel?: string
  bucketSizeModel?: TimeBucket
  hiddenGroupsModel?: Set<string>
}>()

const emit = defineEmits<{
  close: []
  'update:groupFilter': [field: string, values: string[]]
  'update:timeColumn': [value: string]
  'update:valueColumn': [value: string]
  'update:groupColumn': [value: string]
  'update:bucketSize': [value: TimeBucket]
  'update:hiddenGroups': [value: Set<string>]
}>()

// State - use props if provided, otherwise use local state
const timeColumn = ref<string>(props.timeColumnModel || '')
const valueColumn = ref<string>(props.valueColumnModel || '')
const groupColumn = ref<string>(props.groupColumnModel || '')
const bucketSize = ref<TimeBucket>(props.bucketSizeModel || 'minute')
const autoDetectBucket = ref(!props.bucketSizeModel) // Auto-detect only if no saved bucket
const isMaximized = ref(false)
const hiddenGroups = ref<Set<string>>(props.hiddenGroupsModel ? new Set(props.hiddenGroupsModel) : new Set())

// Emit state changes to parent
watch(timeColumn, (val) => emit('update:timeColumn', val))
watch(valueColumn, (val) => emit('update:valueColumn', val))
watch(groupColumn, (val) => emit('update:groupColumn', val))
watch(bucketSize, (val) => emit('update:bucketSize', val))
watch(hiddenGroups, (val) => emit('update:hiddenGroups', val))

// Detect columns
const timeColumns = computed(() => detectTimeColumns(props.data, props.columns))
const numericColumns = computed(() => detectNumericColumns(props.data, props.columns))
const groupableColumns = computed(() => detectGroupableColumns(props.data, props.columns, 100))

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

// Reset hidden groups when group column changes
watch(groupColumn, (newCol, oldCol) => {
  hiddenGroups.value = new Set()
  // Clear filter for old column
  if (oldCol) {
    emit('update:groupFilter', oldCol, [])
  }
})

// Aggregate data
const chartData = computed<TimeSeriesDataPoint[]>(() => {
  if (!timeColumn.value || props.data.length === 0) return []
  return aggregateByTime(
    props.data,
    timeColumn.value,
    bucketSize.value,
    valueColumn.value || undefined,
    groupColumn.value || undefined
  )
})

// Get all unique group values across all data points
const uniqueGroups = computed<string[]>(() => {
  if (!groupColumn.value) return []
  const groups = new Set<string>()
  for (const point of chartData.value) {
    if (point.groups) {
      for (const g of Object.keys(point.groups)) {
        groups.add(g)
      }
    }
  }
  return Array.from(groups).sort()
})

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

// Get time unit for chart.js based on bucket size
function getTimeUnit(bucket: TimeBucket): 'second' | 'minute' | 'hour' | 'day' | 'week' | 'month' {
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

// Calculate time range with padding to include edge data points
const timeRange = computed(() => {
  if (chartData.value.length === 0) return { min: undefined, max: undefined }
  
  const times = chartData.value.map(d => d.time.getTime())
  const minTime = Math.min(...times)
  const maxTime = Math.max(...times)
  const bucketDuration = getBucketDuration(bucketSize.value)
  
  return {
    min: minTime - bucketDuration,
    max: maxTime + bucketDuration
  }
})

// Chart.js data
const chartJsData = computed<ChartData<'bar'>>(() => {
  const datasets: any[] = []
  
  if (groupColumn.value && uniqueGroups.value.length > 0) {
    // Create stacked datasets for each group with {x, y} format
    uniqueGroups.value.forEach((group, index) => {
      const color = colorPalette[index % colorPalette.length]
      datasets.push({
        label: group,
        data: chartData.value.map(d => ({ x: d.time.getTime(), y: d.groups?.[group] || 0 })),
        backgroundColor: color.bg,
        borderColor: color.border,
        borderWidth: 1,
        yAxisID: 'y',
        stack: 'stack0',
        hidden: hiddenGroups.value.has(group)
      })
    })
  } else {
    // Single dataset for row counts with {x, y} format
    datasets.push({
      label: 'Row Count',
      data: chartData.value.map(d => ({ x: d.time.getTime(), y: d.count })),
      backgroundColor: 'rgba(54, 162, 235, 0.6)',
      borderColor: 'rgba(54, 162, 235, 1)',
      borderWidth: 1,
      yAxisID: 'y'
    })
  }
  
  // Add value column as line if selected
  if (valueColumn.value) {
    datasets.push({
      label: `Avg ${valueColumn.value}`,
      data: chartData.value.map(d => ({ x: d.time.getTime(), y: d.avgValue ?? null })),
      type: 'line' as const,
      borderColor: 'rgba(255, 99, 132, 1)',
      backgroundColor: 'rgba(255, 99, 132, 0.2)',
      borderWidth: 2,
      pointRadius: 3,
      yAxisID: 'y1',
      tension: 0.1
    })
  }
  
  return { datasets }
})

// Chart.js options
const chartOptions = computed<ChartOptions<'bar'>>(() => {
  const isStacked = !!(groupColumn.value && uniqueGroups.value.length > 0)
  const timeUnit = getTimeUnit(bucketSize.value)
  const stepSize = getStepSize(bucketSize.value)
  
  const options: ChartOptions<'bar'> = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'index',
      intersect: false
    },
    plugins: {
      legend: {
        position: 'top',
        onClick: (evt: any, legendItem: any, legend: any) => {
          // Track hidden groups and emit filter
          if (groupColumn.value && uniqueGroups.value.length > 0) {
            const groupName = legendItem.text
            const newHiddenGroups = new Set(hiddenGroups.value)
            
            if (newHiddenGroups.has(groupName)) {
              // Currently hidden, make it visible
              newHiddenGroups.delete(groupName)
            } else {
              // Currently visible, hide it
              newHiddenGroups.add(groupName)
            }
            
            // Check if all groups would be hidden - if so, reset to show all
            const visibleGroups = uniqueGroups.value.filter(g => !newHiddenGroups.has(g))
            if (visibleGroups.length === 0) {
              // All groups hidden - reset to show all
              hiddenGroups.value = new Set()
              emit('update:groupFilter', groupColumn.value, [])
            } else {
              // Replace the Set to trigger reactivity
              hiddenGroups.value = newHiddenGroups
              
              // Emit visible groups to sync with table filter
              if (newHiddenGroups.size > 0) {
                emit('update:groupFilter', groupColumn.value, visibleGroups)
              } else {
                // All visible - clear the filter
                emit('update:groupFilter', groupColumn.value, [])
              }
            }
          } else {
            // No grouping - use default Chart.js behavior
            const index = legendItem.datasetIndex
            const ci = legend.chart
            const meta = ci.getDatasetMeta(index)
            meta.hidden = !meta.hidden
            ci.update()
          }
        }
      },
      title: {
        display: false
      }
    },
    scales: {
      x: {
        type: 'time',
        stacked: isStacked,
        min: timeRange.value.min,
        max: timeRange.value.max,
        time: {
          unit: timeUnit,
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
          stepSize: stepSize
        }
      },
      y: {
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
  }
  
  // Add second Y axis if value column is selected
  if (valueColumn.value) {
    (options.scales as any).y1 = {
      type: 'linear',
      display: true,
      position: 'right',
      title: {
        display: true,
        text: `Avg ${valueColumn.value}`
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

function onBucketChange() {
  autoDetectBucket.value = false
}
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
        <Select
          v-model="groupColumn"
          :options="['', ...groupableColumns]"
          placeholder="None"
          class="control-select"
        />
      </div>
      
      <div class="control-group">
        <label>Value (avg):</label>
        <Select
          v-model="valueColumn"
          :options="['', ...numericColumns]"
          placeholder="None"
          class="control-select"
        />
      </div>
      
      <div class="chart-actions">
        <Button
          :icon="isMaximized ? 'pi pi-window-minimize' : 'pi pi-window-maximize'"
          text
          severity="secondary"
          @click="isMaximized = !isMaximized"
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
    
    <div class="chart-container" :class="{ maximized: isMaximized }" v-if="timeColumn && chartData.length > 0">
      <Bar :data="chartJsData" :options="chartOptions" />
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

.chart-actions {
  margin-left: auto;
  display: flex;
  gap: 4px;
}

.chart-container {
  height: 250px;
  padding: 12px;
  transition: height 0.2s ease;
}

.chart-container.maximized {
  height: calc(100vh - 300px);
  min-height: 400px;
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
