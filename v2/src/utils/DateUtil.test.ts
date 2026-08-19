import { describe, expect, it } from 'vitest'
import { detectDateFormat, formatDateLikeOriginal, formatLocalTooltipDateTime, tryParseDate } from './DateUtil'

describe('DateUtil date format metadata', () => {
  it('detects and formats slash-separated timestamps', () => {
    const format = detectDateFormat('2014/10/02 10:20:37')
    const date = tryParseDate('2014/10/02 10:20:37')

    expect(format?.name).toBe('Slash date with time')
    expect(format?.sortable).toBe(true)
    expect(date).not.toBeNull()
    expect(formatDateLikeOriginal(date!, format)).toBe('2014/10/02 10:20:37')
  })

  it('preserves ISO shape without milliseconds', () => {
    const format = detectDateFormat('2026-03-23T18:51:07Z')
    const date = tryParseDate('2026-03-23T18:51:07Z')

    expect(format?.name).toBe('ISO 8601')
    expect(date).not.toBeNull()
    expect(formatDateLikeOriginal(date!, format)).toBe('2026-03-23T18:51:07Z')
  })

  it('recognizes an ISO timestamp with a space and timezone offset', () => {
    const timestamp = '2026-08-09 00:00:00+00:00'
    const format = detectDateFormat(timestamp)
    const date = tryParseDate(timestamp)

    expect(format?.name).toBe('ISO with space')
    expect(date?.toISOString()).toBe('2026-08-09T00:00:00.000Z')
    expect(formatDateLikeOriginal(date!, format)).toBe(timestamp)
  })

  it('formats a space-separated ISO timestamp in its original non-UTC offset', () => {
    const timestamp = '2026-08-09 02:30:00+02:30'
    const format = detectDateFormat(timestamp)
    const date = tryParseDate(timestamp)

    expect(date?.toISOString()).toBe('2026-08-09T00:00:00.000Z')
    expect(formatDateLikeOriginal(date!, format)).toBe(timestamp)
  })

  it('preserves the space separator for a UTC Z suffix', () => {
    const timestamp = '2026-08-09 00:00:00Z'
    const format = detectDateFormat(timestamp)
    const date = tryParseDate(timestamp)

    expect(formatDateLikeOriginal(date!, format)).toBe(timestamp)
  })

  it('preserves numeric timestamp units', () => {
    const format = detectDateFormat('1599461650')
    const date = tryParseDate('1599461650')

    expect(format?.kind).toBe('numeric-string')
    expect(format?.numericUnit).toBe('seconds')
    expect(date).not.toBeNull()
    expect(formatDateLikeOriginal(date!, format)).toBe('1599461650')
  })

  it('formats a timestamp as a localized time with timezone', () => {
    const result = formatLocalTooltipDateTime(Date.parse('2026-08-09T00:00:00Z'), 'en-US', 'UTC')

    expect(result).toContain('Aug 9, 2026')
    expect(result).toContain('12:00:00 AM')
    expect(result).toContain('UTC')
  })
})
