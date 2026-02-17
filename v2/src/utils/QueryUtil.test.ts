import { describe, it, expect } from 'vitest'
import { patternToRegex, matchPattern, matchFieldQuery, createExtendedFieldsFunc } from './QueryUtil'

describe('patternToRegex', () => {
  it('should return null for empty pattern', () => {
    expect(patternToRegex('')).toBeNull()
  })

  it('should convert simple pattern with one placeholder', () => {
    const regex = patternToRegex('Order:${orderId}')
    expect(regex).not.toBeNull()
    // Last placeholder uses greedy .+ for proper matching
    expect(regex!.source).toContain('(?<orderId>.+)')
  })

  it('should convert pattern with multiple placeholders', () => {
    const regex = patternToRegex('User ${userId} logged in at ${timestamp}')
    expect(regex).not.toBeNull()
    // Intermediate placeholders use non-greedy .+?
    expect(regex!.source).toContain('(?<userId>.+?)')
    // Last placeholder uses greedy .+
    expect(regex!.source).toContain('(?<timestamp>.+)')
  })

  it('should escape regex special characters', () => {
    const regex = patternToRegex('Price: $${amount} (USD)')
    expect(regex).not.toBeNull()
    // The parentheses should be escaped
    expect(regex!.source).toContain('\\(USD\\)')
  })
})

describe('matchPattern', () => {
  it('should return null for empty pattern', () => {
    expect(matchPattern('any value', '')).toBeNull()
  })

  it('should return null when pattern does not match', () => {
    expect(matchPattern('Hello World', 'Order:${orderId}')).toBeNull()
  })

  it('should extract single placeholder value', () => {
    const result = matchPattern('Order:12345', 'Order:${orderId}')
    expect(result).not.toBeNull()
    expect(result!.orderId).toBe('12345')
  })

  it('should extract multiple placeholder values', () => {
    const result = matchPattern('User john logged in at 2024-01-15', 'User ${userId} logged in at ${timestamp}')
    expect(result).not.toBeNull()
    expect(result!.userId).toBe('john')
    expect(result!.timestamp).toBe('2024-01-15')
  })

  it('should be case insensitive', () => {
    const result = matchPattern('ORDER:ABC123', 'Order:${orderId}')
    expect(result).not.toBeNull()
    expect(result!.orderId).toBe('ABC123')
  })

  it('should match pattern as substring', () => {
    const result = matchPattern('Prefix Order:99999 Suffix', 'Order:${orderId}')
    expect(result).not.toBeNull()
    expect(result!.orderId).toBe('99999 Suffix')
  })

  it('should handle special characters in the value', () => {
    const result = matchPattern('Order:abc-123_456', 'Order:${orderId}')
    expect(result).not.toBeNull()
    expect(result!.orderId).toBe('abc-123_456')
  })

  it('should handle pattern with special regex characters', () => {
    const result = matchPattern('Price: $100 (USD)', 'Price: $${amount} (USD)')
    expect(result).not.toBeNull()
    expect(result!.amount).toBe('100')
  })

  it('should handle numeric values', () => {
    const result = matchPattern('Count: 42', 'Count: ${count}')
    expect(result).not.toBeNull()
    expect(result!.count).toBe('42')
  })

  it('should handle empty placeholder matches (greedy)', () => {
    // With non-greedy .+?, empty strings won't match
    const result = matchPattern('Order:', 'Order:${orderId}')
    expect(result).toBeNull() // .+? requires at least one character
  })

  it('should handle adjacent placeholders', () => {
    const result = matchPattern('AB123', '${prefix}${number}')
    expect(result).not.toBeNull()
    // Non-greedy matching should give first placeholder minimal match
    expect(result!.prefix).toBe('A')
    expect(result!.number).toBe('B123')
  })

  it('should handle placeholder at start', () => {
    const result = matchPattern('12345-order', '${id}-order')
    expect(result).not.toBeNull()
    expect(result!.id).toBe('12345')
  })

  it('should handle placeholder at end', () => {
    const result = matchPattern('status:active', 'status:${value}')
    expect(result).not.toBeNull()
    expect(result!.value).toBe('active')
  })

  // Tests for $name syntax (simple placeholder)
  it('should support $name syntax for simple placeholders', () => {
    const result = matchPattern('Order:12345 shipped', 'Order:$orderId shipped')
    expect(result).not.toBeNull()
    expect(result!.orderId).toBe('12345')
  })

  it('should capture word characters only with $name syntax', () => {
    const result = matchPattern('user_123 logged in', '$userId logged in')
    expect(result).not.toBeNull()
    expect(result!.userId).toBe('user_123')
  })

  it('should stop at non-word characters with $name syntax', () => {
    const result = matchPattern('id=abc123&name=test', 'id=$id&name=$name')
    expect(result).not.toBeNull()
    expect(result!.id).toBe('abc123')
    expect(result!.name).toBe('test')
  })

  it('should handle $name at end of pattern', () => {
    const result = matchPattern('status:active', 'status:$value')
    expect(result).not.toBeNull()
    expect(result!.value).toBe('active')
  })

  it('should handle $name with space boundary', () => {
    const result = matchPattern('User admin created order', 'User $user created order')
    expect(result).not.toBeNull()
    expect(result!.user).toBe('admin')
  })

  it('should mix ${name} and $name syntax', () => {
    const result = matchPattern('Order:12345 status:pending message', 'Order:$orderId status:${status}')
    expect(result).not.toBeNull()
    expect(result!.orderId).toBe('12345')
    expect(result!.status).toBe('pending message')
  })

  it('should not match when $name placeholder has no word characters', () => {
    const result = matchPattern('id= empty', 'id=$value empty')
    expect(result).toBeNull() // \w+ requires at least one word character
  })

  // Tests for * wildcard syntax
  it('should support * wildcard to match any string', () => {
    const result = matchPattern('Error: connection timeout occurred', 'Error:*timeout*')
    expect(result).not.toBeNull()
  })

  it('should match with * at the start', () => {
    const result = matchPattern('some prefix Error happened', '*Error*')
    expect(result).not.toBeNull()
  })

  it('should match with * at the end', () => {
    const result = matchPattern('Warning: disk space low', 'Warning:*')
    expect(result).not.toBeNull()
  })

  it('should match with multiple * wildcards', () => {
    const result = matchPattern('User admin performed action delete on resource file', 'User*action*resource*')
    expect(result).not.toBeNull()
  })

  it('should not match when wildcard pattern does not match', () => {
    const result = matchPattern('Info: system started', 'Error:*')
    expect(result).toBeNull()
  })

  it('should combine * wildcard with placeholders', () => {
    const result = matchPattern('Order 12345: processing started for item ABC', 'Order $orderId:*item ${itemId}')
    expect(result).not.toBeNull()
    expect(result!.orderId).toBe('12345')
    expect(result!.itemId).toBe('ABC')
  })

  it('should match empty string with * wildcard', () => {
    const result = matchPattern('prefix suffix', 'prefix*suffix')
    expect(result).not.toBeNull()
  })
})

