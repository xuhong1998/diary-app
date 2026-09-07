import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { useDiaryStore } from '@/stores/diary'
import { powerSyncDb } from '@/db/powersync'
import { todayStr, formatDate } from '@/utils/date'
import { toast } from '@/utils/toast'
import {
  POMODORO_MODES,
  modeById,
  phaseMinutes,
  breakAfterFocus,
  parsePomodoroData,
  formatClock,
  clockOf,
} from '@/utils/pomodoro'
import {
  playChime,
  vibrate,
  sendNotification,
  requestNotifyPermission,
  unlockAudio,
  installAudioUnlock,
} from '@/utils/notify'
import type { PomodoroPhase, PomodoroSession } from '@/types'

export type TimerState = 'idle' | 'running' | 'paused'

const STATE_KEY = 'pomodoro-timer-state'
const MODE_KEY = 'pomodoro-mode'

/** 本标签页唯一标识，用于多标签互斥（Web Locks 为主，storage 事件兜底） */
const TAB_ID = crypto.randomUUID()

interface PersistedState {
  phase: PomodoroPhase
  state: TimerState
  endAt: number
  remainingMs?: number
  phaseStartedAt: number
  focusDate: string
  focusDone: number
  modeId: string
  todoId?: string
  todoText?: string
  tabId?: string
}

const MIN_RECORD_MS = 60_000

