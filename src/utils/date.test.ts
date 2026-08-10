import { describe, it, expect, vi, beforeEach } from 'vitest'
import { formatDate, parseDate, todayStr, normalizeTime, getPeriod, parseTimeToDate } from '@/utils/date'

describe('formatDate', () => {
  it('formats date correctly', () => {
    expect(formatDate(new Date(2024, 0, 5))).toBe('2024-01-05')
    expect(formatDate(new Date(2024, 11, 31))).toBe('2024-12-31')
    expect(formatDate(new Date(2025, 5, 9))).toBe('2025-06-09')
  })

  it('pads single digit months and days', () => {
    expect(formatDate(new Date(2024, 0, 1))).toBe('2024-01-01')
    expect(formatDate(new Date(2024, 2, 3))).toBe('2024-03-03')
  })
})

describe('parseDate', () => {
  it('parses date string correctly', () => {
    const d = parseDate('2024-06-15')
    expect(d.getFullYear()).toBe(2024)
    expect(d.getMonth()).toBe(5)
    expect(d.getDate()).toBe(15)
  })

  it('is inverse of formatDate', () => {
    const original = '2024-12-31'
    const d = parseDate(original)
    expect(formatDate(d)).toBe(original)
  })
})

describe('todayStr', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  it('returns today as YYYY-MM-DD', () => {
    vi.setSystemTime(new Date(2024, 5, 15, 10, 30))
    expect(todayStr()).toBe('2024-06-15')
  })

  it('handles year boundaries', () => {
    vi.setSystemTime(new Date(2024, 0, 1, 0, 0))
    expect(todayStr()).toBe('2024-01-01')
  })

  vi.useRealTimers()
})

describe('normalizeTime', () => {
  it('parses HH:MM format', () => {
    expect(normalizeTime('7:10')).toBe('07:10')
    expect(normalizeTime('14:30')).toBe('14:30')
  })

  it('parses full-width colon', () => {
    expect(normalizeTime('7：10')).toBe('07:10')
    expect(normalizeTime('14：30')).toBe('14:30')
  })

  it('parses 3-4 digit compact format', () => {
    expect(normalizeTime('710')).toBe('07:10')
    expect(normalizeTime('0830')).toBe('08:30')
    expect(normalizeTime('1430')).toBe('14:30')
  })

  it('parses 1-2 digit hour only', () => {
    expect(normalizeTime('7')).toBe('07:00')
    expect(normalizeTime('14')).toBe('14:00')
  })

  it('clamps invalid values', () => {
    expect(normalizeTime('25:99')).toBe('23:59')
    expect(normalizeTime('99:99')).toBe('23:59')
  })

  it('returns current time for empty input', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2024, 0, 1, 9, 5))
    expect(normalizeTime('')).toBe('09:05')
    expect(normalizeTime('abc')).toBe('09:05')
    vi.useRealTimers()
  })

  it('strips non-numeric characters', () => {
    expect(normalizeTime('7点10分')).toBe('07:10')
  })
})

describe('getPeriod', () => {
  it('returns morning for hours 0-11', () => {
    expect(getPeriod(new Date(2024, 0, 1, 0, 0))).toBe('morning')
    expect(getPeriod(new Date(2024, 0, 1, 6, 0))).toBe('morning')
    expect(getPeriod(new Date(2024, 0, 1, 11, 59))).toBe('morning')
  })

  it('returns afternoon for hours 12-17', () => {
    expect(getPeriod(new Date(2024, 0, 1, 12, 0))).toBe('afternoon')
    expect(getPeriod(new Date(2024, 0, 1, 15, 0))).toBe('afternoon')
    expect(getPeriod(new Date(2024, 0, 1, 17, 59))).toBe('afternoon')
  })

  it('returns evening for hours 18-23', () => {
    expect(getPeriod(new Date(2024, 0, 1, 18, 0))).toBe('evening')
    expect(getPeriod(new Date(2024, 0, 1, 22, 0))).toBe('evening')
    expect(getPeriod(new Date(2024, 0, 1, 23, 59))).toBe('evening')
  })
})

describe('parseTimeToDate', () => {
  it('sets correct hours and minutes', () => {
    const d = parseTimeToDate('14:30')
    expect(d.getHours()).toBe(14)
    expect(d.getMinutes()).toBe(30)
  })

  it('zeroes seconds and ms', () => {
    const d = parseTimeToDate('09:05')
    expect(d.getSeconds()).toBe(0)
    expect(d.getMilliseconds()).toBe(0)
  })
})
