export type Period = 'morning' | 'afternoon' | 'evening'

export interface DiaryRecord {
  id: string
  time: string
  text: string
  period: Period
}

export interface DiaryEntry {
  date: string
  records: DiaryRecord[]
  reflection: string
  moduleData: Record<string, unknown>
  createdAt: number
  updatedAt: number
}

export interface TodoItem {
  id?: string
  text: string
  done: boolean
  /** 封存时刻（ISO）。旧数据无此字段，归档分组时归入「更早」 */
  doneAt?: string
}

export type PomodoroPhase = 'focus' | 'break' | 'longBreak'
// longBreak 仅为旧数据兼容保留的类型成员，UI 不再使用（休息统一 5 分钟短休）

export interface PomodoroSession {
  id: string
  modeId: string
  startedAt: string
  endedAt: string
  seconds: number
  plannedSec: number
  completed: boolean
  // 设计稿：番茄只挂标签、不挂待办。字段保留以兼容历史数据，新记录恒为 undefined
  todoId?: string
  todoText?: string
}

export type { Component } from 'vue'
