import { parseModuleData } from '@/utils/moduleData'
import { addDays } from '@/utils/review'
import type { PomodoroPhase, PomodoroSession } from '@/types'

// 日期平移属共享逻辑，统一由 review.ts 提供（CLAUDE.md），这里 re-export 供本模块调用方使用
export { addDays }

export interface PomodoroMode {
  id: string
  name: string
  focusMin: number
  breakMin: number
  longBreakMin: number
  longBreakEvery: number
}

export const POMODORO_MODES: PomodoroMode[] = [
  { id: 'classic', name: '经典', focusMin: 25, breakMin: 5, longBreakMin: 15, longBreakEvery: 4 },
  { id: 'deep', name: '深度专注', focusMin: 50, breakMin: 10, longBreakMin: 25, longBreakEvery: 3 },
  { id: 'sprint', name: '短冲刺', focusMin: 15, breakMin: 3, longBreakMin: 10, longBreakEvery: 4 },
]

export function modeById(id: string): PomodoroMode {
  return POMODORO_MODES.find(m => m.id === id) ?? POMODORO_MODES[0]
}

export function phaseMinutes(mode: PomodoroMode, phase: PomodoroPhase): number {
  if (phase === 'focus') return mode.focusMin
  if (phase === 'break') return mode.breakMin
  return mode.longBreakMin
}

/** 完成第 focusDone 个番茄后，下一个休息阶段是长休还是短休 */
export function breakAfterFocus(mode: PomodoroMode, focusDone: number): PomodoroPhase {
  return focusDone > 0 && focusDone % mode.longBreakEvery === 0 ? 'longBreak' : 'break'
}

export function parsePomodoroData(raw: unknown): PomodoroSession[] {
  const parsed = parseModuleData(raw ?? {}) as Partial<{ sessions: PomodoroSession[] }>
  if (!Array.isArray(parsed.sessions)) return []
  return parsed.sessions.filter(
    s =>
      s &&
      typeof s.id === 'string' &&
      typeof s.modeId === 'string' &&
      typeof s.startedAt === 'string' &&
      typeof s.endedAt === 'string' &&
      typeof s.seconds === 'number' &&
      s.seconds > 0 &&
      typeof s.plannedSec === 'number' &&
      typeof s.completed === 'boolean'
  )
}

export interface PomodoroDay {
  date: string
  sessions: PomodoroSession[]
}

export interface PomodoroStats {
  todayCount: number
  todayMinutes: number
  weekMinutes: number
  totalCount: number
  totalMinutes: number
  streak: number
}

export function focusMinutes(sessions: PomodoroSession[]): number {
  return Math.round(sessions.reduce((sum, s) => sum + s.seconds, 0) / 60)
}

export function pomodoroStats(days: PomodoroDay[], today: string): PomodoroStats {
  const byDate: Record<string, PomodoroSession[]> = {}
  let totalCount = 0
  let totalSeconds = 0
  for (const d of days) {
    if (!d.sessions.length) continue
    byDate[d.date] = d.sessions
    totalCount += d.sessions.length
    totalSeconds += d.sessions.reduce((sum, s) => sum + s.seconds, 0)
  }

  let weekSeconds = 0
  for (let i = 0; i < 7; i++) {
    const date = addDays(today, -i)
    for (const s of byDate[date] ?? []) weekSeconds += s.seconds
  }

  const hasSession = (date: string) => (byDate[date] ?? []).length > 0
  let cursor = today
  if (!hasSession(cursor)) cursor = addDays(cursor, -1)
  let streak = 0
  while (hasSession(cursor)) {
    streak++
    cursor = addDays(cursor, -1)
  }

  return {
    todayCount: (byDate[today] ?? []).length,
    todayMinutes: focusMinutes(byDate[today] ?? []),
    weekMinutes: Math.round(weekSeconds / 60),
    totalCount,
    totalMinutes: Math.round(totalSeconds / 60),
    streak,
  }
}

export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.ceil(totalSeconds))
  const m = Math.floor(s / 60)
  const r = s % 60
  return `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`
}

export function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes} 分钟`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m ? `${h} 小时 ${m} 分` : `${h} 小时`
}

export function clockOf(epochMs: number): string {
  const d = new Date(epochMs)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}
