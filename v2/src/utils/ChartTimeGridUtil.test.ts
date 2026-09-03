import { describe, expect, it } from 'vitest'
import { alignTimeRangeToGrid, getAdapterDaySpans, isTimeUnitFinerThanDay, type ChartCalendarAdapter } from './ChartTimeGridUtil'

const localAdapter: ChartCalendarAdapter = {
  startOf(timestamp) {
    const date = new Date(timestamp)
    date.setHours(0, 0, 0, 0)
    return date
  },
  add(timestamp, amount) {
    const date = new Date(timestamp)
    date.setDate(date.getDate() + amount)
    return date
  },
  format(timestamp, format) {
    if (format !== 'i') throw new Error(`Unexpected format: ${format}`)
    return String(((new Date(timestamp).getDay() + 6) % 7) + 1)
  },
}

describe('ChartTimeGridUtil', () => {
  it('identifies grid units finer than one day', () => {
    expect(isTimeUnitFinerThanDay('second')).toBe(true)
    expect(isTimeUnitFinerThanDay('minute')).toBe(true)
    expect(isTimeUnitFinerThanDay('hour')).toBe(true)
    expect(isTimeUnitFinerThanDay('day')).toBe(false)
    expect(isTimeUnitFinerThanDay('week')).toBe(false)
    expect(isTimeUnitFinerThanDay('month')).toBe(false)
  })

  it('returns local calendar days and marks Saturday and Sunday as weekends', () => {
    const min = new Date(2026, 7, 7, 12).getTime()
    const max = new Date(2026, 7, 11, 12).getTime()
    const spans = getAdapterDaySpans(min, max, localAdapter)

    expect(spans).toHaveLength(5)
    expect(spans.map(span => new Date(span.start).getDay())).toEqual([5, 6, 0, 1, 2])
    expect(spans.filter(span => span.isWeekend).map(span => new Date(span.start).getDay())).toEqual([6, 0])
    for (const span of spans) {
      const start = new Date(span.start)
      const end = new Date(span.end)
      expect([start.getHours(), start.getMinutes(), start.getSeconds(), start.getMilliseconds()]).toEqual([0, 0, 0, 0])
      expect([end.getHours(), end.getMinutes(), end.getSeconds(), end.getMilliseconds()]).toEqual([0, 0, 0, 0])
    }
  })

  it('aligns sub-day chart ranges to local grid boundaries', () => {
    const range = {
      min: new Date(2026, 7, 7, 10, 7, 42, 250).getTime(),
      max: new Date(2026, 7, 7, 11, 52, 17, 750).getTime(),
    }

    const hourly = alignTimeRangeToGrid(range, 'hour')
    expect(hourly.min).toBe(new Date(2026, 7, 7, 10).getTime())
    expect(hourly.max).toBe(new Date(2026, 7, 7, 12).getTime())

    const fiveMinutes = alignTimeRangeToGrid(range, 'minute', 5)
    expect(fiveMinutes.min).toBe(new Date(2026, 7, 7, 10, 5).getTime())
    expect(fiveMinutes.max).toBe(new Date(2026, 7, 7, 11, 55).getTime())
  })

  it('anchors multi-day sub-day grids to local midnight', () => {
    const aligned = alignTimeRangeToGrid({
      min: new Date(2026, 7, 7, 6, 17).getTime(),
      max: new Date(2026, 7, 9, 11, 52).getTime(),
    }, 'hour')

    expect(aligned.min).toBe(new Date(2026, 7, 7).getTime())
    expect(aligned.max).toBe(new Date(2026, 7, 9, 12).getTime())
  })

  it('returns no spans for an invalid or empty range', () => {
    expect(getAdapterDaySpans(Number.NaN, 1, localAdapter)).toEqual([])
    expect(getAdapterDaySpans(1, 1, localAdapter)).toEqual([])
    expect(getAdapterDaySpans(2, 1, localAdapter)).toEqual([])
  })

  it('uses adapter day boundaries instead of the runtime timezone', () => {
    const offsetHours = 9
    const offsetMilliseconds = offsetHours * 60 * 60 * 1000
    const offsetAdapter: ChartCalendarAdapter = {
      startOf(timestamp) {
        const shifted = new Date(timestamp + offsetMilliseconds)
        shifted.setUTCHours(0, 0, 0, 0)
        return shifted.getTime() - offsetMilliseconds
      },
      add(timestamp, amount) {
        return timestamp + amount * 24 * 60 * 60 * 1000
      },
      format() {
        return '6'
      },
    }
    const min = Date.UTC(2026, 7, 8, 6)
    const max = Date.UTC(2026, 7, 9, 6)

    const spans = getAdapterDaySpans(min, max, offsetAdapter)

    expect(spans[0]?.start).toBe(Date.UTC(2026, 7, 7, 15))
    expect(spans[0]?.isWeekend).toBe(true)
  })
})
