import { describe, it, expect, beforeEach } from 'vitest'
import { 
  TableDataProcessor, 
  getCellObject, 
  defaultValueToString,
  extractPatternFields,
  type TableRow,
  type ProcessingConfig
} from './TableDataProcessor'
import type { FieldQuery } from '@/models/types'

const createFieldQuery = (overrides: Partial<FieldQuery> = {}): FieldQuery => ({
  query: '',
  isRegex: false,
  isNegate: false,
  isArray: false,
  isPattern: false,
  isDisabled: false,
  patternFields: [],
  ...overrides
})

describe('getCellObject', () => {
  it('should return null for primitive values', () => {
    expect(getCellObject('hello')).toBeNull()
    expect(getCellObject(123)).toBeNull()
    expect(getCellObject(true)).toBeNull()
    expect(getCellObject(null)).toBeNull()
    expect(getCellObject(undefined)).toBeNull()
  })
  
  it('should return plain objects as-is', () => {
    const obj = { name: 'test', value: 42 }
    expect(getCellObject(obj)).toBe(obj)
  })
  
  it('should parse JSON strings', () => {
    const result = getCellObject('{"name": "test", "value": 42}')
    expect(result).toEqual({ name: 'test', value: 42 })
  })
  
  it('should parse JSON array strings', () => {
    const result = getCellObject('[1, 2, 3]')
    expect(result).toEqual([1, 2, 3])
  })
  
  it('should return null for non-JSON strings', () => {
    expect(getCellObject('hello world')).toBeNull()
    expect(getCellObject('not json')).toBeNull()
  })
  
  it('should return null for invalid JSON strings', () => {
    expect(getCellObject('{invalid json}')).toBeNull()
    expect(getCellObject('[1, 2,')).toBeNull()
  })
  
  it('should handle TDNode-like objects', () => {
    const mockTDNode = {
      type: 0,
      children: [],
      toObject: (deep: boolean) => ({ converted: true })
    }
    expect(getCellObject(mockTDNode)).toEqual({ converted: true })
  })
})

describe('defaultValueToString', () => {
  it('should convert primitives to strings', () => {
    expect(defaultValueToString('hello')).toBe('hello')
    expect(defaultValueToString(123)).toBe('123')
    expect(defaultValueToString(true)).toBe('true')
  })
  
  it('should return empty string for null/undefined', () => {
    expect(defaultValueToString(null)).toBe('')
    expect(defaultValueToString(undefined)).toBe('')
  })
  
  it('should stringify objects', () => {
    expect(defaultValueToString({ a: 1 })).toBe('{"a":1}')
    expect(defaultValueToString([1, 2, 3])).toBe('[1,2,3]')
  })
})

describe('extractPatternFields', () => {
  it('should extract ${name} style placeholders', () => {
    const fields = extractPatternFields('User ${userId} logged in at ${timestamp}')
    expect(fields).toContain('userId')
    expect(fields).toContain('timestamp')
  })
  
  it('should extract $name style placeholders', () => {
    const fields = extractPatternFields('Order:$orderId shipped')
    expect(fields).toContain('orderId')
  })
  
  it('should extract mixed placeholders', () => {
    const fields = extractPatternFields('$name says ${message}')
    expect(fields).toContain('name')
    expect(fields).toContain('message')
  })
  
  it('should not duplicate placeholders', () => {
    const fields = extractPatternFields('$name and $name again')
    expect(fields.filter(f => f === 'name')).toHaveLength(1)
  })
  
  it('should return empty array for pattern without placeholders', () => {
    expect(extractPatternFields('hello world')).toEqual([])
    expect(extractPatternFields('*error*')).toEqual([])
  })
})

