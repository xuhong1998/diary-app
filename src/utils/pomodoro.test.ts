import { describe, it, expect, beforeEach } from 'vitest'
import {
  parsePomodoroData,
  aggregateByTag,
  periodStart,
  formatClock,
  formatDur,
  clockOf,
  loadTags,
  saveTags,
  DEFAULT_TAGS,
  type PomodoroTag,
} from './pomodoro'

describe('parsePomodoroData', () => {
  it('解析合法 sessions，过滤缺字段/非法记录', () => {
    const raw = {
      sessions: [
        { id: '1', modeId: 'code', startedAt: '09:00', endedAt: '09:45', seconds: 2700, plannedSec: 2700, completed: true },
        { id: '2', modeId: 'code', startedAt: '10:00', endedAt: '10:05', seconds: 90, plannedSec: 2700, completed: false },
        { id: '3' }, // 缺字段
        { id: '4', modeId: 'code', startedAt: '11:00', endedAt: '11:00', seconds: 0, plannedSec: 2700, completed: true }, // seconds 0
      ],
    }
    const sessions = parsePomodoroData(raw)
    expect(sessions).toHaveLength(2)
    expect(parsePomodoroData({})).toEqual([])
    expect(parsePomodoroData(null)).toEqual([])
  })
})

describe('aggregateByTag', () => {
  const tags: PomodoroTag[] = [
    { id: 'code', emoji: '💻', name: '写代码', color: '#00c7be', min: 45 },
    { id: 'read', emoji: '📖', name: '阅读', color: '#ff9f0a', min: 25 },
  ]

  const days = [
    {
      date: '2026-09-18',
      sessions: [
        { id: 'a', modeId: 'code', startedAt: '09:00', endedAt: '09:45', seconds: 2700, plannedSec: 2700, completed: true },
        { id: 'b', modeId: 'code', startedAt: '11:00', endedAt: '11:05', seconds: 300, plannedSec: 2700, completed: false },
        { id: 'c', modeId: 'old-mode', startedAt: '14:00', endedAt: '14:10', seconds: 600, plannedSec: 1500, completed: true },
      ],
    },
    {
      date: '2026-09-10',
      sessions: [
        { id: 'd', modeId: 'read', startedAt: '20:00', endedAt: '20:25', seconds: 1500, plannedSec: 1500, completed: true },
      ],
    },
  ]

  it('累计：按时长倒序，🍅 只数完整轮，未知标签 tag 为 null', () => {
    const aggs = aggregateByTag(days, 0, tags)
    expect(aggs.map(a => a.id)).toEqual(['code', 'read', 'old-mode'])
    const code = aggs[0]
    expect(code.sec).toBe(3000)
    expect(code.pom).toBe(1) // 提前结束的 300s 不计 🍅
    expect(aggs[2].tag).toBeNull()
  })

  it('按时间过滤：fromTs 之前的记录不计入', () => {
    // fromTs 设为 09-12 0 点 → 09-10 的 read 记录被滤掉
    const from = new Date(2026, 8, 12, 0, 0, 0, 0).getTime()
    const aggs = aggregateByTag(days, from, tags)
    expect(aggs.map(a => a.id)).toEqual(['code', 'old-mode'])
  })

  it('tag 命中：未知 id 展示层用 LEGACY_MODES 兜底', () => {
    const aggs = aggregateByTag(days, 0, tags)
    expect(aggs[0].tag?.name).toBe('写代码')
  })
})

describe('periodStart', () => {
  it('今天 = 当日零点', () => {
    const now = new Date(2026, 8, 18, 15, 30)
    const start = periodStart('today', now)
    expect(start).toBe(new Date(2026, 8, 18, 0, 0, 0, 0).getTime())
  })

  it('本周以周一为始', () => {
    // 2026-09-18 是周五 → 周一是 09-14
    const now = new Date(2026, 8, 18, 15, 30)
    const start = periodStart('week', now)
    expect(start).toBe(new Date(2026, 8, 14, 0, 0, 0, 0).getTime())
  })

  it('累计 = 0（不过滤）', () => {
    expect(periodStart('all')).toBe(0)
  })
})

describe('格式化', () => {
  it('formatClock', () => {
    expect(formatClock(0)).toBe('00:00')
    expect(formatClock(45 * 60)).toBe('45:00')
    expect(formatClock(599)).toBe('09:59')
    expect(formatClock(599.2)).toBe('10:00') // 向上取整
    expect(formatClock(-5)).toBe('00:00')
  })

  it('formatDur', () => {
    expect(formatDur(600)).toBe('10m')
    expect(formatDur(5400)).toBe('1h30m')
    expect(formatDur(7200)).toBe('2h')
  })

  it('clockOf', () => {
    expect(clockOf(new Date(2026, 8, 18, 9, 5).getTime())).toBe('09:05')
  })
})

describe('标签存取', () => {
  beforeEach(() => localStorage.clear())

  it('无存档时返回默认标签', () => {
    expect(loadTags()).toEqual(DEFAULT_TAGS)
  })

  it('saveTags → loadTags 往返一致', () => {
    const tags: PomodoroTag[] = [{ id: 'u1', emoji: '🎯', name: '背八股', color: '#ff375f', min: 30 }]
    saveTags(tags)
    expect(loadTags()).toEqual(tags)
  })

  it('存档损坏时兜底为默认', () => {
    localStorage.setItem('pomodoro-tags', '{oops')
    expect(loadTags()).toEqual(DEFAULT_TAGS)
  })
})
