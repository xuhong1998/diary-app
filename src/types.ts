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
  text: string
  done: boolean
}

export interface AlgorithmProblem {
  id: string
  title: string
  difficulty: 'easy' | 'medium' | 'hard'
  tags: string[]
  note?: string
  stage: number
  nextReview: string
  lastReview?: string
}

export interface InterviewItem {
  id: string
  topic: string
  category: string
  note: string
  stage: number
  nextReview: string
  lastReview?: string
}

export interface InterviewModuleData {
  items: InterviewItem[]
  summary: string
}

export type CheckinKind = 'build' | 'quit'

export interface CheckinItem {
  id: string
  name: string
  icon: string
  kind: CheckinKind
  active: boolean
  createdAt: string
}

export interface CheckinCheck {
  v: 0 | 1
  at: string
}

export interface CheckinModuleData {
  items: CheckinItem[]
  checks: Record<string, CheckinCheck>
}

export type { Component } from 'vue'