describe('matchFieldQuery', () => {
  const createFieldQuery = (overrides: Partial<{
    query: string
    isRegex: boolean
    isNegate: boolean
    isArray: boolean
    isPattern: boolean
    isDisabled: boolean
    patternFields: string[]
  }> = {}) => ({
    query: '',
    isRegex: false,
    isNegate: false,
    isArray: false,
    isPattern: false,
    isDisabled: false,
    patternFields: [],
    ...overrides
  })

  it('should return true for empty query', () => {
    expect(matchFieldQuery('any value', createFieldQuery())).toBe(true)
  })

  it('should match substring (case insensitive)', () => {
    const fq = createFieldQuery({ query: 'hello' })
    expect(matchFieldQuery('Hello World', fq)).toBe(true)
    expect(matchFieldQuery('Say hello!', fq)).toBe(true)
    expect(matchFieldQuery('Goodbye', fq)).toBe(false)
  })

  it('should negate match when isNegate is true', () => {
    const fq = createFieldQuery({ query: 'error', isNegate: true })
    expect(matchFieldQuery('This is an error', fq)).toBe(false)
    expect(matchFieldQuery('This is fine', fq)).toBe(true)
  })

  it('should match regex when isRegex is true', () => {
    const fq = createFieldQuery({ query: '^\\d+$', isRegex: true })
    expect(matchFieldQuery('12345', fq)).toBe(true)
    expect(matchFieldQuery('abc123', fq)).toBe(false)
  })

  it('should match any value in array when isArray is true', () => {
    const fq = createFieldQuery({ query: 'red, green, blue', isArray: true })
    expect(matchFieldQuery('red', fq)).toBe(true)
    expect(matchFieldQuery('green', fq)).toBe(true)
    expect(matchFieldQuery('blue', fq)).toBe(true)
    expect(matchFieldQuery('yellow', fq)).toBe(false)
  })

  it('should use pattern matching when isPattern is true', () => {
    const fq = createFieldQuery({ 
      query: 'Order:${orderId}', 
      isPattern: true,
      patternFields: ['orderId']
    })
    expect(matchFieldQuery('Order:12345', fq)).toBe(true)
    expect(matchFieldQuery('Something else', fq)).toBe(false)
  })

  it('should use pattern matching when isPattern is true', () => {
    const fq = createFieldQuery({ 
      query: "Verification ${matches} for order '$order' Legacy issues: [], New issues: [issue_type: ${issue_type} ]", 
      isPattern: true,
      patternFields: []
    })
    expect(matchFieldQuery("Verification mismatch for order '121212' Legacy issues: [], New issues: [issue_type: NOT_ALLOWED ]", fq)).toBe(true)
    expect(matchFieldQuery('Something else', fq)).toBe(false)
  })

    it('should use pattern matching there is single quote around the pattern variable without curly braces', () => {
    const fq = createFieldQuery({ 
      query: "API: $name Request: '$request' Response: '${response}'", 
      isPattern: true,
      patternFields: []
    })
    expect(matchFieldQuery("API: SomeAPIName Request: '{}' Response: '{}'", fq)).toBe(true)
    expect(matchFieldQuery('Something else', fq)).toBe(false)
  })


  // Debug: pattern matching with exact value copy - newline representation mismatch
  it('should match when pattern is exact copy of value with newline', () => {
    // Value as stored after JSON parse: \n becomes actual newline character (U+000A)
    const valueWithNewline = "Verification mismatch for order Order123456. Legacy issues: [], New issues: [issue_type: SCHEDULING_EXCEEDS_LIMIT\nentity_id"
    // When user copies from UI or types, they get backslash-n as two chars - regex then matches \ + n, not newline
    const patternAsTyped = "Verification mismatch for order Order123456. Legacy issues: [], New issues: [issue_type: SCHEDULING_EXCEEDS_LIMIT\\nentity_id"
    const fq = createFieldQuery({ query: patternAsTyped, isPattern: true })
    const result = matchFieldQuery(valueWithNewline, fq)
    expect(result).toBe(true)
  })

  it('should match when both value and pattern have actual newline', () => {
    const valueWithNewline = "Verification mismatch for order Order123456. Legacy issues: [], New issues: [issue_type: SCHEDULING_EXCEEDS_LIMIT\nentity_id"
    const patternWithNewline = "Verification mismatch for order Order123456. Legacy issues: [], New issues: [issue_type: SCHEDULING_EXCEEDS_LIMIT\nentity_id"
    const fq = createFieldQuery({ query: patternWithNewline, isPattern: true })
    expect(matchFieldQuery(valueWithNewline, fq)).toBe(true)
  })

  it('should match literal backslash when user types \\\\', () => {
    const value = 'path\\to\\file'
    const pattern = 'path\\\\to\\\\file'
    const fq = createFieldQuery({ query: pattern, isPattern: true })
    expect(matchFieldQuery(value, fq)).toBe(true)
  })


  it('should handle invalid regex gracefully', () => {
    const fq = createFieldQuery({ query: '[invalid', isRegex: true })
    // Should fall back to string match
    expect(matchFieldQuery('contains [invalid text', fq)).toBe(true)
  })
})

