import { describe, expect, it } from 'vitest'
import { getHtmlTooltipPosition, getTooltipDatasetLabel } from './ChartTooltipUtil'

describe('getHtmlTooltipPosition', () => {
  it('places the tooltip to the right when the pointer is on the left', () => {
    expect(getHtmlTooltipPosition(
      { width: 1000, height: 600 },
      { x: 200, y: 300 },
      { width: 300, height: 200 },
    )).toEqual({
      left: 212,
      top: 300,
    })
  })

  it('places the tooltip to the left when the pointer is on the right', () => {
    expect(getHtmlTooltipPosition(
      { width: 1000, height: 600 },
      { x: 800, y: 300 },
      { width: 300, height: 200 },
    )).toEqual({
      left: 488,
      top: 300,
    })
  })

  it('does not position a tooltip without valid pointer coordinates', () => {
    expect(getHtmlTooltipPosition(
      { width: 1000, height: 600 },
      { x: null, y: 300 },
      { width: 300, height: 200 },
    )).toBe(false)
  })

  it('aligns the tooltip top with the pointer when space is available', () => {
    expect(getHtmlTooltipPosition(
      { width: 1000, height: 600 },
      { x: 800, y: 50 },
      { width: 300, height: 500 },
    )).toEqual({ left: 488, top: 50 })
  })

  it('shifts the tooltip upward only when it would overflow the bottom', () => {
    expect(getHtmlTooltipPosition(
      { width: 1000, height: 600 },
      { x: 800, y: 500 },
      { width: 300, height: 200 },
    )).toEqual({ left: 488, top: 400 })
  })
})

describe('getTooltipDatasetLabel', () => {
  it('uses the tooltip-specific label without the value aggregate operator', () => {
    expect(getTooltipDatasetLabel({
      label: 'SUM _col0 | main | production',
      tooltipLabel: '_col0 | main | production',
    })).toBe('_col0 | main | production')
  })

  it('keeps the dataset label when no tooltip-specific label is provided', () => {
    expect(getTooltipDatasetLabel({ label: 'Row Count' })).toBe('Row Count')
  })
})
