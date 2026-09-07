import { describe, expect, it } from 'vitest'
import { combinedDayProgress } from './todoProgress'
import type { CheckinCheck, CheckinItem, CheckinKind, TodoItem } from '@/types'

const item = (id: string, kind: CheckinKind = 'build', active = true): CheckinItem => ({
  id,
  name: id,
  icon: '🔁',
  kind,
  active,
  createdAt: '2026-09-07',
})

const todo = (id: string, done: boolean): TodoItem => ({ id, text: id, done })

const check = (): CheckinCheck => ({ v: 1, at: '08:00' })

describe('combinedDayProgress', () => {
  it('双空返回全 0', () => {
    expect(combinedDayProgress([], [], {})).toEqual({ done: 0, total: 0, pendingTodos: 0, pct: 0 })
  })

  it('仅普通待办：只统计待办', () => {
    const r = combinedDayProgress([todo('a', true), todo('b', false)], [], {})
    expect(r).toEqual({ done: 1, total: 2, pendingTodos: 1, pct: 50 })
  })

  it('仅每日：build 勾选计达成', () => {
    const items = [item('x'), item('y')]
    const r = combinedDayProgress([], items, { x: check() })
    expect(r.done).toBe(1)
    expect(r.total).toBe(2)
    expect(r.pct).toBe(50)
  })

  it('仅每日：quit 未破戒计达成、破戒不计', () => {
    const items = [item('q1', 'quit'), item('q2', 'quit')]
    const r = combinedDayProgress([], items, { q2: check() })
    expect(r.done).toBe(1)
    expect(r.total).toBe(2)
  })

  it('归档的每日项不计入', () => {
    const items = [item('x'), item('gone', 'build', false)]
    const r = combinedDayProgress([], items, {})
    expect(r.total).toBe(1)
  })

  it('混合：普通与每日合并计算', () => {
    const todos = [todo('a', true), todo('b', true), todo('c', false)]
    const items = [item('x'), item('y', 'quit')]
    // 普通 done 2；每日：x 勾选达成、y 未破戒达成 → done 4 / total 5
    const r = combinedDayProgress(todos, items, { x: check() })
    expect(r).toEqual({ done: 4, total: 5, pendingTodos: 1, pct: 80 })
  })
})
