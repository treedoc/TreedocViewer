import { describe, it, expect } from 'vitest'
import { matchPathPattern, findMatchingPathRule, getPresetConfigForPath, type QueryPreset, type PathRule } from './types'

describe('matchPathPattern', () => {
  it('should match exact paths', () => {
    expect(matchPathPattern('/logs', '/logs')).toBe(true)
    expect(matchPathPattern('/logs/errors', '/logs/errors')).toBe(true)
    expect(matchPathPattern('/logs', '/orders')).toBe(false)
  })

  it('should match single segment wildcard (*)', () => {
    expect(matchPathPattern('/logs/error', '/logs/*')).toBe(true)
    expect(matchPathPattern('/logs/warning', '/logs/*')).toBe(true)
    expect(matchPathPattern('/logs/error/details', '/logs/*')).toBe(false)
    expect(matchPathPattern('/orders/123', '/logs/*')).toBe(false)
  })

  it('should match multiple segment wildcard (**)', () => {
    expect(matchPathPattern('/logs/error', '/logs/**')).toBe(true)
    expect(matchPathPattern('/logs/error/details', '/logs/**')).toBe(true)
    expect(matchPathPattern('/logs/a/b/c/d', '/logs/**')).toBe(true)
    expect(matchPathPattern('/orders/123', '/logs/**')).toBe(false)
  })

  it('should match single character wildcard (?)', () => {
    expect(matchPathPattern('/logs/v1', '/logs/v?')).toBe(true)
    expect(matchPathPattern('/logs/v2', '/logs/v?')).toBe(true)
    expect(matchPathPattern('/logs/v10', '/logs/v?')).toBe(false)
  })

  it('should handle complex patterns', () => {
    expect(matchPathPattern('/api/v1/users/123', '/api/*/users/*')).toBe(true)
    expect(matchPathPattern('/api/v2/orders/456', '/api/*/orders/*')).toBe(true)
    expect(matchPathPattern('/api/v1/users/123/profile', '/api/*/users/**')).toBe(true)
  })

  it('should escape special regex characters', () => {
    expect(matchPathPattern('/path.with.dots', '/path.with.dots')).toBe(true)
    expect(matchPathPattern('/path[with]brackets', '/path[with]brackets')).toBe(true)
  })
})

describe('findMatchingPathRule', () => {
  const rules: PathRule[] = [
    { pathPattern: '/logs/**', columns: [{ field: 'log' }] },
    { pathPattern: '/orders/*', columns: [{ field: 'order' }] },
    { pathPattern: '/api/*/users/**', columns: [{ field: 'user' }] },
  ]

  const preset: QueryPreset = {
    name: 'test',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    pathRules: rules,
  }

  it('should find matching rule', () => {
    const rule = findMatchingPathRule(preset, '/logs/error')
    expect(rule?.pathPattern).toBe('/logs/**')
    expect(rule?.columns[0].field).toBe('log')
  })

  it('should return first matching rule when multiple match', () => {
    const overlappingPreset: QueryPreset = {
      ...preset,
      pathRules: [
        { pathPattern: '/logs/*', columns: [{ field: 'first' }] },
        { pathPattern: '/logs/**', columns: [{ field: 'second' }] },
      ],
    }
    const rule = findMatchingPathRule(overlappingPreset, '/logs/error')
    expect(rule?.columns[0].field).toBe('first')
  })

  it('should return undefined when no rule matches', () => {
    const rule = findMatchingPathRule(preset, '/unknown/path')
    expect(rule).toBeUndefined()
  })

  it('should return undefined when no rules defined', () => {
    const noRulesPreset: QueryPreset = {
      name: 'test',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      pathRules: [],
    }
    const rule = findMatchingPathRule(noRulesPreset, '/logs/error')
    expect(rule).toBeUndefined()
  })
})

describe('getPresetConfigForPath', () => {
  const preset: QueryPreset = {
    name: 'test',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    pathRules: [
      { pathPattern: '/logs/**', columns: [{ field: 'log' }], jsQuery: '$.logs', expandLevel: 3 },
      { pathPattern: '**', columns: [{ field: 'default' }], jsQuery: '$', expandLevel: 2 },
    ],
  }

  it('should return matching rule config when path matches', () => {
    const config = getPresetConfigForPath(preset, '/logs/error')
    expect(config?.columns[0].field).toBe('log')
    expect(config?.jsQuery).toBe('$.logs')
    expect(config?.expandLevel).toBe(3)
  })

  it('should return catch-all rule config when specific path does not match', () => {
    const config = getPresetConfigForPath(preset, '/orders/123')
    expect(config?.columns[0].field).toBe('default')
    expect(config?.jsQuery).toBe('$')
    expect(config?.expandLevel).toBe(2)
  })
  
  it('should return null when no path matches and no catch-all', () => {
    const noMatchPreset: QueryPreset = {
      name: 'test',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      pathRules: [
        { pathPattern: '/logs/**', columns: [{ field: 'log' }] },
      ],
    }
    const config = getPresetConfigForPath(noMatchPreset, '/orders/123')
    expect(config).toBeNull()
  })
})
