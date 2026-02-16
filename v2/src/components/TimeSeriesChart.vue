<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Bar } from 'vue-chartjs'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Title,
  Tooltip,
  Legend,
  type ChartData,
  type ChartOptions
} from 'chart.js'
import type { TableRow, TableColumn, TimeBucket, TimeSeriesDataPoint } from '@/utils/TableUtil'
import { detectTimeColumns, detectNumericColumns, detectGroupableColumns, detectBucketSize, aggregateByTime } from '@/utils/TableUtil'
import Select from 'primevue/select'
import Button from 'primevue/button'

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Title,
  Tooltip,
  Legend
)

const props = defineProps<{
  data: TableRow[]
  columns: TableColumn[]
}>()

const emit = defineEmits<{
  close: []
}>()

// State
const timeColumn = ref<string>('')
const valueColumn = ref<string>('')
const groupColumn = ref<string>('')
const bucketSize = ref<TimeBucket>('day')
const autoDetectBucket = ref(true)
const isMaximized = ref(false)

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

// Chart.js data
const chartJsData = computed<ChartData<'bar'>>(() => {
  const labels = chartData.value.map(d => d.label)
  const datasets: any[] = []
  
  if (groupColumn.value && uniqueGroups.value.length > 0) {
    // Create stacked datasets for each group
    uniqueGroups.value.forEach((group, index) => {
      const color = colorPalette[index % colorPalette.length]
      datasets.push({
        label: group,
        data: chartData.value.map(d => d.groups?.[group] || 0),
        backgroundColor: color.bg,
        borderColor: color.border,
        borderWidth: 1,
        yAxisID: 'y',
        stack: 'stack0'
      })
    })
  } else {
    // Single dataset for row counts
    const counts = chartData.value.map(d => d.count)
    datasets.push({
      label: 'Row Count',
      data: counts,
      backgroundColor: 'rgba(54, 162, 235, 0.6)',
      borderColor: 'rgba(54, 162, 235, 1)',
      borderWidth: 1,
      yAxisID: 'y'
    })
  }
  
  // Add value column as line if selected
  if (valueColumn.value) {
    const avgValues = chartData.value.map(d => d.avgValue ?? null)
    datasets.push({
      label: `Avg ${valueColumn.value}`,
      data: avgValues,
      type: 'line' as const,
      borderColor: 'rgba(255, 99, 132, 1)',
      backgroundColor: 'rgba(255, 99, 132, 0.2)',
      borderWidth: 2,
      pointRadius: 3,
      yAxisID: 'y1',
      tension: 0.1
    })
  }
  
  return { labels, datasets }
})

// Chart.js options
const chartOptions = computed<ChartOptions<'bar'>>(() => {
  const isStacked = !!(groupColumn.value && uniqueGroups.value.length > 0)
  
  const options: ChartOptions<'bar'> = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'index',
      intersect: false
    },
    plugins: {
      legend: {
        position: 'top'
      },
      title: {
        display: false
      }
    },
    scales: {
      x: {
        stacked: isStacked
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
