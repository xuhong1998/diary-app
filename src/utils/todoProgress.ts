import { todayProgress } from './checkin'
import type { CheckinCheck, CheckinItem, TodoItem } from '@/types'

export interface CombinedDayProgress {
  /** 普通已完成 + 每日达成（戒断型未破戒计达成） */
  done: number
  /** 普通待办数 + 每日启用项数 */
  total: number
  /** 普通待办未完成数 */
  pendingTodos: number
  pct: number
}

/** 合并 hero 统计：当日普通待办 + 每日待办（打卡）一起算完成度 */
export function combinedDayProgress(
  todos: TodoItem[],
  items: CheckinItem[],
  checks: Record<string, CheckinCheck>
): CombinedDayProgress {
  const c = todayProgress(items, checks)
  const todoDone = todos.filter(t => t.done).length
  const done = todoDone + c.done
  const total = todos.length + c.total
  return {
    done,
    total,
    pendingTodos: todos.length - todoDone,
    pct: total ? Math.round((done / total) * 100) : 0,
  }
}
