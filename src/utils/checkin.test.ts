import { describe, it, expect } from 'vitest'
import {
  buildStreak,
  quitStreak,
  lastDaysState,
  monthStats,
  todayProgress,
  activityStreak,
  firstSeenDates,
  addDays,
  parseCheckinData,
} from './checkin'
import type { CheckinCheck, CheckinItem } from '@/types'

const TODAY = '2026-08-23'

function item(id: string, kind: 'build' | 'quit' = 'build', active = true): CheckinItem {
  return { id, name: id, icon: '✅', kind, active, createdAt: '2026-01-01' }
}

function check(v: 0 | 1 = 1): CheckinCheck {
  return { v, at: '10:00' }
}

function daysFrom(map: Record<string, Record<string, CheckinCheck>>) {
  return map
}

describe('addDays', () => {
  it('跨月与跨年', () => {
    expect(addDays('2026-08-01', -1)).toBe('2026-07-31')
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
  })
})

describe('parseCheckinData', () => {
  it('解析合法数据并过滤脏项', () => {
    const { items, checks } = parseCheckinData({
      items: [item('a'), null, { name: 'x' }],
      checks: { a: check() },
    })
    expect(items).toHaveLength(1)
    expect(checks.a.v).toBe(1)
  })

  it('空输入返回空结构', () => {
    const { items, checks } = parseCheckinData(undefined)
    expect(items).toEqual([])
    expect(checks).toEqual({})
  })
})

describe('buildStreak', () => {
  it('今天已打卡则计入', () => {
    const days = daysFrom({
      '2026-08-23': { a: check() },
      '2026-08-22': { a: check() },
      '2026-08-21': {},
    })
    expect(buildStreak(days, 'a', TODAY)).toBe(2)
  })

  it('今天未打卡不中断（从昨天起算）', () => {
    const days = daysFrom({
      '2026-08-22': { a: check() },
      '2026-08-21': { a: check() },
    })
    expect(buildStreak(days, 'a', TODAY)).toBe(2)
  })

  it('昨天断则归零', () => {
    const days = daysFrom({ '2026-08-19': { a: check() } })
    expect(buildStreak(days, 'a', TODAY)).toBe(0)
  })
})

describe('quitStreak', () => {
  it('从未破戒则从首次出现连续到今天', () => {
    const days = daysFrom({ '2026-08-20': {} })
    expect(quitStreak(days, 'q', TODAY, '2026-08-20')).toBe(4)
  })

  it('今天破戒则归零', () => {
    const days = daysFrom({ '2026-08-23': { q: check() } })
    expect(quitStreak(days, 'q', TODAY, '2026-08-20')).toBe(0)
  })

  it('破戒日中断计数', () => {
    const days = daysFrom({
      '2026-08-22': { q: check() },
      '2026-08-21': {},
    })
    expect(quitStreak(days, 'q', TODAY, '2026-08-20')).toBe(1)
  })

  it('无历史记录返回 0', () => {
    expect(quitStreak({}, 'q', TODAY, '')).toBe(0)
  })
})

describe('lastDaysState', () => {
  it('养成型：打卡绿/未打卡灰', () => {
    const days = daysFrom({ '2026-08-23': { a: check() } })
    const dots = lastDaysState(days, 'a', 'build', TODAY, '2026-08-01')
    expect(dots).toHaveLength(7)
    expect(dots[6].state).toBe('done')
    expect(dots[6].isToday).toBe(true)
    expect(dots[5].state).toBe('none')
  })

  it('戒断型：破戒红，首次出现前灰', () => {
    const dots = lastDaysState({}, 'q', 'quit', TODAY, '2026-08-22')
    expect(dots[6].state).toBe('done')
    expect(dots[5].state).toBe('done')
    expect(dots[4].state).toBe('none')
  })
})

describe('monthStats', () => {
  it('按首次出现日截断统计', () => {
    const days = daysFrom({
      '2026-08-22': { a: check() },
      '2026-08-23': {},
    })
    const { hit, total } = monthStats(days, 'a', 'build', TODAY, '2026-08-22')
    expect(hit).toBe(1)
    expect(total).toBe(2)
  })

  it('戒断型未破戒计入达成', () => {
    const days = daysFrom({ '2026-08-22': { q: check() } })
    const { hit, total } = monthStats(days, 'q', 'quit', TODAY, '2026-08-21')
    expect(hit).toBe(2)
    expect(total).toBe(3)
  })
})

describe('todayProgress', () => {
  it('养成勾选+戒断未破戒计完成', () => {
    const items = [item('a', 'build'), item('q', 'quit'), item('b', 'build')]
    const checks: Record<string, CheckinCheck> = { a: check(), q: check() }
    expect(todayProgress(items, checks)).toEqual({ done: 1, total: 3, violated: 1 })
  })

  it('归档项不计入', () => {
    const items = [item('a', 'build'), item('z', 'build', false)]
    expect(todayProgress(items, {})).toEqual({ done: 0, total: 1, violated: 0 })
  })
})

describe('activityStreak', () => {
  it('任意打卡动作即计活跃', () => {
    const days = daysFrom({
      '2026-08-23': { q: check() },
      '2026-08-22': { a: check() },
      '2026-08-20': { a: check() },
    })
    expect(activityStreak(days, TODAY)).toBe(2)
  })

  it('今天无动作不中断', () => {
    const days = daysFrom({ '2026-08-22': { a: check() } })
    expect(activityStreak(days, TODAY)).toBe(1)
  })
})

describe('firstSeenDates', () => {
  it('取项目出现的最早日期', () => {
    const days = [
      { date: '2026-08-23', items: [item('a'), item('b')] },
      { date: '2026-08-20', items: [item('b')] },
    ]
    expect(firstSeenDates(days)).toEqual({ b: '2026-08-20', a: '2026-08-23' })
  })
})
