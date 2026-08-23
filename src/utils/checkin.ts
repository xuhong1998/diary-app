import { formatDate, parseDate } from '@/utils/date'
import { parseModuleData } from '@/utils/moduleData'
import type { CheckinCheck, CheckinItem, CheckinKind } from '@/types'

export interface CheckinDay {
  date: string
  items: CheckinItem[]
  checks: Record<string, CheckinCheck>
}

export const CHECKIN_PRESETS: { name: string; icon: string; kind: CheckinKind }[] = [
  { name: '早睡', icon: '😴', kind: 'build' },
  { name: '早起', icon: '⏰', kind: 'build' },
  { name: '运动', icon: '🏃', kind: 'build' },
  { name: '阅读', icon: '📖', kind: 'build' },
  { name: '喝水', icon: '💧', kind: 'build' },
  { name: '不刷短视频', icon: '📱', kind: 'quit' },
  { name: '不喝奶茶', icon: '🧋', kind: 'quit' },
  { name: '不熬夜', icon: '🌙', kind: 'quit' },
]

export const CHECKIN_ICONS = [
  '😴', '⏰', '🏃', '📖', '💧', '🥗', '🧘', '💪',
  '📚', '☀️', '🎸', '🀄', '📱', '🧋', '🍺', '🌙',
]

export function parseCheckinData(raw: unknown): { items: CheckinItem[]; checks: Record<string, CheckinCheck> } {
  const parsed = parseModuleData(raw ?? {}) as Partial<{
    items: CheckinItem[]
    checks: Record<string, CheckinCheck>
  }>
  const items = Array.isArray(parsed.items)
    ? parsed.items.filter(it => it && typeof it.id === 'string' && typeof it.name === 'string')
    : []
  const checks =
    parsed.checks && typeof parsed.checks === 'object' && !Array.isArray(parsed.checks)
      ? parsed.checks
      : {}
  return { items, checks }
}

export function isChecked(checks: Record<string, CheckinCheck>, itemId: string): boolean {
  return checks[itemId]?.v === 1
}

export function addDays(date: string, delta: number): string {
  const d = parseDate(date)
  d.setDate(d.getDate() + delta)
  return formatDate(d)
}

export function buildStreak(
  dayChecks: Record<string, Record<string, CheckinCheck>>,
  itemId: string,
  today: string,
  maxDays = 3650
): number {
  let cursor = today
  if (!isChecked(dayChecks[cursor] ?? {}, itemId)) cursor = addDays(cursor, -1)
  let streak = 0
  while (streak < maxDays && isChecked(dayChecks[cursor] ?? {}, itemId)) {
    streak++
    cursor = addDays(cursor, -1)
  }
  return streak
}

export function quitStreak(
  dayChecks: Record<string, Record<string, CheckinCheck>>,
  itemId: string,
  today: string,
  firstSeen: string,
  maxDays = 3650
): number {
  if (!firstSeen) return 0
  if (isChecked(dayChecks[today] ?? {}, itemId)) return 0
  let streak = 0
  let cursor = today
  while (streak < maxDays && cursor >= firstSeen) {
    if (isChecked(dayChecks[cursor] ?? {}, itemId)) break
    streak++
    cursor = addDays(cursor, -1)
  }
  return streak
}

export type DayState = 'done' | 'fail' | 'none'

export interface DayDot {
  date: string
  state: DayState
  isToday: boolean
}

export function lastDaysState(
  dayChecks: Record<string, Record<string, CheckinCheck>>,
  itemId: string,
  kind: CheckinKind,
  today: string,
  firstSeen: string,
  n = 7
): DayDot[] {
  const out: DayDot[] = []
  for (let i = n - 1; i >= 0; i--) {
    const date = addDays(today, -i)
    const v = dayChecks[date]?.[itemId]?.v
    let state: DayState
    if (kind === 'build') {
      state = v === 1 ? 'done' : 'none'
    } else {
      state = v === 1 ? 'fail' : date >= firstSeen ? 'done' : 'none'
    }
    out.push({ date, state, isToday: date === today })
  }
  return out
}

export function monthStats(
  dayChecks: Record<string, Record<string, CheckinCheck>>,
  itemId: string,
  kind: CheckinKind,
  today: string,
  firstSeen: string
): { hit: number; total: number } {
  const [y, m] = today.split('-').map(Number)
  const monthStart = `${y}-${String(m).padStart(2, '0')}-01`
  const start = firstSeen > monthStart ? firstSeen : monthStart
  let hit = 0
  let total = 0
  let cursor = start
  while (cursor <= today) {
    const v = dayChecks[cursor]?.[itemId]?.v
    if (kind === 'build') {
      if (v === 1) hit++
    } else {
      if (v !== 1) hit++
    }
    total++
    cursor = addDays(cursor, 1)
  }
  return { hit, total }
}

export function todayProgress(
  items: CheckinItem[],
  checks: Record<string, CheckinCheck>
): { done: number; total: number; violated: number } {
  const active = items.filter(i => i.active)
  let done = 0
  let violated = 0
  for (const item of active) {
    const checked = isChecked(checks, item.id)
    if (item.kind === 'build') {
      if (checked) done++
    } else {
      if (checked) violated++
      else done++
    }
  }
  return { done, total: active.length, violated }
}

export function activityStreak(
  dayChecks: Record<string, Record<string, CheckinCheck>>,
  today: string,
  maxDays = 3650
): number {
  const hasActivity = (date: string) => {
    const c = dayChecks[date]
    return !!c && Object.values(c).some(ch => ch?.v === 1)
  }
  let cursor = today
  if (!hasActivity(cursor)) cursor = addDays(cursor, -1)
  let streak = 0
  while (streak < maxDays && hasActivity(cursor)) {
    streak++
    cursor = addDays(cursor, -1)
  }
  return streak
}

export function firstSeenDates(days: { date: string; items: CheckinItem[] }[]): Record<string, string> {
  const map: Record<string, string> = {}
  const sorted = [...days].sort((a, b) => a.date.localeCompare(b.date))
  for (const day of sorted) {
    for (const item of day.items) {
      if (!(item.id in map)) map[item.id] = day.date
    }
  }
  return map
}
