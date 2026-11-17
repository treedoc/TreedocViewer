import { describe, expect, it } from 'vitest'
import { summarizeChartValues } from './ChartLegendUtil'

describe('legend statistics', () => {
  it('uses chronological endpoints, not min/max, for Increase', () => {
    expect(summarizeChartValues([10, 50, 7])).toEqual({ max: 50, mean: 67 / 3, last: 7, increase: -3 })
  })
  it('ignores invalid observations and handles a single point', () => {
    expect(summarizeChartValues([NaN, 8, Infinity])).toEqual({ max: 8, mean: 8, last: 8, increase: 0 })
    expect(summarizeChartValues([])).toEqual({ max: 0, mean: 0, last: 0, increase: 0 })
  })
})
