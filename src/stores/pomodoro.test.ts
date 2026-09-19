import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { formatDate } from '@/utils/date'

/** 假库：modules blob 按 date 存取，供「+5 分钟」的延长路径读到刚写的记录 */
const { updateModuleData, getOptional, blob } = vi.hoisted(() => {
  const blob: Record<string, string> = {}
  return {
    blob,
    updateModuleData: vi.fn(async (_moduleId: string, data: { sessions: Array<Record<string, unknown>> }, date?: string) => {
      if (date) blob[date] = JSON.stringify(data)
    }),
    getOptional: vi.fn(async (_sql: string, params?: unknown[]) => {
      const date = params?.[0] as string | undefined
      return date && blob[date] ? { data: blob[date] } : null
    }),
  }
})

vi.mock('@/db/powersync', () => ({
  powerSyncDb: { getOptional, getAll: vi.fn(async () => []) },
}))

vi.mock('@/stores/diary', () => ({
  useDiaryStore: () => ({ updateModuleData }),
}))

vi.mock('@/utils/notify', () => ({
  playChime: vi.fn(),
  vibrate: vi.fn(),
  sendNotification: vi.fn(),
  requestNotifyPermission: vi.fn(async () => false),
  unlockAudio: vi.fn(),
  installAudioUnlock: vi.fn(),
}))

vi.mock('@/utils/toast', () => ({
  toast: vi.fn(),
  toastMessage: vi.fn(),
}))

import { usePomodoroStore } from './pomodoro'

const STATE_KEY = 'pomodoro-timer-state'

/** 每个用例用全新 pinia 实例化 store，模拟"重新打开应用" */
function makeStore() {
  setActivePinia(createPinia())
  return usePomodoroStore()
}

/** 放空一个宏任务，让补记链（getOptional → updateModuleData → then）全部落地 */
function flush() {
  return new Promise(resolve => setTimeout(resolve, 0))
}

function seedState(over: Record<string, unknown>) {
  localStorage.setItem(
    STATE_KEY,
    JSON.stringify({
      phase: 'focus',
      state: 'running',
      endAt: Date.now() - 60_000,
      remainingMs: 0,
      phaseStartedAt: Date.now() - 60_000 - 1_500_000,
      ...over,
    })
  )
}

beforeEach(() => {
  localStorage.clear()
  for (const k of Object.keys(blob)) delete blob[k]
  updateModuleData.mockClear()
  getOptional.mockClear()
})

describe('待机显示', () => {
  it('idle 时大钟显示当前标签的计划时长、圆环为满', () => {
    const pom = makeStore()
    expect(pom.stage).toBe('idle')
    // 默认第一个标签：写代码 45 分钟
    expect(pom.curTag.min).toBe(45)
    expect(pom.clock).toBe('45:00')
    expect(pom.progressFrac).toBe(1)
  })
})

