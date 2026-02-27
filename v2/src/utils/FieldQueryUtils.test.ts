import { describe, it, expect } from 'vitest'
import {
  createFieldQuery,
  hasQueryOrExpression,
  isFilterActive,
  isFilterDisabled,
  countActiveFilters,
  clearFilterFields,
  hasExtendedFieldsConfig,
  addValueToArrayFilter,
} from './FieldQueryUtils'
import type { FieldQuery } from '@/models/types'

describe('FieldQueryUtils', () => {
  describe('createFieldQuery', () => {
    it('should create a default field query', () => {
      const fq = createFieldQuery()
      expect(fq.query).toBe('')
      expect(fq.isRegex).toBe(false)
      expect(fq.isNegate).toBe(false)
      expect(fq.isArray).toBe(false)
      expect(fq.isPattern).toBe(false)
      expect(fq.isDisabled).toBe(false)
      expect(fq.patternFields).toEqual([])
      expect(fq.patternFilter).toBe(false)
    })
  })

  describe('hasQueryOrExpression', () => {
    it('should return false for undefined', () => {
      expect(hasQueryOrExpression(undefined)).toBe(false)
    })

    it('should return false for empty query', () => {
      const fq = createFieldQuery()
      expect(hasQueryOrExpression(fq)).toBe(false)
    })

    it('should return true for non-empty query', () => {
      const fq: FieldQuery = { ...createFieldQuery(), query: 'test' }
      expect(hasQueryOrExpression(fq)).toBe(true)
    })

    it('should return true for JS expression', () => {
      const fq: FieldQuery = { ...createFieldQuery(), jsExpression: '$ > 10' }
      expect(hasQueryOrExpression(fq)).toBe(true)
    })

    it('should return false for jsExpression "true" (no filter)', () => {
      const fq: FieldQuery = { ...createFieldQuery(), jsExpression: 'true' }
      expect(hasQueryOrExpression(fq)).toBe(false)
    })
  })

  describe('isFilterActive', () => {
    it('should return false for disabled filter', () => {
      const fq: FieldQuery = { ...createFieldQuery(), query: 'test', isDisabled: true }
      expect(isFilterActive(fq)).toBe(false)
    })

    it('should return true for enabled filter with query', () => {
      const fq: FieldQuery = { ...createFieldQuery(), query: 'test', isDisabled: false }
      expect(isFilterActive(fq)).toBe(true)
    })
  })

  describe('isFilterDisabled', () => {
    it('should return true for disabled filter with query', () => {
      const fq: FieldQuery = { ...createFieldQuery(), query: 'test', isDisabled: true }
      expect(isFilterDisabled(fq)).toBe(true)
    })

    it('should return false for enabled filter', () => {
      const fq: FieldQuery = { ...createFieldQuery(), query: 'test', isDisabled: false }
      expect(isFilterDisabled(fq)).toBe(false)
    })
  })

  describe('countActiveFilters', () => {
    it('should count active filters', () => {
      const queries: Record<string, FieldQuery> = {
        field1: { ...createFieldQuery(), query: 'a' },
        field2: { ...createFieldQuery(), query: 'b', isDisabled: true },
        field3: { ...createFieldQuery(), query: 'c' },
        field4: createFieldQuery(),
      }
      expect(countActiveFilters(queries)).toBe(2)
    })

    it('should return 0 for empty object', () => {
      expect(countActiveFilters({})).toBe(0)
    })
  })

  describe('clearFilterFields', () => {
    it('should clear filter fields while preserving extended fields config', () => {
      const fq: FieldQuery = {
        query: 'test',
        isRegex: true,
        isNegate: true,
        isArray: true,
        isPattern: true,
        isDisabled: true,
        patternFields: ['a', 'b'],
        patternExtract: 'pattern',
        extendedFields: '$.name',
        jsExpression: '$ > 10',
      }
      
      const cleared = clearFilterFields(fq)
      
      expect(cleared.query).toBe('')
      expect(cleared.isRegex).toBe(false)
      expect(cleared.isNegate).toBe(false)
      expect(cleared.isArray).toBe(false)
      expect(cleared.isPattern).toBe(false)
      expect(cleared.isDisabled).toBe(false)
      expect(cleared.jsExpression).toBeUndefined()
      expect(cleared.patternExtract).toBe('pattern')
      expect(cleared.extendedFields).toBe('$.name')
    })
  })

  describe('hasExtendedFieldsConfig', () => {
    it('should return true if patternExtract is set', () => {
      const fq: FieldQuery = { ...createFieldQuery(), patternExtract: 'pattern' }
      expect(hasExtendedFieldsConfig(fq)).toBe(true)
    })

    it('should return true if extendedFields is set', () => {
      const fq: FieldQuery = { ...createFieldQuery(), extendedFields: '$.name' }
      expect(hasExtendedFieldsConfig(fq)).toBe(true)
    })

    it('should return false if neither is set', () => {
      const fq = createFieldQuery()
      expect(hasExtendedFieldsConfig(fq)).toBe(false)
    })
  })

  describe('addValueToArrayFilter', () => {
    it('should create new array filter when no existing filter', () => {
      const result = addValueToArrayFilter(undefined, 'value', false)
      expect(result.query).toBe('value')
      expect(result.isArray).toBe(true)
      expect(result.isNegate).toBe(false)
    })

    it('should create negate array filter', () => {
      const result = addValueToArrayFilter(undefined, 'value', true)
      expect(result.query).toBe('value')
      expect(result.isNegate).toBe(true)
    })

    it('should add value to existing array filter', () => {
      const existing: FieldQuery = {
        ...createFieldQuery(),
        query: 'a,b',
        isArray: true,
      }
      const result = addValueToArrayFilter(existing, 'c', false)
      expect(result.query).toBe('a,b,c')
    })

    it('should not add duplicate value', () => {
      const existing: FieldQuery = {
        ...createFieldQuery(),
        query: 'a,b',
        isArray: true,
      }
      const result = addValueToArrayFilter(existing, 'b', false)
      expect(result.query).toBe('a,b')
    })

    it('should override when negate mode changes', () => {
      const existing: FieldQuery = {
        ...createFieldQuery(),
        query: 'a,b',
        isArray: true,
        isNegate: false,
      }
      const result = addValueToArrayFilter(existing, 'c', true)
      expect(result.query).toBe('c')
      expect(result.isNegate).toBe(true)
    })
  })
})
