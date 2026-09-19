import { parseModuleData } from '@/utils/moduleData'
import type { PomodoroSession } from '@/types'

/**
 * 番茄钟工具层。
 * 设计稿口径：番茄只挂标签、不挂待办；🍅 只数完整轮，提前结束满 1 分钟记时长但 +0。
 * 标签是 UI 配置（存 localStorage），session 仍按既有 blob 结构写 modules 表。
 */

export interface PomodoroTag {
  id: string
  emoji: string
  name: string
  color: string
  min: number
}

export const TAGS_KEY = 'pomodoro-tags'

export const DEFAULT_TAGS: PomodoroTag[] = [
  { id: 'code', emoji: '💻', name: '写代码', color: '#00c7be', min: 45 },
  { id: 'write', emoji: '📝', name: '写作', color: '#32ade6', min: 45 },
  { id: 'study', emoji: '📚', name: '学习', color: '#7d7aff', min: 30 },
  { id: 'read', emoji: '📖', name: '阅读', color: '#ff9f0a', min: 25 },
  { id: 'sport', emoji: '🏃', name: '运动', color: '#30d158', min: 30 },
  { id: 'misc', emoji: '🗂', name: '杂事', color: '#8e93a3', min: 25 },
]

/** 旧版三模式的 modeId → 展示兜底（历史 session 里还会出现） */
export const LEGACY_MODES: Record<string, { emoji: string; name: string }> = {
  classic: { emoji: '🍅', name: '经典' },
  deep: { emoji: '🌊', name: '深度专注' },
  sprint: { emoji: '⚡️', name: '短冲刺' },
}

export function loadTags(): PomodoroTag[] {
  try {
    const raw = localStorage.getItem(TAGS_KEY)
    if (!raw) return [...DEFAULT_TAGS]
    const parsed = JSON.parse(raw) as PomodoroTag[]
    if (!Array.isArray(parsed) || !parsed.length) return [...DEFAULT_TAGS]
    return parsed.filter(t => t && typeof t.id === 'string' && typeof t.name === 'string')
  } catch {
    return [...DEFAULT_TAGS]
  }
}

export function saveTags(tags: PomodoroTag[]) {
  try {
    localStorage.setItem(TAGS_KEY, JSON.stringify(tags))
  } catch {}
}

/** 新建标签弹层的可选项 */
export const TAG_EMOJIS = ['💻', '📝', '📚', '📖', '🏃', '🗂', '🎯', '🎨', '🎵', '🧪', '🌱', '🧠']
export const TAG_COLORS = ['#00c7be', '#32ade6', '#7d7aff', '#ff9f0a', '#30d158', '#ff375f']
export const TAG_MINS = [15, 25, 30, 45, 60]

/** 短休全局 5 分钟 —— 休息不属于哪个标签 */
export const REST_SEC = 5 * 60
/** 满 1 分钟才值得记一笔 */
export const MIN_RECORD_SEC = 60

// ---------- session 解析 ----------

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

// ---------- 统计聚合（今天 / 本周 / 累计 × 标签） ----------

function startOfToday(now = new Date()): number {
  const d = new Date(now)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

/** 周一为一周之始 */
function startOfWeek(now = new Date()): number {
  const d = new Date(now)
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() - (d.getDay() + 6) % 7)
  return d.getTime()
}

export type StatsPeriod = 'today' | 'week' | 'all'

export function periodStart(period: StatsPeriod, now = new Date()): number {
  if (period === 'today') return startOfToday(now)
  if (period === 'week') return startOfWeek(now)
  return 0
}

export interface TagAgg {
  id: string
  /** 命中的标签；旧数据 / 已删标签为 null，展示层用 LEGACY_MODES 或「•」兜底 */
  tag: PomodoroTag | null
  sec: number
  pom: number
}

/** 按 ts ≥ fromTs 过滤后按 tag 聚合，按时长倒序 */
export function aggregateByTag(days: PomodoroDay[], fromTs: number, tags: PomodoroTag[]): TagAgg[] {
  const map = new Map<string, TagAgg>()
  for (const d of days) {
    for (const s of d.sessions) {
      if (!s) continue
      const startedAtMs = sessionStartMs(d.date, s.startedAt)
      if (startedAtMs !== null && startedAtMs < fromTs) continue
      const a = map.get(s.modeId) ?? { id: s.modeId, tag: null, sec: 0, pom: 0 }
      a.sec += s.seconds
      a.pom += s.completed ? 1 : 0
      map.set(s.modeId, a)
    }
  }
  return [...map.values()]
    .map(a => ({ ...a, tag: tags.find(t => t.id === a.id) ?? null }))
    .sort((x, y) => y.sec - x.sec)
}

/** 由 date + 'HH:MM' 还原时间戳（只用于统计过滤；跨月/夏时制误差对分桶无影响） */
function sessionStartMs(date: string, clock: string): number | null {
  const [y, m, d] = date.split('-').map(Number)
  const [hh, mm] = clock.split(':').map(Number)
  if (!y || !m || !d || Number.isNaN(hh) || Number.isNaN(mm)) return null
  return new Date(y, m - 1, d, hh, mm).getTime()
}

// ---------- 格式化 ----------

export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.ceil(totalSeconds))
  const m = Math.floor(s / 60)
  const r = s % 60
  return `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`
}

/** 时长主格式：45m / 1h30m / 2h */
export function formatDur(sec: number): string {
  const m = Math.round(sec / 60)
  const h = Math.floor(m / 60)
  const mm = m % 60
  if (h) return mm ? `${h}h${mm}m` : `${h}h`
  return `${mm}m`
}

export function clockOf(epochMs: number): string {
  const d = new Date(epochMs)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}