describe('createExtendedFieldsFunc', () => {
  it('should return null for empty expression', () => {
    expect(createExtendedFieldsFunc('')).toBeNull()
    expect(createExtendedFieldsFunc('   ')).toBeNull()
  })

  it('should create function for simple field', () => {
    const func = createExtendedFieldsFunc('name: $.firstName')
    expect(func).not.toBeNull()
    const result = func!({ firstName: 'John' })
    expect(result.name).toBe('John')
  })

  it('should create function for multiple fields', () => {
    const func = createExtendedFieldsFunc('full: $.first + " " + $.last, upper: $.name.toUpperCase()')
    expect(func).not.toBeNull()
    const result = func!({ first: 'John', last: 'Doe', name: 'test' })
    expect(result.full).toBe('John Doe')
    expect(result.upper).toBe('TEST')
  })

  it('should ignore field with parse error but continue with others', () => {
    // Invalid syntax in first field (unclosed bracket), valid second field
    // Note: parser needs balanced brackets to split correctly, so use a complete but invalid expression
    const func = createExtendedFieldsFunc('bad: function{}, good: $.name')
    expect(func).not.toBeNull()
    const result = func!({ name: 'John' })
    expect(result.good).toBe('John')
    expect(result.bad).toBeUndefined()
  })

  it('should ignore field with runtime error but continue with others', () => {
    // First field will throw at runtime (undefined.foo), second is valid
    const func = createExtendedFieldsFunc('bad: $.missing.nested.value, good: $.name')
    expect(func).not.toBeNull()
    const result = func!({ name: 'John' })
    expect(result.good).toBe('John')
    expect(result.bad).toBeUndefined()
  })

  it('should handle fields with commas inside strings', () => {
    const func = createExtendedFieldsFunc('msg: "Hello, World", name: $.name')
    expect(func).not.toBeNull()
    const result = func!({ name: 'John' })
    expect(result.msg).toBe('Hello, World')
    expect(result.name).toBe('John')
  })

  it('should handle fields with nested objects/arrays', () => {
    const func = createExtendedFieldsFunc('arr: [$.a, $.b], obj: {x: $.x}')
    expect(func).not.toBeNull()
    const result = func!({ a: 1, b: 2, x: 3 })
    expect(result.arr).toEqual([1, 2])
    expect(result.obj).toEqual({ x: 3 })
  })
})
