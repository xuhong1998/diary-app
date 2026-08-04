import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { db } from '@/db/dexie'
import type { DiaryEntry, DiaryRecord, Period } from '@/types'

function todayStr(): string {
  const d = new Date()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

export function getPeriod(date = new Date()): Period {
  const h = date.getHours()
  if (h < 12) return 'morning'
  if (h < 18) return 'afternoon'
  return 'evening'
}

export function nowTime(): string {
  const d = new Date()
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function parseTimeToDate(time: string): Date {
  const [h, m] = time.split(':').map(Number)
  const d = new Date()
  d.setHours(h || 0, m || 0, 0, 0)
  return d
}

export const useDiaryStore = defineStore('diary', () => {
  const currentDate = ref(todayStr())
  const entry = ref<DiaryEntry | null>(null)

  async function loadEntry(date: string) {
    currentDate.value = date
    const found = await db.entries.get(date)
    entry.value = found ?? null
  }

  async function ensureEntry(): Promise<DiaryEntry> {
    if (!entry.value) {
      const now = Date.now()
      entry.value = {
        date: currentDate.value,
        records: [],
        reflection: '',
        moduleData: {},
        createdAt: now,
        updatedAt: now,
      }
    }
    return entry.value
  }

  async function save() {
    if (!entry.value) return
    entry.value.updatedAt = Date.now()
    const plain = JSON.parse(JSON.stringify(entry.value))
    await db.entries.put(plain)
  }

  async function addRecord(text: string, time?: string) {
    if (!text.trim()) return
    const e = await ensureEntry()
    const t = time || nowTime()
    e.records.push({
      id: crypto.randomUUID(),
      time: t,
      text: text.trim(),
      period: getPeriod(parseTimeToDate(t)),
    })
    await save()
  }

  async function updateRecord(id: string, updates: { text?: string; time?: string }) {
    if (!entry.value) return
    const r = entry.value.records.find(r => r.id === id)
    if (!r) return
    if (updates.text !== undefined) r.text = updates.text.trim()
    if (updates.time !== undefined) {
      r.time = updates.time
      r.period = getPeriod(parseTimeToDate(updates.time))
    }
    await save()
  }

  async function deleteRecord(id: string) {
    if (!entry.value) return
    entry.value.records = entry.value.records.filter(r => r.id !== id)
    await save()
  }

  async function updateReflection(text: string) {
    const e = await ensureEntry()
    e.reflection = text
    await save()
  }

  async function updateModuleData(moduleId: string, data: any) {
    const e = await ensureEntry()
    e.moduleData[moduleId] = data
    await save()
  }

  const groupedRecords = computed(() => {
    const groups: Record<Period, DiaryRecord[]> = {
      morning: [],
      afternoon: [],
      evening: [],
    }
    if (entry.value) {
      for (const r of entry.value.records) {
        groups[r.period].push(r)
      }
      for (const p of Object.keys(groups) as Period[]) {
        groups[p].sort((a, b) => a.time.localeCompare(b.time))
      }
    }
    return groups
  })

  async function getDateList(): Promise<string[]> {
    const all = await db.entries.orderBy('date').reverse().toArray()
    return all.map(e => e.date)
  }

  return {
    currentDate,
    entry,
    groupedRecords,
    loadEntry,
    addRecord,
    updateRecord,
    deleteRecord,
    updateReflection,
    updateModuleData,
    getDateList,
  }
})
