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
  moduleData: Record<string, any>
  createdAt: number
  updatedAt: number
}

export interface TodoItem {
  text: string
  done: boolean
}

export interface AlgorithmProblem {
  title: string
  difficulty: 'easy' | 'medium' | 'hard'
  tags: string[]
  note?: string
}

export type { Component } from 'vue'
