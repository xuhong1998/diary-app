import type { Period } from '@/types'

export function formatDate(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

export function parseDate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function todayStr(): string {
  return formatDate(new Date())
}

export function nowTime(): string {
  const d = new Date()
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export function parseTimeToDate(time: string): Date {
  const [h, m] = time.split(':').map(Number)
  const d = new Date()
  d.setHours(h, m, 0, 0)
  return d
}

export function getPeriod(d: Date): Period {
  const h = d.getHours()
  if (h < 12) return 'morning'
  if (h < 18) return 'afternoon'
  return 'evening'
}

export function normalizeTime(input: string): string {
  const cleaned = input.trim().replace(/：/g, ':').replace(/[^\d:]/g, '')
  if (!cleaned) return nowTime()
  let h: number, m: number
  if (cleaned.includes(':')) {
    const parts = cleaned.split(':')
    h = parseInt(parts[0], 10)
    m = parseInt(parts[1] || '0', 10)
  } else if (cleaned.length <= 2) {
    h = parseInt(cleaned, 10)
    m = 0
  } else {
    h = parseInt(cleaned.slice(0, -2), 10)
    m = parseInt(cleaned.slice(-2), 10)
  }
  h = Math.max(0, Math.min(23, h || 0))
  m = Math.max(0, Math.min(59, m || 0))
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}
