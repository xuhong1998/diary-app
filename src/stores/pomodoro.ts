import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { useDiaryStore } from '@/stores/diary'
import { powerSyncDb } from '@/db/powersync'
import { formatDate } from '@/utils/date'
import { toast } from '@/utils/toast'
import {
  loadTags,
  saveTags,
  parsePomodoroData,
  formatClock,
  clockOf,
  REST_SEC,
  MIN_RECORD_SEC,
  DEFAULT_TAGS,
  type PomodoroTag,
} from '@/utils/pomodoro'
import {
  playChime,
  vibrate,
  sendNotification,
  unlockAudio,
  installAudioUnlock,
} from '@/utils/notify'
import type { PomodoroSession } from '@/types'

/**
 * 番茄钟 store —— 设计稿状态机：
 *   idle ──点圆环──▶ focus ──到点──▶ done ──┬─ 开始休息 ─▶ break ──到点──▶ idle
 *                                          ├─ +5 分钟 ─▶ focus（时长延长，🍅 不变）
 *                                          └─ 结束 ────▶ idle
 * 记账口径：🍅 只数完整轮；提前结束满 1 分钟记时长但 🍅 +0；+5 分钟只加时长。
 * 时间戳算剩余：切页 / 后台 / 关页都不漂。写库结构与 recordFocusSession 保持不变。
 */

export type PomodoroStage = 'idle' | 'focus' | 'break' | 'done'

const STATE_KEY = 'pomodoro-timer-state'
const TAG_KEY = 'pomodoro-mode' // 沿用旧 key：记住上次用的标签

/** 本标签页唯一标识，用于多标签互斥（Web Locks 为主，storage 事件兜底） */
const TAB_ID = crypto.randomUUID()

interface PersistedState {
  phase: 'focus' | 'break'
  state: 'running' | 'paused'
  endAt: number
  remainingMs?: number
  phaseStartedAt: number
  tagId?: string
  tabId?: string
}

