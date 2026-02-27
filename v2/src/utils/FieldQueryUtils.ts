/**
 * FieldQueryUtils - Utilities for working with FieldQuery objects
 */

import type { FieldQuery } from '@/models/types'

/**
 * Create an empty FieldQuery with default values
 */
export function createFieldQuery(): FieldQuery {
  return {
    query: '',
    isRegex: false,
    isNegate: false,
    isArray: false,
    isPattern: false,
    isDisabled: false,
    patternFields: [],
    patternExtract: undefined,
    patternFilter: false,
  }
}

/**
 * Check if a FieldQuery has an active filter (query or JS expression)
 * Excludes 'true' JS expression which means "no filter"
 */
export function hasQueryOrExpression(fq: FieldQuery | undefined): boolean {
  if (!fq) return false
  const hasQuery = (fq.query?.length ?? 0) > 0
  const hasJsExpression = !!fq.jsExpression && fq.jsExpression !== 'true'
  return hasQuery || hasJsExpression
}

/**
 * Check if a field has an active (enabled) filter
 */
export function isFilterActive(fq: FieldQuery | undefined): boolean {
  return hasQueryOrExpression(fq) && !fq?.isDisabled
}

/**
 * Check if a field has a disabled filter
 */
export function isFilterDisabled(fq: FieldQuery | undefined): boolean {
  return hasQueryOrExpression(fq) && !!fq?.isDisabled
}

/**
 * Count active filters in a field queries map
 */
export function countActiveFilters(fieldQueries: Record<string, FieldQuery>): number {
  return Object.values(fieldQueries).filter(isFilterActive).length
}

/**
 * Clear filter-related fields while preserving extended field configuration
 */
export function clearFilterFields(fq: FieldQuery): FieldQuery {
  return {
    ...fq,
    query: '',
    isRegex: false,
    isNegate: false,
    isArray: false,
    isPattern: false,
    isDisabled: false,
    jsExpression: undefined,
  }
}

/**
 * Check if a FieldQuery has extended fields configuration
 */
export function hasExtendedFieldsConfig(fq: FieldQuery): boolean {
  return !!(fq.patternExtract || fq.extendedFields)
}

/**
 * Add a value to an array filter, handling negate mode
 */
export function addValueToArrayFilter(
  currentFq: FieldQuery | undefined,
  value: string,
  isNegate: boolean
): FieldQuery {
  const baseQuery: FieldQuery = {
    query: value,
    isRegex: false,
    isNegate: isNegate,
    isArray: true,
    isPattern: false,
    isDisabled: false,
    patternFields: [],
  }

  if (!currentFq) {
    return baseQuery
  }

  // If existing filter has different negate mode, override it
  if (currentFq.isArray && currentFq.isNegate !== isNegate) {
    return baseQuery
  }

  // Add to existing array filter
  if (currentFq.isArray && currentFq.query) {
    const existingValues = currentFq.query.split(',').map(v => v.trim())
    if (!existingValues.includes(value)) {
      existingValues.push(value)
      return {
        ...currentFq,
        query: existingValues.join(','),
      }
    }
    return currentFq
  }

  return baseQuery
}
