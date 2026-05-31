import { describe, expect, it } from 'vitest'
import { detectDateFormat, formatDateLikeOriginal, tryParseDate } from './DateUtil'

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

  it('preserves numeric timestamp units', () => {
    const format = detectDateFormat('1599461650')
    const date = tryParseDate('1599461650')

    expect(format?.kind).toBe('numeric-string')
    expect(format?.numericUnit).toBe('seconds')
    expect(date).not.toBeNull()
    expect(formatDateLikeOriginal(date!, format)).toBe('1599461650')
  })
})