describe('TableDataProcessor', () => {
  let processor: TableDataProcessor
  
  beforeEach(() => {
    processor = new TableDataProcessor()
  })
  
  describe('processData', () => {
    it('should return data unchanged when no field queries', () => {
      const data: TableRow[] = [
        { name: 'Alice', age: 30 },
        { name: 'Bob', age: 25 }
      ]
      
      const config: ProcessingConfig = {
        fieldQueries: {},
        columnOrder: ['name', 'age']
      }
      
      const result = processor.processData(data, config)
      expect(result.data).toHaveLength(2)
      expect(result.derivedColumns).toHaveLength(0)
    })
    
    it('should apply simple query filter', () => {
      const data: TableRow[] = [
        { name: 'Alice', age: 30 },
        { name: 'Bob', age: 25 },
        { name: 'Charlie', age: 35 }
      ]
      
      const config: ProcessingConfig = {
        fieldQueries: {
          name: createFieldQuery({ query: 'ali' })
        },
        columnOrder: ['name', 'age']
      }
      
      const result = processor.processData(data, config)
      expect(result.data).toHaveLength(1)
      expect(result.data[0].name).toBe('Alice')
    })
    
    it('should apply negated query filter', () => {
      const data: TableRow[] = [
        { name: 'Alice', status: 'active' },
        { name: 'Bob', status: 'inactive' },
        { name: 'Charlie', status: 'active' }
      ]
      
      const config: ProcessingConfig = {
        fieldQueries: {
          status: createFieldQuery({ query: 'inactive', isNegate: true })
        },
        columnOrder: ['name', 'status']
      }
      
      const result = processor.processData(data, config)
      expect(result.data).toHaveLength(2)
      expect(result.data.every(r => r.status !== 'inactive')).toBe(true)
    })
    
    it('should skip disabled queries', () => {
      const data: TableRow[] = [
        { name: 'Alice' },
        { name: 'Bob' }
      ]
      
      const config: ProcessingConfig = {
        fieldQueries: {
          name: createFieldQuery({ query: 'alice', isDisabled: true })
        },
        columnOrder: ['name']
      }
      
      const result = processor.processData(data, config)
      expect(result.data).toHaveLength(2)
    })
  })
  
  describe('applyExtendedFields', () => {
    it('should extract fields from JSON objects', () => {
      const data: TableRow[] = [
        { payload: { firstName: 'John', lastName: 'Doe' } },
        { payload: { firstName: 'Jane', lastName: 'Smith' } }
      ]
      
      const derivedColumnsSet = new Set<string>()
      const derivedColumns: string[] = []
      const derivedColumnSources = new Map<string, string>()
      
      const result = processor.applyExtendedFields(
        data, 'payload', 'first: $.firstName, last: $.lastName',
        derivedColumnsSet, derivedColumns, derivedColumnSources
      )
      
      expect(result[0].first).toBe('John')
      expect(result[0].last).toBe('Doe')
      expect(result[1].first).toBe('Jane')
      expect(result[1].last).toBe('Smith')
      expect(derivedColumns).toContain('first')
      expect(derivedColumns).toContain('last')
      expect(derivedColumnSources.get('first')).toBe('payload')
    })
    
    it('should extract fields from JSON strings', () => {
      const data: TableRow[] = [
        { json: '{"name": "test", "value": 42}' }
      ]
      
      const derivedColumnsSet = new Set<string>()
      const derivedColumns: string[] = []
      const derivedColumnSources = new Map<string, string>()
      
      const result = processor.applyExtendedFields(
        data, 'json', 'n: $.name, v: $.value',
        derivedColumnsSet, derivedColumns, derivedColumnSources
      )
      
      expect(result[0].n).toBe('test')
      expect(result[0].v).toBe(42)
    })
    
    it('should handle rows without the field', () => {
      const data: TableRow[] = [
        { payload: { name: 'test' } },
        { other: 'field' }
      ]
      
      const derivedColumnsSet = new Set<string>()
      const derivedColumns: string[] = []
      const derivedColumnSources = new Map<string, string>()
      
      const result = processor.applyExtendedFields(
        data, 'payload', 'n: $.name',
        derivedColumnsSet, derivedColumns, derivedColumnSources
      )
      
      expect(result[0].n).toBe('test')
      expect(result[1].n).toBeUndefined()
    })
    
    it('should handle invalid expressions gracefully', () => {
      const data: TableRow[] = [
        { payload: { name: 'test' } }
      ]
      
      const derivedColumnsSet = new Set<string>()
      const derivedColumns: string[] = []
      const derivedColumnSources = new Map<string, string>()
      
      const result = processor.applyExtendedFields(
        data, 'payload', 'invalid expression without colon',
        derivedColumnsSet, derivedColumns, derivedColumnSources
      )
      
      expect(result).toHaveLength(1)
      expect(derivedColumns).toHaveLength(0)
    })
  })
  
  describe('applyPatternExtract', () => {
    it('should extract fields from pattern', () => {
      const data: TableRow[] = [
        { message: 'Order:12345 shipped' },
        { message: 'Order:67890 delivered' }
      ]
      
      const derivedColumnsSet = new Set<string>()
      const derivedColumns: string[] = []
      const derivedColumnSources = new Map<string, string>()
      
      const result = processor.applyPatternExtract(
        data, 'message', 'Order:$orderId $status',
        false, derivedColumnsSet, derivedColumns, derivedColumnSources
      )
      
      expect(result[0].orderId).toBe('12345')
      expect(result[0].status).toBe('shipped')
      expect(result[1].orderId).toBe('67890')
      expect(result[1].status).toBe('delivered')
      expect(derivedColumns).toContain('orderId')
      expect(derivedColumns).toContain('status')
    })
    
    it('should filter non-matching rows when patternFilter is true', () => {
      const data: TableRow[] = [
        { message: 'Order:12345 shipped' },
        { message: 'Some other message' },
        { message: 'Order:67890 delivered' }
      ]
      
      const derivedColumnsSet = new Set<string>()
      const derivedColumns: string[] = []
      const derivedColumnSources = new Map<string, string>()
      
      const result = processor.applyPatternExtract(
        data, 'message', 'Order:$orderId $status',
        true, derivedColumnsSet, derivedColumns, derivedColumnSources
      )
      
      expect(result).toHaveLength(2)
      expect(result.every(r => r.orderId !== undefined)).toBe(true)
    })
    
    it('should keep non-matching rows when patternFilter is false', () => {
      const data: TableRow[] = [
        { message: 'Order:12345 shipped' },
        { message: 'Some other message' }
      ]
      
      const derivedColumnsSet = new Set<string>()
      const derivedColumns: string[] = []
      const derivedColumnSources = new Map<string, string>()
      
      const result = processor.applyPatternExtract(
        data, 'message', 'Order:$orderId $status',
        false, derivedColumnsSet, derivedColumns, derivedColumnSources
      )
      
      expect(result).toHaveLength(2)
    })
    
    it('should try multiple patterns until one matches', () => {
      const data: TableRow[] = [
        { log: 'ERROR: Something failed' },
        { log: 'WARN: Something might be wrong' },
        { log: 'INFO: All good' }
      ]
      
      const derivedColumnsSet = new Set<string>()
      const derivedColumns: string[] = []
      const derivedColumnSources = new Map<string, string>()
      
      const multilinePattern = 'ERROR: $errMsg\nWARN: $warnMsg\nINFO: $infoMsg'
      const result = processor.applyPatternExtract(
        data, 'log', multilinePattern,
        false, derivedColumnsSet, derivedColumns, derivedColumnSources
      )
      
      expect(result[0].errMsg).toBe('Something failed')
      expect(result[1].warnMsg).toBe('Something might be wrong')
      expect(result[2].infoMsg).toBe('All good')
    })
  })
  
  describe('applyJsQuery', () => {
    it('should filter data using JS expression', () => {
      const data: TableRow[] = [
        { name: 'Alice', age: 30 },
        { name: 'Bob', age: 25 },
        { name: 'Charlie', age: 35 }
      ]
      
      const result = processor.applyJsQuery(data, '$.age >= 30')
      expect(result).toHaveLength(2)
      expect(result[0].name).toBe('Alice')
      expect(result[1].name).toBe('Charlie')
    })
    
    it('should return all data for invalid query', () => {
      const data: TableRow[] = [
        { name: 'Alice' }
      ]
      
      const result = processor.applyJsQuery(data, 'invalid syntax {{{{')
      expect(result).toHaveLength(1)
    })
    
    it('should handle errors in individual rows', () => {
      const data: TableRow[] = [
        { name: 'Alice', nested: { value: 1 } },
        { name: 'Bob' } // no nested
      ]
      
      const result = processor.applyJsQuery(data, '$.nested.value > 0')
      // Bob's row should return true (default) due to error
      expect(result).toHaveLength(2)
    })
  })
  
  describe('recursive field processing', () => {
    it('should handle recursive derived fields', () => {
      const data: TableRow[] = [
        { payload: '{"inner": {"name": "test", "value": 42}}' }
      ]
      
      const config: ProcessingConfig = {
        fieldQueries: {
          payload: createFieldQuery({ extendedFields: 'inner: $.inner' }),
          inner: createFieldQuery({ extendedFields: 'n: $.name, v: $.value' })
        },
        columnOrder: ['payload']
      }
      
      const result = processor.processData(data, config)
      
      expect(result.derivedColumns).toContain('inner')
      expect(result.derivedColumns).toContain('n')
      expect(result.derivedColumns).toContain('v')
      expect(result.data[0].n).toBe('test')
      expect(result.data[0].v).toBe(42)
    })
  })
})
