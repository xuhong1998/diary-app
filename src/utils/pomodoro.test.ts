import { describe, it, expect } from 'vitest'
import {
  POMODORO_MODES,
  modeById,
  phaseMinutes,
  breakAfterFocus,
  parsePomodoroData,
  pomodoroStats,
  focusMinutes,
  formatClock,
  formatMinutes,
  clockOf,
  addDays,
} from './pomodoro'
import type { PomodoroSession } from '@/types'

const TODAY = '2026-09-07'

function session(over: Partial<PomodoroSession> = {}): PomodoroSession {
  return {
    id: crypto.randomUUID(),
    modeId: 'classic',
    startedAt: '09:00',
    endedAt: '09:25',
    seconds: 1500,
    plannedSec: 1500,
    completed: true,
    ...over,
  }
}

describe('modeById', () => {
  it('返回对应预设，未知 id 回退经典', () => {
    expect(modeById('deep').focusMin).toBe(50)
    expect(modeById('nope').id).toBe('classic')
  })
})

describe('phaseMinutes', () => {
  it('按阶段取时长', () => {
    const mode = POMODORO_MODES[0]
    expect(phaseMinutes(mode, 'focus')).toBe(25)
    expect(phaseMinutes(mode, 'break')).toBe(5)
    expect(phaseMinutes(mode, 'longBreak')).toBe(15)
  })
})

describe('breakAfterFocus', () => {
  it('每 4 个番茄进入长休', () => {
    const mode = POMODORO_MODES[0]
    expect(breakAfterFocus(mode, 0)).toBe('break')
    expect(breakAfterFocus(mode, 1)).toBe('break')
    expect(breakAfterFocus(mode, 3)).toBe('break')
    expect(breakAfterFocus(mode, 4)).toBe('longBreak')
    expect(breakAfterFocus(mode, 8)).toBe('longBreak')
  })
})

describe('parsePomodoroData', () => {
  it('解析合法数据并过滤脏项', () => {
    const sessions = parsePomodoroData({
      sessions: [session(), null, { id: 'x' }, session({ seconds: 0 })],
    })
    expect(sessions).toHaveLength(1)
  })

  it('空输入返回空数组', () => {
    expect(parsePomodoroData(undefined)).toEqual([])
    expect(parsePomodoroData({})).toEqual([])
    expect(parsePomodoroData('not json')).toEqual([])
  })
})

describe('focusMinutes', () => {
  it('按秒求和换算分钟', () => {
    expect(focusMinutes([session({ seconds: 1500 }), session({ seconds: 900 })])).toBe(40)
  })
})

describe('pomodoroStats', () => {
  it('汇总今日/本周/累计与连续天数', () => {
    const days = [
      { date: TODAY, sessions: [session(), session({ seconds: 600, completed: false })] },
      { date: '2026-09-06', sessions: [session()] },
      { date: '2026-09-04', sessions: [session()] },
      { date: '2026-09-03', sessions: [] },
    ]
    const stats = pomodoroStats(days, TODAY)
    expect(stats.todayCount).toBe(2)
    expect(stats.todayMinutes).toBe(35)
    // 最近 7 天滚动窗口（09-01 ~ 09-07）：1500+600+1500+1500
    expect(stats.weekMinutes).toBe(85)
    expect(stats.totalCount).toBe(4)
    expect(stats.totalMinutes).toBe(85)
    expect(stats.streak).toBe(2)
  })

  it('周窗口只统计最近 7 天，更早的不计入', () => {
    const days = [
      { date: TODAY, sessions: [session()] },
      { date: '2026-09-01', sessions: [session()] },
      { date: '2026-08-31', sessions: [session()] },
    ]
    const stats = pomodoroStats(days, TODAY)
    expect(stats.weekMinutes).toBe(50)
    expect(stats.totalMinutes).toBe(75)
  })

  it('今天没有记录时连续天数从昨天回溯', () => {
    const stats = pomodoroStats(
      [{ date: '2026-09-06', sessions: [session()] }],
      TODAY
    )
    expect(stats.todayCount).toBe(0)
    expect(stats.streak).toBe(1)
  })

  it('无任何记录时全为 0', () => {
    const stats = pomodoroStats([], TODAY)
    expect(stats.totalCount).toBe(0)
    expect(stats.streak).toBe(0)
  })
})

describe('formatClock / formatMinutes', () => {
  it('时钟格式（秒数向上取整）', () => {
    expect(formatClock(1500)).toBe('25:00')
    expect(formatClock(59)).toBe('00:59')
    expect(formatClock(59.9)).toBe('01:00')
    expect(formatClock(0)).toBe('00:00')
    expect(formatClock(-5)).toBe('00:00')
  })

  it('时长文案', () => {
    expect(formatMinutes(45)).toBe('45 分钟')
    expect(formatMinutes(60)).toBe('1 小时')
    expect(formatMinutes(125)).toBe('2 小时 5 分')
  })
})

describe('addDays', () => {
  it('跨月跨年', () => {
    expect(addDays('2026-09-01', -1)).toBe('2026-08-31')
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
  })
})

describe('clockOf', () => {
  it('epoch 毫秒转本地 HH:mm', () => {
    const d = new Date(2026, 8, 7, 9, 5, 0)
    expect(clockOf(d.getTime())).toBe('09:05')
  })
})
