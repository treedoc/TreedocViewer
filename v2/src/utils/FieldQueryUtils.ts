/**
 * FieldQueryUtils - Utilities for working with Column filter state (FieldQuery)
 */

import type { Column, FieldQuery } from '@/models/types'
import { createDefaultColumn } from '@/models/types'

/**
 * Create a Column with default filter/query state (no filter active).
 * @deprecated Use createDefaultColumn() from types.ts instead.
 */
export function createFieldQuery(field = ''): FieldQuery {
  return createDefaultColumn(field)
}

/**
 * Check if a Column has an active filter (query or JS expression).
 * Excludes 'true' JS expression which means "no filter".
 */
export function hasQueryOrExpression(fq: Column | undefined): boolean {
  if (!fq) return false
  const hasQuery = (fq.query?.length ?? 0) > 0
  const hasJsExpression = !!fq.jsExpression && fq.jsExpression !== 'true'
  return hasQuery || hasJsExpression
}

/**
 * Check if a column has an active (enabled) filter.
 */
export function isFilterActive(fq: Column | undefined): boolean {
  return hasQueryOrExpression(fq) && !fq?.isDisabled
}

/**
 * Check if a column has a disabled filter.
 */
export function isFilterDisabled(fq: Column | undefined): boolean {
  return hasQueryOrExpression(fq) && !!fq?.isDisabled
}

/**
 * Count active filters in a columns array or field queries map.
 */
export function countActiveFilters(fieldQueries: Record<string, Column>): number {
  return Object.values(fieldQueries).filter(isFilterActive).length
}

/**
 * Clear filter-related fields from a Column while preserving extended field configuration.
 */
export function clearFilterFields(col: Column): Column {
  return {
    ...col,
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
 * Check if a Column has extended fields configuration.
 */
export function hasExtendedFieldsConfig(col: Column): boolean {
  return !!(col.patternExtract || col.extendedFields)
}

/**
 * Add a value to an array filter on a Column, handling negate mode.
 */
export function addValueToArrayFilter(
  current: Column | undefined,
  value: string,
  isNegate: boolean
): Column {
  const baseQuery: Column = {
    field: current?.field ?? '',
    query: value,
    isRegex: false,
    isNegate: isNegate,
    isArray: true,
    isPattern: false,
    isDisabled: false,
    patternFields: [],
  }

  if (!current) {
    return baseQuery
  }

  // If existing filter has different negate mode, override it
  if (current.isArray && !!current.isNegate !== isNegate) {
    return { ...baseQuery, field: current.field }
  }

  // Add to existing array filter
  if (current.isArray && current.query) {
    const existingValues = current.query.split(',').map(v => v.trim())
    if (!existingValues.includes(value)) {
      existingValues.push(value)
      return {
        ...current,
        query: existingValues.join(','),
      }
    }
    return current
  }

  return { ...baseQuery, field: current.field }
}
