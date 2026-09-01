import { describe, expect, it } from 'vitest'
import { alignTimeRangeToGrid, getUtcDaySpans, isTimeUnitFinerThanDay } from './ChartTimeGridUtil'

describe('ChartTimeGridUtil', () => {
  it('identifies grid units finer than one day', () => {
    expect(isTimeUnitFinerThanDay('second')).toBe(true)
    expect(isTimeUnitFinerThanDay('minute')).toBe(true)
    expect(isTimeUnitFinerThanDay('hour')).toBe(true)
    expect(isTimeUnitFinerThanDay('day')).toBe(false)
    expect(isTimeUnitFinerThanDay('week')).toBe(false)
    expect(isTimeUnitFinerThanDay('month')).toBe(false)
  })

  it('returns UTC calendar days and marks Saturday and Sunday as weekends', () => {
    const min = Date.UTC(2026, 7, 7, 12)
    const max = Date.UTC(2026, 7, 11, 12)
    const spans = getUtcDaySpans(min, max)

    expect(spans).toHaveLength(5)
    expect(spans.map(span => new Date(span.start).getUTCDay())).toEqual([5, 6, 0, 1, 2])
    expect(spans.filter(span => span.isWeekend).map(span => new Date(span.start).getUTCDay())).toEqual([6, 0])
    for (const span of spans) {
      const start = new Date(span.start)
      const end = new Date(span.end)
      expect([start.getUTCHours(), start.getUTCMinutes(), start.getUTCSeconds(), start.getUTCMilliseconds()]).toEqual([0, 0, 0, 0])
      expect([end.getUTCHours(), end.getUTCMinutes(), end.getUTCSeconds(), end.getUTCMilliseconds()]).toEqual([0, 0, 0, 0])
    }
  })

  it('aligns sub-day chart ranges to UTC grid boundaries', () => {
    const range = {
      min: Date.UTC(2026, 7, 7, 10, 7, 42, 250),
      max: Date.UTC(2026, 7, 7, 11, 52, 17, 750),
    }

    const hourly = alignTimeRangeToGrid(range, 'hour')
    expect(hourly.min).toBe(Date.UTC(2026, 7, 7, 10))
    expect(hourly.max).toBe(Date.UTC(2026, 7, 7, 12))

    const fiveMinutes = alignTimeRangeToGrid(range, 'minute', 5)
    expect(fiveMinutes.min).toBe(Date.UTC(2026, 7, 7, 10, 5))
    expect(fiveMinutes.max).toBe(Date.UTC(2026, 7, 7, 11, 55))
  })

  it('anchors multi-day sub-day grids to UTC midnight', () => {
    const aligned = alignTimeRangeToGrid({
      min: Date.UTC(2026, 7, 7, 6, 17),
      max: Date.UTC(2026, 7, 9, 11, 52),
    }, 'hour')

    expect(aligned.min).toBe(Date.UTC(2026, 7, 7))
    expect(aligned.max).toBe(Date.UTC(2026, 7, 9, 12))
  })

  it('returns no spans for an invalid or empty range', () => {
    expect(getUtcDaySpans(Number.NaN, 1)).toEqual([])
    expect(getUtcDaySpans(1, 1)).toEqual([])
    expect(getUtcDaySpans(2, 1)).toEqual([])
  })
})
