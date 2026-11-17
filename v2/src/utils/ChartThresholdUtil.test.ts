import { describe, expect, it } from 'vitest'
import { thresholdBands } from './ChartThresholdUtil'

describe('threshold bands', () => {
  it('sorts multiple thresholds into nonoverlapping colored bands', () => {
    expect(thresholdBands([
      { name: 'High', value: 20, color: 'red' }, { name: 'Low', value: 10, color: 'amber' },
    ], 0, 100)).toEqual([
      { start: 0, end: 100, value: 10, upper: 20, color: 'amber' },
      { start: 0, end: 100, value: 20, upper: undefined, color: 'red' },
    ])
  })
  it('respects activation and exclusive expiry, and clips to the chart', () => {
    expect(thresholdBands([
      { name: 'Plan', value: 10, color: 'red', start: '2026-10-01T00:00:00Z', end: '2026-10-04T00:00:00Z' },
      { name: 'invalid', value: NaN, color: 'blue' },
      { name: 'invalid date', value: 20, color: 'blue', start: 'invalid' },
    ], Date.parse('2026-09-30T00:00:00Z'), Date.parse('2026-10-05T00:00:00Z'))).toEqual([
      { start: Date.parse('2026-10-01T00:00:00Z'), end: Date.parse('2026-10-04T00:00:00Z'), value: 10, upper: undefined, color: 'red' },
    ])
  })
})
