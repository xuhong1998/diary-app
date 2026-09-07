import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { formatDate, todayStr } from '@/utils/date'

const { updateModuleData, getOptional } = vi.hoisted(() => ({
  updateModuleData: vi.fn(
    async (_moduleId: string, _data: { sessions: Array<Record<string, unknown>> }, _date?: string) => {}
  ),
  getOptional: vi.fn(async (_sql: string, _params?: unknown[]) => null),
}))

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
      focusDate: todayStr(),
      focusDone: 1,
      modeId: 'classic',
      ...over,
    })
  )
}

function recordedSessions() {
  return updateModuleData.mock.calls.map(([moduleId, data]) => ({ moduleId, data }))
}

beforeEach(() => {
  localStorage.clear()
  updateModuleData.mockClear()
  getOptional.mockClear()
})

describe('待机显示', () => {
  it('idle 时大钟显示计划时长、圆环为空（H2）', () => {
    const pom = makeStore()
    expect(pom.timerState).toBe('idle')
    expect(pom.clock).toBe('25:00')
    expect(pom.progress).toBe(0)
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
    expect(data.sessions[0].seconds).toBe(1500)
    expect(data.sessions[0].completed).toBe(true)

    // 补记后回到待机、持久化被清、轮次 +1
    expect(pom.timerState).toBe('idle')
    expect(pom.focusDone).toBe(2)
    expect(localStorage.getItem(STATE_KEY)).toBeNull()

    // 再次"重启应用"不重复补记
    makeStore()
    await flush()
    expect(updateModuleData).toHaveBeenCalledTimes(1)
  })

  it('补记的会话保留待办关联（M1）', async () => {
    seedState({ todoId: 'todo-1', todoText: '写周报' })
    makeStore()
    await flush()

    const { data } = recordedSessions()[0]
    expect(data.sessions[0].todoId).toBe('todo-1')
    expect(data.sessions[0].todoText).toBe('写周报')
  })

  it('跨零点的专注归档到开始那天', async () => {
    const started = new Date()
    started.setDate(started.getDate() - 1)
    started.setHours(23, 50, 0, 0)
    seedState({ phaseStartedAt: started.getTime(), endAt: Date.now() - 5_000 })
    makeStore()
    await flush()

    const { data } = recordedSessions()[0]
    const [, , date] = updateModuleData.mock.calls[0]
    expect(date).toBe(formatDate(started))
    expect(data.sessions[0].startedAt).toBe('23:50')
  })
})

describe('skip', () => {
  it('满 1 分钟的提前结束计一轮并进入休息', async () => {
    seedState({
      state: 'paused',
      endAt: 0,
      remainingMs: 1_500_000 - 90_000,
      phaseStartedAt: Date.now() - 90_000,
      focusDone: 0,
    })
    const pom = makeStore()
    expect(pom.timerState).toBe('paused')

    pom.skip()
    await flush()

    expect(pom.focusDone).toBe(1)
    expect(pom.phase).toBe('break')
    const { data } = recordedSessions()[0]
    expect(data.sessions[0].seconds).toBe(90)
    expect(data.sessions[0].completed).toBe(false)

    pom.reset()
  })

  it('不足 1 分钟的提前结束不记录也不计轮', () => {
    seedState({
      state: 'paused',
      endAt: 0,
      remainingMs: 1_500_000 - 30_000,
      phaseStartedAt: Date.now() - 30_000,
      focusDone: 0,
    })
    const pom = makeStore()

    pom.skip()

    expect(updateModuleData).not.toHaveBeenCalled()
    expect(pom.focusDone).toBe(0)
    expect(pom.phase).toBe('break')

    pom.reset()
  })
})
