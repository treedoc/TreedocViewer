import { describe, expect, it } from 'vitest'
import { parsePwaLaunchConfig } from './PwaLaunch'

describe('parsePwaLaunchConfig', () => {
  it('reads viewer configuration from query parameters', () => {
    const option = JSON.stringify({ maxPane: 'table' })
    const preset = JSON.stringify({ name: 'Chart', pathRules: [] })
    const url = new URL('https://www.treedoc.org/')
    url.searchParams.set('option', option)
    url.searchParams.set('preset', preset)
    url.searchParams.set('initialPath', '/rows')
    url.searchParams.set('title', 'Revenue report')

    expect(parsePwaLaunchConfig(url.toString())).toEqual({
      option,
      preset,
      initialPath: '/rows',
      title: 'Revenue report',
    })
  })

  it('supports hash-based parameters', () => {
    expect(parsePwaLaunchConfig('https://www.treedoc.org/#/?option=%7BmaxPane%3Atable%7D')).toEqual({
      option: '{maxPane:table}',
      preset: undefined,
      initialPath: undefined,
      title: undefined,
    })
  })

  it('ignores launches without viewer configuration', () => {
    expect(parsePwaLaunchConfig('https://www.treedoc.org/#/')).toBeNull()
    expect(parsePwaLaunchConfig('not a url')).toBeNull()
  })
})
