import { describe, it, expect } from 'vitest'
import { parseModuleData, serializeModuleData } from '@/utils/moduleData'

describe('parseModuleData', () => {
  it('parses normal JSON string', () => {
    const result = parseModuleData('{"key":"value"}')
    expect(result).toEqual({ key: 'value' })
  })

  it('parses double-encoded JSON string', () => {
    const result = parseModuleData(JSON.stringify(JSON.stringify({ key: 'value' })))
    expect(result).toEqual({ key: 'value' })
  })

  it('passes through object input', () => {
    const input = { a: 1 }
    const result = parseModuleData(input)
    expect(result).toEqual({ a: 1 })
  })

  it('returns empty object for invalid JSON', () => {
    expect(parseModuleData('not json')).toEqual({})
    expect(parseModuleData('{invalid')).toEqual({})
  })

  it('handles null and undefined', () => {
    expect(parseModuleData(null)).toEqual({})
    expect(parseModuleData(undefined)).toEqual({})
  })
})

describe('serializeModuleData', () => {
  it('serializes object to JSON string', () => {
    expect(serializeModuleData({ a: 1 })).toBe('{"a":1}')
  })

  it('serializes array', () => {
    expect(serializeModuleData([1, 2, 3])).toBe('[1,2,3]')
  })
})