describe('计时与到点三选一', () => {
  it('到点后停在 done 并记一轮完整 🍅，不自动进入休息', async () => {
    vi.useFakeTimers()
    try {
      const pom = makeStore()
      pom.start()
      expect(pom.stage).toBe('focus')

      // 走完整一轮
      await vi.advanceTimersByTimeAsync(45 * 60 * 1000)

      expect(pom.stage).toBe('done')
      expect(updateModuleData).toHaveBeenCalledTimes(1)
      const [moduleId, data, date] = updateModuleData.mock.calls[0]
      expect(moduleId).toBe('pomodoro')
      expect(date).toBe(formatDate(new Date()))
      expect(data.sessions[0].completed).toBe(true)

      // 三选一：开始休息
      pom.startRest()
      expect(pom.stage).toBe('break')

      // 休息 5 分钟到点回 idle
      await vi.advanceTimersByTimeAsync(5 * 60 * 1000)
      expect(pom.stage).toBe('idle')
      // 休息不记账
      expect(updateModuleData).toHaveBeenCalledTimes(1)
    } finally {
      vi.useRealTimers()
    }
  })

  it('+5 分钟延长本轮：时长加长，🍅 不变', async () => {
    vi.useFakeTimers()
    try {
      const pom = makeStore()
      pom.start()
      await vi.advanceTimersByTimeAsync(45 * 60 * 1000)
      expect(pom.stage).toBe('done')

      pom.addTime()
      expect(pom.stage).toBe('focus')

      // 再走 5 分钟到点：不新记一条，原地改长原记录（仍然只有 1 个 🍅）
      await vi.advanceTimersByTimeAsync(5 * 60 * 1000 + 1000)
      expect(pom.stage).toBe('done')
      const [extModule, extData, extDate] = updateModuleData.mock.calls.at(-1)!
      expect(extModule).toBe('pomodoro')
      expect(extDate).toBe(formatDate(new Date()))
      expect(extData.sessions).toHaveLength(1)
      expect(extData.sessions[0].seconds).toBe(50 * 60) // 45 + 5
      expect(extData.sessions[0].completed).toBe(true)
    } finally {
      vi.useRealTimers()
    }
  })

  it('满 1 分钟的提前结束记时长但 🍅 +0', async () => {
    vi.useFakeTimers()
    try {
      const pom = makeStore()
      pom.start()
      await vi.advanceTimersByTimeAsync(90_000)
      pom.stop()
      await vi.advanceTimersByTimeAsync(0) // 让补记链落地

      expect(pom.stage).toBe('idle')
      expect(updateModuleData).toHaveBeenCalledTimes(1)
      const [m1, d1] = updateModuleData.mock.calls[0]
      expect(m1).toBe('pomodoro')
      expect(d1.sessions[0].seconds).toBe(90)
      expect(d1.sessions[0].completed).toBe(false)
    } finally {
      vi.useRealTimers()
    }
  })

  it('不足 1 分钟的提前结束不记录', async () => {
    vi.useFakeTimers()
    try {
      const pom = makeStore()
      pom.start()
      await vi.advanceTimersByTimeAsync(30_000)
      pom.stop()
      await vi.advanceTimersByTimeAsync(0)

      expect(pom.stage).toBe('idle')
      expect(updateModuleData).not.toHaveBeenCalled()
    } finally {
      vi.useRealTimers()
    }
  })

  it('暂停后不倒计时，继续后接着走', async () => {
    vi.useFakeTimers()
    try {
      const pom = makeStore()
      pom.start()
      await vi.advanceTimersByTimeAsync(60_000)
      pom.pause()
      const left = pom.leftSec
      await vi.advanceTimersByTimeAsync(120_000)
      expect(pom.leftSec).toBe(left) // 暂停期间不动
      pom.resume()
      await vi.advanceTimersByTimeAsync(60_000)
      expect(pom.leftSec).toBeLessThan(left)
      expect(pom.stage).toBe('focus')
    } finally {
      vi.useRealTimers()
    }
  })
})

describe('标签', () => {
  it('idle 时可切换标签，计划时长跟着走；新建标签直接选中并持久化', () => {
    const pom = makeStore()
    pom.selectTag('read')
    expect(pom.curTag.min).toBe(25)
    expect(pom.clock).toBe('25:00')

    pom.addTag({ id: 'u1', emoji: '🎯', name: '新标签', color: '#ff375f', min: 15 })
    expect(pom.tagId).toBe('u1')
    expect(pom.clock).toBe('15:00')
    expect(JSON.parse(localStorage.getItem('pomodoro-tags') || '[]').some((t: { id: string }) => t.id === 'u1')).toBe(true)
  })

  it('计时中不允许切换标签', async () => {
    vi.useFakeTimers()
    try {
      const pom = makeStore()
      pom.start()
      pom.selectTag('read')
      expect(pom.curTag.id).toBe('code')
    } finally {
      vi.useRealTimers()
    }
  })
})

describe('restore 补记', () => {
  it('过期专注只补记一次，并清掉持久化状态（H1）', async () => {
    const startedAt = Date.now() - 60_000 - 1_500_000
    seedState({ phaseStartedAt: startedAt })
    const pom = makeStore()
    await flush()

    expect(updateModuleData).toHaveBeenCalledTimes(1)
    const [moduleId, data, date] = updateModuleData.mock.calls[0]
    expect(moduleId).toBe('pomodoro')
    expect(date).toBe(formatDate(new Date(startedAt)))
    expect(data.sessions).toHaveLength(1)
    expect(data.sessions[0].completed).toBe(true)

    // 补记后回到待机、持久化被清
    expect(pom.stage).toBe('idle')
    expect(localStorage.getItem(STATE_KEY)).toBeNull()

    // 再次"重启应用"不重复补记
    makeStore()
    await flush()
    expect(updateModuleData).toHaveBeenCalledTimes(1)
  })

  it('跨零点的专注归档到开始那天', async () => {
    const started = new Date()
    started.setDate(started.getDate() - 1)
    started.setHours(23, 50, 0, 0)
    seedState({ phaseStartedAt: started.getTime(), endAt: Date.now() - 5_000 })
    makeStore()
    await flush()

    const [m2, d2, date] = updateModuleData.mock.calls[0]
    expect(m2).toBe('pomodoro')
    expect(date).toBe(formatDate(started))
    expect(d2.sessions[0].startedAt).toBe('23:50')
  })

  it('未过期的暂停状态原样恢复', () => {
    seedState({
      state: 'paused',
      endAt: 0,
      remainingMs: 1_000_000,
      phaseStartedAt: Date.now() - 100_000,
    })
    const pom = makeStore()
    expect(pom.stage).toBe('focus')
    expect(pom.paused).toBe(true)
    expect(pom.clock).toBe('16:40')
  })
})
