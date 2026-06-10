import { computed, onBeforeUnmount, ref, type ComputedRef, type Ref } from 'vue'

interface ResizableColumn<Key extends string> {
  key: Key
}

interface UseColumnResizeOptions<Key extends string> {
  columns: Ref<readonly ResizableColumn<Key>[]> | ComputedRef<readonly ResizableColumn<Key>[]>
  defaultWidths?: Partial<Record<Key, number>>
  defaultWidth: number
  minWidth?: number
  getMinWidth?: (key: Key) => number
  debounceMs?: number
}

export function useColumnResize<Key extends string>(options: UseColumnResizeOptions<Key>) {
  const columnWidths = ref<Partial<Record<Key, number>>>({})
  const resizingColumnKey = ref<Key | null>(null)
  let resizeStartX = 0
  let resizeStartWidth = 0
  let pendingResizeClientX: number | null = null
  let resizeTimer: ReturnType<typeof setTimeout> | null = null

  function getColumnWidth(key: Key): number {
    return columnWidths.value[key] ?? options.defaultWidths?.[key] ?? options.defaultWidth
  }

  function getColumnMinWidth(key: Key): number {
    return options.getMinWidth?.(key) ?? options.minWidth ?? 48
  }

  const tableWidth = computed(() => {
    return options.columns.value.reduce((sum, col) => sum + getColumnWidth(col.key), 0)
  })

  function applyColumnResize(clientX: number) {
    const key = resizingColumnKey.value
    if (!key) return

    const width = Math.max(getColumnMinWidth(key), resizeStartWidth + clientX - resizeStartX)
    columnWidths.value = {
      ...columnWidths.value,
      [key]: Math.round(width),
    }
  }

  function onColumnResize(event: MouseEvent) {
    pendingResizeClientX = event.clientX
    if (resizeTimer) return

    resizeTimer = setTimeout(() => {
      resizeTimer = null
      if (pendingResizeClientX == null) return
      applyColumnResize(pendingResizeClientX)
    }, options.debounceMs ?? 32)
  }

  function stopColumnResize() {
    if (pendingResizeClientX != null) {
      applyColumnResize(pendingResizeClientX)
      pendingResizeClientX = null
    }
    if (resizeTimer) {
      clearTimeout(resizeTimer)
      resizeTimer = null
    }
    resizingColumnKey.value = null
    document.removeEventListener('mousemove', onColumnResize)
    document.removeEventListener('mouseup', stopColumnResize)
  }

  function startColumnResize(event: MouseEvent, key: Key) {
    event.preventDefault()
    event.stopPropagation()
    resizingColumnKey.value = key
    resizeStartX = event.clientX
    resizeStartWidth = getColumnWidth(key)
    pendingResizeClientX = null
    document.addEventListener('mousemove', onColumnResize)
    document.addEventListener('mouseup', stopColumnResize)
  }

  onBeforeUnmount(() => {
    document.removeEventListener('mousemove', onColumnResize)
    document.removeEventListener('mouseup', stopColumnResize)
    if (resizeTimer) clearTimeout(resizeTimer)
  })

  return {
    columnWidths,
    resizingColumnKey,
    tableWidth,
    getColumnWidth,
    startColumnResize,
    stopColumnResize,
  }
}
