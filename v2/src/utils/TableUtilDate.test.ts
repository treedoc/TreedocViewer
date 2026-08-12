import { describe, expect, it } from 'vitest'
import { detectTimeColumns, type TableColumn, type TableRow } from './TableUtil'

describe('detectTimeColumns', () => {
  it('detects space-separated ISO timestamps with timezone offsets', () => {
    const data: TableRow[] = [
      { timestamp: '2026-08-09 00:00:00+00:00', value: 10 },
      { timestamp: '2026-08-09 00:01:00+00:00', value: 20 },
      { timestamp: '2026-08-09 00:02:00+00:00', value: 30 },
    ]
    const columns: TableColumn[] = [
      { field: 'timestamp', header: 'timestamp', sortable: true, filterable: true, visible: true },
      { field: 'value', header: 'value', sortable: true, filterable: true, visible: true },
    ]

    expect(detectTimeColumns(data, columns)).toEqual(['timestamp'])
  })
})
