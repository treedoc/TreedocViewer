import { describe, expect, it } from 'vitest'
import { summarizeChartValues } from './ChartLegendUtil'

describe('legend statistics', () => {
  it('excludes the latest observation from Increase while retaining Last', () => {
    expect(summarizeChartValues([10, 50, 7])).toEqual({ max: 50, mean: 67 / 3, last: 7, increase: 40 })
  })
  it('uses the penultimate observation rather than the maximum', () => {
    expect(summarizeChartValues([20, 50, 12, 3]).increase).toBe(-8)
    expect(summarizeChartValues([10, 1]).increase).toBe(0)
  })
  it('ignores invalid observations and handles a single point', () => {
    expect(summarizeChartValues([NaN, 8, Infinity])).toEqual({ max: 8, mean: 8, last: 8, increase: 0 })
    expect(summarizeChartValues([])).toEqual({ max: 0, mean: 0, last: 0, increase: 0 })
  })
})