export const usePomodoroStore = defineStore('pomodoro', () => {
  // ---------- 标签 ----------
  const tags = ref<PomodoroTag[]>(loadTags())
  const tagId = ref(loadTagId())

  function loadTagId(): string {
    try {
      const saved = localStorage.getItem(TAG_KEY)
      if (saved && tags.value.some(t => t.id === saved)) return saved
    } catch {}
    return tags.value[0]?.id ?? DEFAULT_TAGS[0].id
  }

  function persistTags() {
    saveTags(tags.value)
  }

  function addTag(tag: PomodoroTag) {
    tags.value = [...tags.value, tag]
    persistTags()
    tagId.value = tag.id // 新建完直接选中它，可以马上开一个
    try {
      localStorage.setItem(TAG_KEY, tag.id)
    } catch {}
  }

  function selectTag(id: string) {
    if (stage.value !== 'idle') return
    if (!tags.value.some(t => t.id === id)) return
    tagId.value = id
    try {
      localStorage.setItem(TAG_KEY, id)
    } catch {}
  }

  const curTag = computed<PomodoroTag>(() => tags.value.find(t => t.id === tagId.value) ?? tags.value[0] ?? DEFAULT_TAGS[0])

  // ---------- 计时状态 ----------
  const stage = ref<PomodoroStage>('idle')
  const paused = ref(false)
  const totalSec = ref(0)
  const leftSec = ref(0)
  const deadline = ref(0)
  const phaseStartedAt = ref(0)
  const now = ref(Date.now())
  /** 另一标签页正在计时：本标签只读展示，不接管、不写库 */
  const mirrored = ref(false)

  let ticker: number | undefined

  const clock = computed(() => {
    const base = stage.value === 'idle' ? curTag.value.min * 60 : leftSec.value
    return formatClock(base)
  })

  /** 圆环 offset（C 由视图层算）；done 时视图层置 0 配合 CSS 变淡 */
  const progressFrac = computed(() => {
    const total = stage.value === 'idle' ? curTag.value.min * 60 : totalSec.value
    const left = stage.value === 'idle' ? total : leftSec.value
    return total ? Math.min(1, Math.max(0, left / total)) : 1
  })

  function ensureTicker() {
    if (ticker !== undefined) return
    ticker = window.setInterval(() => {
      now.value = Date.now()
      // 镜像标签只走钟面显示，不触发完成/写库
      if (!mirrored.value && !paused.value && (stage.value === 'focus' || stage.value === 'break')) {
        leftSec.value = Math.max(0, (deadline.value - now.value) / 1000)
        if (leftSec.value <= 0) complete()
      }
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
      if (!paused.value && (stage.value === 'focus' || stage.value === 'break')) {
        leftSec.value = Math.max(0, (deadline.value - now.value) / 1000)
        if (leftSec.value <= 0) complete()
      }
    })
  }

  if (typeof window !== 'undefined') {
    // 无 Web Locks 环境的兜底：另一标签页写入状态时退让（tabId 字典序大者为主）
    window.addEventListener('storage', e => {
      if (e.key !== STATE_KEY) return
      if (!mirrored.value) {
        try {
          const s = e.newValue ? (JSON.parse(e.newValue) as PersistedState) : null
          if (s?.tabId && s.tabId > TAB_ID && stage.value !== 'idle') becomeMirror(true)
        } catch {}
      } else {
        syncFromPersisted()
      }
    })
  }

  // ---------- 持久化（刷新/关页后恢复） ----------
  function persist() {
    if (stage.value !== 'focus' && stage.value !== 'break') return
    const s: PersistedState = {
      phase: stage.value,
      state: paused.value ? 'paused' : 'running',
      endAt: deadline.value,
      remainingMs: leftSec.value * 1000,
      phaseStartedAt: phaseStartedAt.value,
      tagId: tagId.value,
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
   * 开始时刻/标签在入口同步捕获——complete()/stop() 会在 await 期间覆盖 phaseStartedAt，
   * 晚了就读到休息的开始时刻。记住刚写的这条，供「+5 分钟」原地延长。
   */
  let lastSession: { date: string; id: string } | null = null
  /** 本轮是「+5 分钟」延续下来的：到点不再新记一条，只把原记录的时长加长（🍅 不动） */
  let extendedRound = false

  async function writeSessions(startDate: string, sessions: PomodoroSession[]): Promise<boolean> {
    try {
      await useDiaryStore().updateModuleData('pomodoro', { sessions }, startDate)
      return true
    } catch (e) {
      console.error('[pomodoro] record session failed:', e)
      return false
    }
  }

  async function recordFocusSession(
    seconds: number,
    completed: boolean,
    endedAtEpoch?: number
  ): Promise<boolean> {
    const startedAtMs = phaseStartedAt.value
    const sessionTag = curTag.value
    const startDate = formatDate(new Date(startedAtMs))
    try {
      const row = await powerSyncDb.getOptional<{ data: string }>(
        'SELECT data FROM modules WHERE date = ? AND module_id = ? AND deleted_at IS NULL',
        [startDate, 'pomodoro']
      )
      const sessions = parsePomodoroData(row?.data)
      const s: PomodoroSession = {
        id: crypto.randomUUID(),
        modeId: sessionTag.id,
        startedAt: clockOf(startedAtMs),
        endedAt: clockOf(endedAtEpoch ?? Date.now()),
        seconds: Math.round(seconds),
        plannedSec: Math.round(sessionTag.min * 60),
        completed,
      }
      sessions.push(s)
      lastSession = { date: startDate, id: s.id }
      return await writeSessions(startDate, sessions)
    } catch (e) {
      console.error('[pomodoro] record session failed:', e)
      return false
    }
  }

  /** 「+5 分钟」的记账：把刚才那条记录的时长与结束时刻原地改长，🍅 不动 */
  async function extendLastSession(newSeconds: number): Promise<boolean> {
    if (!lastSession) return false
    try {
      const row = await powerSyncDb.getOptional<{ data: string }>(
        'SELECT data FROM modules WHERE date = ? AND module_id = ? AND deleted_at IS NULL',
        [lastSession.date, 'pomodoro']
      )
      const sessions = parsePomodoroData(row?.data)
      const s = sessions.find(x => x.id === lastSession?.id)
      if (!s) return false
      s.seconds = Math.round(newSeconds)
      s.endedAt = clockOf(Date.now())
      return await writeSessions(lastSession.date, sessions)
    } catch (e) {
      console.error('[pomodoro] extend session failed:', e)
      return false
    }
  }

  /** recordFocusSession 的包装：写库失败时给出可见提示 */
  function recordWithToast(seconds: number, completed: boolean, endedAtEpoch?: number) {
    void recordFocusSession(seconds, completed, endedAtEpoch).then(ok => {
      if (!ok) toast('专注记录保存失败')
    })
  }

  // ---------- 状态机 ----------
  function begin(stage_: 'focus' | 'break', seconds: number) {
    stage.value = stage_
    phaseStartedAt.value = Date.now()
    now.value = Date.now()
    totalSec.value = seconds
    leftSec.value = seconds
    deadline.value = now.value + seconds * 1000
    paused.value = false
    ensureTicker()
    persist()
  }

  function start() {
    if (stage.value !== 'idle' || mirrored.value) return
    unlockAudio()
    begin('focus', curTag.value.min * 60)
  }

  function startRest() {
    if (stage.value !== 'done' || mirrored.value) return
    begin('break', REST_SEC)
  }

  /** 到点后的三选一之二：+5 分钟。把刚才那条记录的时长加长，🍅 不动 */
  function addTime() {
    if (stage.value !== 'done' || mirrored.value) return
    extendedRound = true
    totalSec.value += 300
    leftSec.value += 300
    deadline.value = Date.now() + leftSec.value * 1000
    stage.value = 'focus'
    paused.value = false
    ensureTicker()
    persist()
  }

  /** 阶段自然结束 */
  function complete() {
    if (stage.value !== 'focus' && stage.value !== 'break') return
    if (stage.value === 'focus') {
      if (extendedRound && lastSession) {
        // 延续轮：原地改长那条记录，不再新记一条
        void extendLastSession(totalSec.value).then(ok => {
          if (!ok) toast('专注记录保存失败')
        })
      } else {
        recordWithToast(totalSec.value, true, deadline.value)
      }
      stopTicker()
      stage.value = 'done'
      leftSec.value = 0
      clearPersisted()
      playChime('focus')
      vibrate([200, 100, 200, 100, 300])
      sendNotification('专注完成 🍅', '休息一下，或者再来 5 分钟')
    } else {
      toIdle()
      playChime('break')
      vibrate([150, 100, 150])
      sendNotification('休息结束 ☕️', '准备好了就开始下一轮专注')
    }
  }

  /** 提前结束：满 1 分钟记时长，但 🍅 +0（延续轮则改长原记录） */
  function stop() {
    if (stage.value !== 'focus' && stage.value !== 'break') return
    if (stage.value === 'focus') {
      const done = totalSec.value - leftSec.value
      if (done >= MIN_RECORD_SEC) {
        if (extendedRound && lastSession) {
          void extendLastSession(done).then(ok => {
            if (!ok) toast('专注记录保存失败')
          })
        } else {
          recordWithToast(done, false)
          toast(`已记录 ${Math.round(done / 60)} 分钟专注`)
        }
      }
    }
    toIdle()
  }

  function toIdle() {
    stopTicker()
    releaseLock()
    stage.value = 'idle'
    paused.value = false
    leftSec.value = 0
    extendedRound = false
    clearPersisted()
  }

  function pause() {
    if (stage.value !== 'focus' && stage.value !== 'break') return
    if (paused.value || mirrored.value) return
    now.value = Date.now()
    leftSec.value = Math.max(0, (deadline.value - now.value) / 1000)
    paused.value = true
    stopTicker()
    persist()
  }

  function resume() {
    if (!paused.value || mirrored.value) return
    unlockAudio()
    deadline.value = Date.now() + leftSec.value * 1000
    paused.value = false
    ensureTicker()
    persist()
  }

  // ---------- 多标签互斥 ----------

  let lockHeld = false
  let releaseLockFn: (() => void) | undefined

  /** 请求跨标签锁；拿不到（其他标签在计时）返回 false。环境不支持时恒为 true（单标签假设） */
  function acquireLock(): Promise<boolean> {
    if (typeof navigator === 'undefined' || !navigator.locks?.request) return Promise.resolve(true)
    if (lockHeld) return Promise.resolve(true)
    let grant!: (ok: boolean) => void
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
          grant(true)
          // 持锁直到释放（reset/结束），Promise 悬着即锁不放手
          await new Promise<void>(resolve => {
            releaseLockFn = resolve
          })
          lockHeld = false
          return true
        }
      )
      .catch(() => grant(false))
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
      stage.value = s.phase
      if (s.tagId && tags.value.some(t => t.id === s.tagId)) tagId.value = s.tagId
      deadline.value = s.endAt
      leftSec.value = (s.remainingMs ?? 0) / 1000
      totalSec.value = totalSec.value || curTag.value.min * 60
      phaseStartedAt.value = s.phaseStartedAt
      paused.value = s.state === 'paused'
      now.value = Date.now()
      if (!paused.value) ensureTicker()
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

  function idleLocal() {
    stage.value = 'idle'
    paused.value = false
    leftSec.value = 0
    stopTicker()
  }

  /** 刷新后恢复计时；关闭期间已结束的专注按整段补记（不进 done，直接 idle） */
  function restore() {
    try {
      const raw = localStorage.getItem(STATE_KEY)
      if (!raw) return
      const s = JSON.parse(raw) as PersistedState
      if (!s || typeof s.endAt !== 'number') return
      if (s.tagId && tags.value.some(t => t.id === s.tagId)) tagId.value = s.tagId
      if (s.state === 'paused' && (s.remainingMs ?? 0) > 0) {
        stage.value = s.phase
        leftSec.value = s.remainingMs! / 1000
        totalSec.value = Math.max(leftSec.value, curTag.value.min * 60)
        phaseStartedAt.value = s.phaseStartedAt
        paused.value = true
        persist()
      } else if (s.state === 'running' && s.endAt > Date.now()) {
        stage.value = s.phase
        deadline.value = s.endAt
        totalSec.value = Math.max((s.endAt - s.phaseStartedAt) / 1000, curTag.value.min * 60)
        leftSec.value = (s.endAt - Date.now()) / 1000
        phaseStartedAt.value = s.phaseStartedAt
        paused.value = false
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
        // 否则每次加载都会重复补记同一段专注
        phaseStartedAt.value = s.phaseStartedAt
        totalSec.value = curTag.value.min * 60
        void recordFocusSession(totalSec.value, true, s.endAt).then(ok => {
          clearPersisted()
          if (!ok) toast('专注记录保存失败')
        })
      }
    } catch {}
  }

  restore()
  // 刷新恢复没有用户手势：装一次性监听，首次点击/按键解锁音频
  installAudioUnlock()

  return {
    tags,
    tagId,
    curTag,
    stage,
    paused,
    mirrored,
    totalSec,
    leftSec,
    clock,
    progressFrac,
    addTag,
    selectTag,
    start,
    pause,
    resume,
    stop,
    startRest,
    addTime,
  }
})
