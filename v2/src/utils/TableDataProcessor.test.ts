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
  
  it('should handle TDNode SIMPLE type (type=2) correctly', () => {
    // TDNodeType.SIMPLE = 2 in treedoc library
    expect(defaultValueToString({ type: 2, key: 'test', value: 'hello' })).toBe('hello')
    expect(defaultValueToString({ type: 2, key: 'test', value: '' })).toBe('')
    expect(defaultValueToString({ type: 2, key: 'test', value: null })).toBe('')
    expect(defaultValueToString({ type: 2, key: 'test', value: 123 })).toBe('123')
  })
  
  it('should JSON stringify non-SIMPLE TDNode types', () => {
    // MAP type (0) should be JSON stringified, not treated as SIMPLE
    expect(defaultValueToString({ type: 0, key: 'test', value: 'hello' })).toBe('{"type":0,"key":"test","value":"hello"}')
    
    // ARRAY type (1) should be JSON stringified
    expect(defaultValueToString({ type: 1, key: 'test', children: [] })).toBe('{"type":1,"key":"test","children":[]}')
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
    
    it('should filter out empty string values when searching', () => {
      const data: TableRow[] = [
        { name: 'Alice', status: 'active' },
        { name: 'Bob', status: '' },
        { name: 'Charlie', status: 'active' }
      ]
      
      const config: ProcessingConfig = {
        fieldQueries: {
          status: createFieldQuery({ query: 'active' })
        },
        columnOrder: ['name', 'status']
      }
      
      const result = processor.processData(data, config)
      expect(result.data).toHaveLength(2)
      expect(result.data.every(r => r.status === 'active')).toBe(true)
    })
    
    it('should filter out empty values when searching for Success (user scenario)', () => {
      // Exact user scenario: array of json with status column 'Success', 'fail' and empty values
      const data: TableRow[] = [
        { id: 1, status: 'Success' },
        { id: 2, status: 'fail' },
        { id: 3, status: '' },       // empty string
        { id: 4, status: null },     // null
        { id: 5 },                   // undefined (no status field)
        { id: 6, status: 'Success' }
      ]
      
      const config: ProcessingConfig = {
        fieldQueries: {
          status: createFieldQuery({ query: 'Success' })
        },
        columnOrder: ['id', 'status']
      }
      
      const result = processor.processData(data, config)
      
      // Should only show rows with 'Success' and rows with undefined status (field not present)
      // Empty string and null should be filtered out
      console.log('Result data:', result.data.map(r => ({ id: r.id, status: r.status })))
      
      // Rows 1, 5, 6 should remain (Success, undefined, Success)
      // Rows 2, 3, 4 should be filtered (fail, empty, null)
      expect(result.data).toHaveLength(3)
      expect(result.data.map(r => r.id)).toEqual([1, 5, 6])
    })
    
    it('should filter TDNode empty values when searching for Success', () => {
      // Test with TDNode-like objects (type 2 = SIMPLE)
      const data: TableRow[] = [
        { id: 1, status: { type: 2, key: 'status', value: 'Success' } },
        { id: 2, status: { type: 2, key: 'status', value: 'fail' } },
        { id: 3, status: { type: 2, key: 'status', value: '' } },
        { id: 4, status: { type: 2, key: 'status', value: null } },
        { id: 5, status: { type: 2, key: 'status' } },  // value property not present
        { id: 6, status: { type: 2, key: 'status', value: 'Success' } }
      ]
      
      const config: ProcessingConfig = {
        fieldQueries: {
          status: createFieldQuery({ query: 'Success' })
        },
        columnOrder: ['id', 'status']
      }
      
      const result = processor.processData(data, config)
      
      console.log('TDNode Result data:', result.data.map(r => ({ id: r.id, status: r.status })))
      
      // Only rows 1 and 6 should remain (Success)
      // Empty, null, and 'value property not present' should be filtered out
      expect(result.data).toHaveLength(2)
      expect(result.data.map(r => r.id)).toEqual([1, 6])
    })
    
    it('should filter out undefined values when filtering on derived/extended columns', () => {
      // Scenario: User has extended field from JSON path extraction
      // Some rows have the extended field value, some don't (extraction failed)
      const data: TableRow[] = [
        { id: 1, payload: '{"status": "Success"}' },
        { id: 2, payload: '{"status": "fail"}' },
        { id: 3, payload: '{"other": "data"}' },  // No status field
        { id: 4, payload: 'invalid json' },
        { id: 5, payload: '{"status": "Success"}' }
      ]
      
      // Simulate extended fields extraction: status: $.status
      const config: ProcessingConfig = {
        fieldQueries: {
          payload: createFieldQuery({ extendedFields: 'status: $.status' }),
          status: createFieldQuery({ query: 'Success' })
        },
        columnOrder: ['id', 'payload']
      }
      
      const result = processor.processData(data, config)
      
      console.log('Extended field filter result:', result.data.map(r => ({ id: r.id, status: r.status })))
      
      // Only rows 1 and 5 should remain (status = "Success")
      // Row 2 has status="fail" - filtered out
      // Rows 3 and 4 don't have status field (extraction failed) - should be filtered out
      expect(result.data).toHaveLength(2)
      expect(result.data.map(r => r.id)).toEqual([1, 5])
    })
    
    it('should filter correctly using applyQueryFilter directly', () => {
      const data: TableRow[] = [
        { name: 'Alice', status: 'active' },
        { name: 'Bob', status: '' },
        { name: 'Charlie', status: null },
        { name: 'Dave', status: 'inactive' }
      ]
      
      const fq = createFieldQuery({ query: 'active' })
      const result = processor.applyQueryFilter(data, 'status', fq)
      
      // Should only keep Alice (active match)
      // Bob (empty) and Charlie (null) don't contain 'active'
      // Dave (inactive) does contain 'active'
      expect(result).toHaveLength(2)
      expect(result[0].name).toBe('Alice')
      expect(result[1].name).toBe('Dave')  // 'inactive' contains 'active'
    })
    
    it('should filter TDNode-like values with empty/null content', () => {
      // TDNode-like structures (type 2 = SIMPLE in treedoc)
      const data: TableRow[] = [
        { name: 'Alice', status: { type: 2, key: 'status', value: 'active' } },
        { name: 'Bob', status: { type: 2, key: 'status', value: '' } },
        { name: 'Charlie', status: { type: 2, key: 'status', value: null } },
        { name: 'Dave', status: { type: 2, key: 'status', value: 'inactive' } }
      ]
      
      const fq = createFieldQuery({ query: 'active' })
      const result = processor.applyQueryFilter(data, 'status', fq)
      
      expect(result).toHaveLength(2)
      expect(result[0].name).toBe('Alice')
      expect(result[1].name).toBe('Dave')
    })
    
    it('should filter TDNode-like values with missing value property', () => {
      // TDNode with type but no value property - should be treated as complex node
      const data: TableRow[] = [
        { name: 'Alice', status: { type: 2, key: 'status', value: 'active' } },
        { name: 'Bob', status: { type: 2, key: 'status' } },  // No value property
        { name: 'Charlie', status: { type: 2, key: 'status', value: undefined } }
      ]
      
      const fq = createFieldQuery({ query: 'active' })
      const result = processor.applyQueryFilter(data, 'status', fq)
      
      // Only Alice should match
      // Bob and Charlie have no value or undefined value, which converts to ''
      expect(result).toHaveLength(1)
      expect(result[0].name).toBe('Alice')
    })
    
    
    it('should filter out null values when searching', () => {
      const data: TableRow[] = [
        { name: 'Alice', status: 'active' },
        { name: 'Bob', status: null },
        { name: 'Charlie', status: 'active' }
      ]
      
      const config: ProcessingConfig = {
        fieldQueries: {
          status: createFieldQuery({ query: 'active' })
        },
        columnOrder: ['name', 'status']
      }
      
      const result = processor.processData(data, config)
      expect(result.data).toHaveLength(2)
      expect(result.data.every(r => r.status === 'active')).toBe(true)
    })
    
    it('should keep rows with undefined field values for base columns (field not present)', () => {
      const data: TableRow[] = [
        { name: 'Alice', status: 'active' },
        { name: 'Bob' },  // no status field
        { name: 'Charlie', status: 'active' }
      ]
      
      const config: ProcessingConfig = {
        fieldQueries: {
          status: createFieldQuery({ query: 'active' })
        },
        columnOrder: ['name', 'status']
      }
      
      const result = processor.processData(data, config)
      // Bob should be kept because status is a BASE column (not derived)
      // and his status field doesn't exist - we don't filter by missing base fields
      expect(result.data).toHaveLength(3)
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

  describe('JS Expression Filter', () => {
    it('should filter rows using JS expression on string field', () => {
      const data: TableRow[] = [
        { name: 'hello' },
        { name: 'hi' },
        { name: 'hello world' },
        { name: 'hey' }
      ]
      
      const config: ProcessingConfig = {
        fieldQueries: {
          name: createFieldQuery({ jsExpression: '$.length > 3' })
        },
        columnOrder: ['name']
      }
      
      const result = processor.processData(data, config)
      
      expect(result.data.length).toBe(2)
      expect(result.data[0].name).toBe('hello')
      expect(result.data[1].name).toBe('hello world')
    })

    it('should filter rows using JS expression on numeric field', () => {
      const data: TableRow[] = [
        { value: 10 },
        { value: 50 },
        { value: 100 },
        { value: 5 }
      ]
      
      const config: ProcessingConfig = {
        fieldQueries: {
          value: createFieldQuery({ jsExpression: '$ > 20' })
        },
        columnOrder: ['value']
      }
      
      const result = processor.processData(data, config)
      
      expect(result.data.length).toBe(2)
      expect(result.data[0].value).toBe(50)
      expect(result.data[1].value).toBe(100)
    })

    it('should filter rows using JS expression with string methods', () => {
      const data: TableRow[] = [
        { status: 'SUCCESS' },
        { status: 'FAILED' },
        { status: 'SUCCESS_PARTIAL' },
        { status: 'ERROR' }
      ]
      
      const config: ProcessingConfig = {
        fieldQueries: {
          status: createFieldQuery({ jsExpression: '$.includes("SUCCESS")' })
        },
        columnOrder: ['status']
      }
      
      const result = processor.processData(data, config)
      
      expect(result.data.length).toBe(2)
      expect(result.data[0].status).toBe('SUCCESS')
      expect(result.data[1].status).toBe('SUCCESS_PARTIAL')
    })

    it('should handle null/undefined values gracefully', () => {
      const data: TableRow[] = [
        { value: 'hello' },
        { value: null },
        { value: undefined },
        { value: 'world' }
      ]
      
      const config: ProcessingConfig = {
        fieldQueries: {
          value: createFieldQuery({ jsExpression: '$ && $.length > 3' })
        },
        columnOrder: ['value']
      }
      
      const result = processor.processData(data, config)
      
      expect(result.data.length).toBe(2)
      expect(result.data[0].value).toBe('hello')
      expect(result.data[1].value).toBe('world')
    })

    it('should return all rows on invalid JS expression', () => {
      const data: TableRow[] = [
        { value: 'a' },
        { value: 'b' }
      ]
      
      const config: ProcessingConfig = {
        fieldQueries: {
          value: createFieldQuery({ jsExpression: 'invalid syntax {{' })
        },
        columnOrder: ['value']
      }
      
      const result = processor.processData(data, config)
      
      expect(result.data.length).toBe(2)
    })

    it('should work with object field values', () => {
      const data: TableRow[] = [
        { payload: { count: 5 } },
        { payload: { count: 15 } },
        { payload: { count: 25 } }
      ]
      
      const config: ProcessingConfig = {
        fieldQueries: {
          payload: createFieldQuery({ jsExpression: '$.count > 10' })
        },
        columnOrder: ['payload']
      }
      
      const result = processor.processData(data, config)
      
      expect(result.data.length).toBe(2)
      expect(result.data[0].payload.count).toBe(15)
      expect(result.data[1].payload.count).toBe(25)
    })

    it('should filter when jsExpression is in fieldQueries without query', () => {
      const data: TableRow[] = [
        { name: 'short' },
        { name: 'this is longer' },
        { name: 'a' }
      ]
      
      const config: ProcessingConfig = {
        fieldQueries: {
          name: createFieldQuery({ 
            query: '',  // Empty query (JS mode)
            jsExpression: '$.length > 5' 
          })
        },
        columnOrder: ['name']
      }
      
      const result = processor.processData(data, config)
      
      expect(result.data.length).toBe(1)
      expect(result.data[0].name).toBe('this is longer')
    })

    it('should handle the exact scenario from UI: field in columnOrder, jsExpression set', () => {
      const data: TableRow[] = [
        { id: 1, status: 'active' },
        { id: 2, status: 'inactive' },
        { id: 3, status: 'active' },
        { id: 4, status: 'pending' }
      ]
      
      const config: ProcessingConfig = {
        fieldQueries: {
          status: {
            query: '',
            isRegex: false,
            isNegate: false,
            isArray: false,
            isPattern: false,
            isDisabled: false,
            patternFields: [],
            jsExpression: '$ === "active"'
          }
        },
        columnOrder: ['id', 'status']
      }
      
      const result = processor.processData(data, config)
      
      expect(result.data.length).toBe(2)
      expect(result.data[0].status).toBe('active')
      expect(result.data[1].status).toBe('active')
    })
  })
})