export const usePomodoroStore = defineStore('pomodoro', () => {
  const modeId = ref(loadModeId())
  const phase = ref<PomodoroPhase>('focus')
  const timerState = ref<TimerState>('idle')
  const endAt = ref(0)
  const remainingMs = ref(0)
  const phaseStartedAt = ref(0)
  const focusDone = ref(0)
  const focusDate = ref(todayStr())
  const todoId = ref<string | undefined>(undefined)
  const todoText = ref<string | undefined>(undefined)
  const now = ref(Date.now())
  /** 另一标签页正在计时：本标签只读展示，不接管、不写库 */
  const mirrored = ref(false)

  let ticker: number | undefined

  const mode = computed(() => modeById(modeId.value))
  const isFocus = computed(() => phase.value === 'focus')
  const durationMs = computed(() => phaseMinutes(mode.value, phase.value) * 60_000)

  const remainingMsNow = computed(() =>
    timerState.value === 'running' ? Math.max(0, endAt.value - now.value) : remainingMs.value
  )

  const progress = computed(() =>
    timerState.value === 'idle'
      ? 0
      : durationMs.value
        ? Math.min(1, Math.max(0, 1 - remainingMsNow.value / durationMs.value))
        : 0
  )

  // idle 时显示计划时长（如 25:00）而不是 remainingMs=0 的 00:00，圆环保持空环
  const clock = computed(() =>
    formatClock((timerState.value === 'idle' ? durationMs.value : remainingMsNow.value) / 1000)
  )
  const roundLabel = computed(() => `第 ${focusDone.value + 1} 轮`)

  function loadModeId(): string {
    const saved = localStorage.getItem(MODE_KEY)
    return saved && POMODORO_MODES.some(m => m.id === saved) ? saved : POMODORO_MODES[0].id
  }

  function ensureTicker() {
    if (ticker !== undefined) return
    ticker = window.setInterval(() => {
      now.value = Date.now()
      // 镜像标签只走钟面显示，不触发完成/写库
      if (!mirrored.value && timerState.value === 'running' && now.value >= endAt.value) complete()
    }, 250)
  }

  function stopTicker() {
    if (ticker !== undefined) {
      window.clearInterval(ticker)
      ticker = undefined
    }
  }

  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => {
      now.value = Date.now()
      if (mirrored.value) {
        syncFromPersisted()
        void maybePromote()
        return
      }
      if (timerState.value === 'running' && now.value >= endAt.value) complete()
    })
  }

  if (typeof window !== 'undefined') {
    // 无 Web Locks 环境的兜底：另一标签页写入状态时退让（tabId 字典序大者为主）
    window.addEventListener('storage', e => {
      if (e.key !== STATE_KEY) return
      if (!mirrored.value) {
        try {
          const s = e.newValue ? (JSON.parse(e.newValue) as PersistedState) : null
          if (s?.tabId && s.tabId > TAB_ID && timerState.value !== 'idle') becomeMirror(true)
        } catch {}
      } else {
        syncFromPersisted()
      }
    })
  }

  function persist() {
    const s: PersistedState = {
      phase: phase.value,
      state: timerState.value,
      endAt: endAt.value,
      remainingMs: remainingMs.value,
      phaseStartedAt: phaseStartedAt.value,
      focusDate: focusDate.value,
      focusDone: focusDone.value,
      modeId: modeId.value,
      todoId: todoId.value,
      todoText: todoText.value,
      tabId: TAB_ID,
    }
    try {
      localStorage.setItem(STATE_KEY, JSON.stringify(s))
    } catch {}
  }

  function clearPersisted() {
    try {
      localStorage.removeItem(STATE_KEY)
    } catch {}
  }

  /**
   * 把一次专注追加到它开始那天（跨零点也归开始日）的模块数据里。
   * 开始时刻/模式/待办在入口同步捕获——complete()/skip() 会在 await 期间
   * 立即 beginPhase() 覆盖 phaseStartedAt，晚了就读到休息的开始时刻。
   */
  async function recordFocusSession(
    seconds: number,
    completed: boolean,
    endedAtEpoch?: number
  ): Promise<boolean> {
    const startedAtMs = phaseStartedAt.value
    const sessionMode = mode.value
    const sessionTodoId = todoId.value
    const sessionTodoText = todoText.value
    const startDate = formatDate(new Date(startedAtMs))
    try {
      const row = await powerSyncDb.getOptional<{ data: string }>(
        'SELECT data FROM modules WHERE date = ? AND module_id = ? AND deleted_at IS NULL',
        [startDate, 'pomodoro']
      )
      const sessions = parsePomodoroData(row?.data)
      const s: PomodoroSession = {
        id: crypto.randomUUID(),
        modeId: sessionMode.id,
        startedAt: clockOf(startedAtMs),
        endedAt: clockOf(endedAtEpoch ?? Date.now()),
        seconds: Math.round(seconds),
        plannedSec: Math.round(phaseMinutes(sessionMode, 'focus') * 60),
        completed,
        todoId: sessionTodoId,
        todoText: sessionTodoText,
      }
      sessions.push(s)
      await useDiaryStore().updateModuleData('pomodoro', { sessions }, startDate)
      return true
    } catch (e) {
      console.error('[pomodoro] record session failed:', e)
      return false
    }
  }

  /** recordFocusSession 的包装：写库失败时给出可见提示 */
  function recordWithToast(seconds: number, completed: boolean, endedAtEpoch?: number) {
    void recordFocusSession(seconds, completed, endedAtEpoch).then(ok => {
      if (!ok) toast('专注记录保存失败')
    })
  }

  function rollFocusDate() {
    const t = todayStr()
    if (focusDate.value !== t) {
      focusDate.value = t
      focusDone.value = 0
    }
  }

  function beginPhase(p: PomodoroPhase) {
    phase.value = p
    phaseStartedAt.value = Date.now()
    now.value = Date.now()
    endAt.value = now.value + phaseMinutes(mode.value, p) * 60_000
    timerState.value = 'running'
    ensureTicker()
    persist()
  }

  /** 阶段自然结束时触发 */
  function complete() {
    if (timerState.value !== 'running') return
    if (phase.value === 'focus') {
      const elapsed = durationMs.value
      recordWithToast(elapsed / 1000, true, endAt.value)
      rollFocusDate()
      focusDone.value++
      const next = breakAfterFocus(mode.value, focusDone.value)
      const breakMin = phaseMinutes(mode.value, next)
      playChime('focus')
      vibrate([200, 100, 200, 100, 300])
      sendNotification('专注完成 🍅', `休息 ${breakMin} 分钟，回来继续第 ${focusDone.value + 1} 轮`)
      toast(`专注完成，休息 ${breakMin} 分钟`)
      beginPhase(next)
    } else {
      playChime('break')
      vibrate([150, 100, 150])
      sendNotification('休息结束 ☕', '准备好了就开始下一轮专注')
      toast('休息结束，随时开始下一轮')
      toIdle()
    }
  }

  function toIdle() {
    clearPersisted()
    releaseLock()
    idleLocal()
  }

  /** 回到待机但不触碰持久化/锁（镜像标签退出时用，避免清掉主标签的状态） */
  function idleLocal() {
    phase.value = 'focus'
    timerState.value = 'idle'
    endAt.value = 0
    remainingMs.value = 0
    stopTicker()
  }

  // ---- 多标签互斥 ----

  let lockHeld = false
  let releaseLockFn: (() => void) | undefined

  /** 请求跨标签锁；拿不到（其他标签在计时）返回 false。环境不支持时恒为 true（单标签假设） */
  function acquireLock(): Promise<boolean> {
    if (typeof navigator === 'undefined' || !navigator.locks?.request) return Promise.resolve(true)
    if (lockHeld) return Promise.resolve(true)
    let grant: (ok: boolean) => void
    const granted = new Promise<boolean>(resolve => {
      grant = resolve
    })
    void navigator.locks
      .request(
        'pomodoro-timer',
        { ifAvailable: true },
        async lock => {
          if (!lock) return false
          lockHeld = true
          grant!(true)
          // 持锁直到释放（reset/跳过休息），Promise 悬着即锁不放手
          await new Promise<void>(resolve => {
            releaseLockFn = resolve
          })
          lockHeld = false
          return true
        }
      )
      .catch(() => grant!(false))
    return granted
  }

  function releaseLock() {
    releaseLockFn?.()
    releaseLockFn = undefined
    lockHeld = false
  }

  /** 另一标签页在计时：本标签转入只读镜像模式（quiet 为 true 时不弹提示，如应用启动时） */
  function becomeMirror(quiet = false) {
    if (mirrored.value) return
    mirrored.value = true
    stopTicker()
    syncFromPersisted()
    if (!quiet) toast('计时已在其他窗口运行，此处仅供查看')
  }

  /** 镜像模式：从 localStorage 同步主标签的状态用于展示 */
  function syncFromPersisted() {
    if (!mirrored.value) return
    try {
      const raw = localStorage.getItem(STATE_KEY)
      if (!raw) {
        // 主标签已重置，本标签恢复可操作
        mirrored.value = false
        idleLocal()
        return
      }
      const s = JSON.parse(raw) as PersistedState
      if (!s || typeof s.endAt !== 'number') return
      phase.value = s.phase
      if (s.modeId && POMODORO_MODES.some(m => m.id === s.modeId)) modeId.value = s.modeId
      endAt.value = s.endAt
      remainingMs.value = s.remainingMs ?? 0
      phaseStartedAt.value = s.phaseStartedAt
      focusDate.value = s.focusDate
      focusDone.value = s.focusDone ?? 0
      todoId.value = s.todoId
      todoText.value = s.todoText
      timerState.value = s.state === 'running' ? 'running' : 'paused'
      now.value = Date.now()
      if (timerState.value === 'running') ensureTicker()
    } catch {}
  }

  /** 主标签关闭（锁释放）后，镜像标签回到前台时尝试接管 */
  async function maybePromote() {
    if (!mirrored.value) return
    if (await acquireLock()) {
      mirrored.value = false
      persist()
    }
  }

  async function start() {
    if (timerState.value !== 'idle' || mirrored.value) return
    if (!(await acquireLock())) {
      becomeMirror()
      return
    }
    unlockAudio()
    void requestNotifyPermission()
    rollFocusDate()
    beginPhase('focus')
  }

  function pause() {
    if (timerState.value !== 'running' || mirrored.value) return
    now.value = Date.now()
    remainingMs.value = Math.max(0, endAt.value - now.value)
    timerState.value = 'paused'
    stopTicker()
    persist()
  }

  async function resume() {
    if (timerState.value !== 'paused' || mirrored.value) return
    if (!(await acquireLock())) {
      becomeMirror()
      return
    }
    unlockAudio()
    now.value = Date.now()
    endAt.value = now.value + remainingMs.value
    timerState.value = 'running'
    ensureTicker()
    persist()
  }

  /** 跳过当前阶段：专注阶段按实际时长补记（≥1 分钟）并计一轮，随后进入休息；休息阶段直接结束 */
  function skip() {
    if (timerState.value === 'idle' || mirrored.value) return
    if (phase.value === 'focus') {
      const elapsed =
        timerState.value === 'running' ? durationMs.value - (endAt.value - Date.now()) : durationMs.value - remainingMs.value
      const elapsedClamped = Math.max(0, Math.min(durationMs.value, elapsed))
      rollFocusDate()
      if (elapsedClamped >= MIN_RECORD_MS) {
        recordWithToast(elapsedClamped / 1000, false)
        toast(`已记录 ${Math.round(elapsedClamped / 60000)} 分钟专注`)
        // 计入记录的专注算一轮，与自然完成/恢复补记的节奏一致
        focusDone.value++
      }
      const next = breakAfterFocus(mode.value, focusDone.value)
      beginPhase(next)
    } else {
      toIdle()
    }
  }

  /** 重置计时器：专注进行中的时长不记录 */
  function reset() {
    if (timerState.value === 'idle' || mirrored.value) return
    toIdle()
    toast('已重置')
  }

  function selectMode(id: string) {
    if (timerState.value !== 'idle' || mirrored.value) return
    if (!POMODORO_MODES.some(m => m.id === id)) return
    modeId.value = id
    try {
      localStorage.setItem(MODE_KEY, id)
    } catch {}
  }

  function setTodo(id?: string, text?: string) {
    if (mirrored.value) return
    todoId.value = id
    todoText.value = id ? text : undefined
    if (timerState.value !== 'idle') persist()
  }

  /** 刷新后恢复计时：跨天重置轮次；关闭期间已结束的专注按整段补记 */
  function restore() {
    try {
      const raw = localStorage.getItem(STATE_KEY)
      if (!raw) return
      const s = JSON.parse(raw) as PersistedState
      if (!s || typeof s.endAt !== 'number') return
      if (s.modeId && POMODORO_MODES.some(m => m.id === s.modeId)) modeId.value = s.modeId
      if (s.focusDate === todayStr() && typeof s.focusDone === 'number') {
        focusDate.value = s.focusDate
        focusDone.value = s.focusDone
      }
      if (s.state === 'paused' && (s.remainingMs ?? 0) > 0) {
        phase.value = s.phase
        remainingMs.value = s.remainingMs!
        phaseStartedAt.value = s.phaseStartedAt
        todoId.value = s.todoId
        todoText.value = s.todoText
        timerState.value = 'paused'
        persist()
      } else if (s.state === 'running' && s.endAt > Date.now()) {
        phase.value = s.phase
        endAt.value = s.endAt
        phaseStartedAt.value = s.phaseStartedAt
        todoId.value = s.todoId
        todoText.value = s.todoText
        timerState.value = 'running'
        now.value = Date.now()
        // 其他标签页持有计时锁时转入镜像展示，否则本标签接管续跑
        void acquireLock().then(ok => {
          if (ok) {
            ensureTicker()
          } else {
            becomeMirror(true)
          }
        })
      } else if (s.state === 'running' && s.phase === 'focus' && s.endAt <= Date.now()) {
        // 闭页期间已自然结束：按整段补记一次，随后清掉持久化状态，
        // 否则每次加载都会重复补记同一段专注（H1）
        phaseStartedAt.value = s.phaseStartedAt
        todoId.value = s.todoId
        todoText.value = s.todoText
        const plannedSec = phaseMinutes(modeById(s.modeId), 'focus') * 60
        void recordFocusSession(plannedSec, true, s.endAt).then(ok => {
          clearPersisted()
          if (!ok) toast('专注记录保存失败')
        })
        rollFocusDate()
        focusDone.value++
      }
    } catch {}
  }

  restore()
  // 刷新恢复没有用户手势：装一次性监听，首次点击/按键解锁音频
  installAudioUnlock()

  return {
    modeId,
    mode,
    phase,
    timerState,
    focusDone,
    mirrored,
    todoId,
    todoText,
    isFocus,
    remainingMsNow,
    progress,
    clock,
    roundLabel,
    start,
    pause,
    resume,
    skip,
    reset,
    selectMode,
    setTodo,
  }
})
