import type { InterviewItem } from '@/types'
import { formatDate, parseDate } from '@/utils/date'

/** 艾宾浩斯复习间隔（天），stage 为数组下标 */
export const REVIEW_INTERVALS = [1, 2, 4, 7, 15, 30, 60]

export const MAX_STAGE = REVIEW_INTERVALS.length - 1

export type ReviewResult = 'good' | 'fuzzy' | 'forgot'

export type Mastery = 'new' | 'learning' | 'mastered'

/** 已通过 stage>=4（即 1/2/4/7 天间隔）视为已掌握 */
export const MASTERED_STAGE = 4

export function addDays(dateStr: string, days: number): string {
  const d = parseDate(dateStr)
  d.setDate(d.getDate() + days)
  return formatDate(d)
}

export function nextStage(stage: number, result: ReviewResult): number {
  if (result === 'forgot') return 0
  if (result === 'fuzzy') return stage
  return Math.min(stage + 1, MAX_STAGE)
}

export function nextReviewDate(stage: number, from: string): string {
  return addDays(from, REVIEW_INTERVALS[stage])
}

/** 复习自评后得到新的条目（纯函数，不修改原对象） */
export function applyReview(item: InterviewItem, result: ReviewResult, today: string): InterviewItem {
  const stage = nextStage(item.stage, result)
  return {
    ...item,
    stage,
    nextReview: nextReviewDate(stage, today),
    lastReview: today,
  }
}

/** 新建条目的初始复习字段：stage 0，明天到期 */
export function initialReviewFields(today: string): Pick<InterviewItem, 'stage' | 'nextReview'> {
  return { stage: 0, nextReview: nextReviewDate(0, today) }
}

export function isDue(item: InterviewItem, today: string): boolean {
  return item.nextReview <= today
}

export function masteryOf(item: InterviewItem): Mastery {
  if (!item.lastReview) return 'new'
  return item.stage >= MASTERED_STAGE ? 'mastered' : 'learning'
}

export interface DueEntry {
  item: InterviewItem
  /** 该条目所属的日期（modules 表按日期存） */
  date: string
}

/** 从所有日期的 interview 模块数据中筛出今天该复习的条目 */
export function dueItems(entries: { date: string; items?: InterviewItem[] }[], today: string): DueEntry[] {
  const due: DueEntry[] = []
  for (const entry of entries) {
    for (const item of entry.items ?? []) {
      if (isDue(item, today)) due.push({ item, date: entry.date })
    }
  }
  due.sort((a, b) => a.item.nextReview.localeCompare(b.item.nextReview))
  return due
}
