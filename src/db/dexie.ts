import Dexie, { type Table } from 'dexie'
import type { DiaryEntry } from '@/types'

export class DiaryDB extends Dexie {
  entries!: Table<DiaryEntry, string>

  constructor() {
    super('diary-app')
    this.version(1).stores({
      entries: 'date, updatedAt',
    })
  }
}

export const db = new DiaryDB()
