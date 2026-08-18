import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { powerSyncDb } from '@/db/powersync'
import { todayStr, nowTime, parseTimeToDate, getPeriod } from '@/utils/date'
import { parseModuleData, serializeModuleData } from '@/utils/moduleData'
import type { DiaryEntry, DiaryRecord, Period } from '@/types'

export { nowTime } from '@/utils/date'

interface RecordRow {
  id: string
  date: string
  time: string
  text: string
  period: Period
  created_at: number
  updated_at: number
  deleted_at: number | null
}

interface ReflectionRow {
  date: string
  text: string
  updated_at: number
}

interface ModuleRow {
  id: string
  date: string
  module_id: string
  data: string
  updated_at: number
  deleted_at: number | null
}

export const useDiaryStore = defineStore('diary', () => {
  const currentDate = ref(todayStr())
  const entry = ref<DiaryEntry | null>(null)
  const connected = ref(false)

  async function loadEntry(date: string) {
    currentDate.value = date

    try {
      const records = await powerSyncDb.getAll<RecordRow>(
        'SELECT * FROM records WHERE date = ? AND deleted_at IS NULL ORDER BY time',
        [date]
      )
      const reflection = await powerSyncDb.getOptional<ReflectionRow>(
        'SELECT * FROM reflections WHERE date = ? ORDER BY updated_at DESC LIMIT 1',
        [date]
      )
      const modules = await powerSyncDb.getAll<ModuleRow>(
        'SELECT * FROM modules WHERE date = ? AND deleted_at IS NULL',
        [date]
      )

      const moduleData: Record<string, unknown> = {}
      for (const m of modules) {
        moduleData[m.module_id] = parseModuleData(m.data)
      }

      const minTs = records.length
        ? Math.min(...records.map(r => r.created_at))
        : Date.now()

      const maxTs = records.length
        ? Math.max(...records.map(r => r.updated_at))
        : 0

      entry.value = {
        date,
        records: records.map(r => ({
          id: r.id,
          time: r.time,
          text: r.text,
          period: r.period,
        })),
        reflection: reflection?.text ?? '',
        moduleData,
        createdAt: minTs,
        updatedAt: maxTs,
      }
    } catch (e) {
      console.error('[diary] loadEntry failed:', e)
    }
  }

  async function ensureEntry(): Promise<DiaryEntry> {
    if (!entry.value) {
      await loadEntry(currentDate.value)
    }
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

  async function addRecord(text: string, time?: string) {
    if (!text.trim()) return
    const e = await ensureEntry()
    const t = time || nowTime()
    const id = crypto.randomUUID()
    const now = Date.now()

    try {
      await powerSyncDb.execute(
        'INSERT INTO records (id, date, time, text, period, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [id, e.date, t, text.trim(), getPeriod(parseTimeToDate(t)), now, now]
      )

      e.records.push({ id, time: t, text: text.trim(), period: getPeriod(parseTimeToDate(t)) })
      e.records.sort((a, b) => a.time.localeCompare(b.time))
      e.updatedAt = now
    } catch (err) {
      console.error('[diary] addRecord failed:', err)
      throw err
    }
  }

  async function updateRecord(id: string, updates: { text?: string; time?: string }) {
    if (!entry.value) return
    const r = entry.value.records.find(r => r.id === id)
    if (!r) return
    const now = Date.now()

    let newTime = r.time
    let newPeriod = r.period
    if (updates.time !== undefined) {
      newTime = updates.time
      newPeriod = getPeriod(parseTimeToDate(updates.time))
    }
    const newText = updates.text !== undefined ? updates.text.trim() : r.text

    try {
      await powerSyncDb.execute(
        'UPDATE records SET text = ?, time = ?, period = ?, updated_at = ? WHERE id = ?',
        [newText, newTime, newPeriod, now, id]
      )

      r.text = newText
      r.time = newTime
      r.period = newPeriod
      entry.value.records.sort((a, b) => a.time.localeCompare(b.time))
      entry.value.updatedAt = now
    } catch (err) {
      console.error('[diary] updateRecord failed:', err)
      throw err
    }
  }

  async function deleteRecord(id: string) {
    if (!entry.value) return
    const now = Date.now()

    try {
      await powerSyncDb.execute(
        'UPDATE records SET deleted_at = ? WHERE id = ?',
        [now, id]
      )

      entry.value.records = entry.value.records.filter(r => r.id !== id)
      entry.value.updatedAt = now
    } catch (err) {
      console.error('[diary] deleteRecord failed:', err)
      throw err
    }
  }

  async function updateReflection(text: string) {
    const e = await ensureEntry()
    const now = Date.now()

    try {
      const existing = await powerSyncDb.getOptional<{ id: string }>(
        'SELECT id FROM reflections WHERE date = ? ORDER BY updated_at DESC LIMIT 1',
        [e.date]
      )

      if (existing) {
        await powerSyncDb.execute(
          'UPDATE reflections SET text = ?, updated_at = ? WHERE id = ?',
          [text, now, existing.id]
        )
      } else {
        await powerSyncDb.execute(
          'INSERT INTO reflections (id, date, text, updated_at) VALUES (?, ?, ?, ?)',
          [crypto.randomUUID(), e.date, text, now]
        )
      }

      e.reflection = text
      e.updatedAt = now
    } catch (err) {
      console.error('[diary] updateReflection failed:', err)
      throw err
    }
  }

  async function updateModuleData(moduleId: string, data: unknown, date?: string) {
    const targetDate = date ?? currentDate.value
    const e = targetDate === currentDate.value ? await ensureEntry() : null
    const now = Date.now()
    const dataStr = serializeModuleData(data)

    try {
      const existing = await powerSyncDb.getOptional<{ id: string }>(
        'SELECT id FROM modules WHERE date = ? AND module_id = ? AND deleted_at IS NULL',
        [targetDate, moduleId]
      )

      if (existing) {
        await powerSyncDb.execute(
          'UPDATE modules SET data = ?, updated_at = ? WHERE id = ?',
          [dataStr, now, existing.id]
        )
      } else {
        await powerSyncDb.execute(
          'INSERT INTO modules (id, date, module_id, data, updated_at) VALUES (?, ?, ?, ?, ?)',
          [crypto.randomUUID(), targetDate, moduleId, dataStr, now]
        )
      }

      if (e) {
        e.moduleData[moduleId] = data
        e.updatedAt = now
      }
    } catch (err) {
      console.error('[diary] updateModuleData failed:', err)
      throw err
    }
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
    try {
      const rows = await powerSyncDb.getAll<{ date: string }>(
        `SELECT DISTINCT date FROM (
          SELECT date FROM records WHERE deleted_at IS NULL
          UNION SELECT date FROM reflections WHERE text != ''
          UNION SELECT date FROM modules WHERE deleted_at IS NULL
        ) ORDER BY date DESC`
      )
      return rows.map(r => r.date)
    } catch (e) {
      console.error('[diary] getDateList failed:', e)
      return []
    }
  }

  function updateConnectionStatus() {
    connected.value = powerSyncDb.currentStatus?.connected ?? false
  }

  async function searchRecords(keyword: string): Promise<{ date: string; time: string; text: string; period: Period }[]> {
    if (!keyword.trim()) return []
    try {
      const rows = await powerSyncDb.getAll<{ date: string; time: string; text: string; period: Period }>(
        `SELECT date, time, text, period FROM records WHERE deleted_at IS NULL AND text LIKE ? ORDER BY date DESC, time`,
        [`%${keyword.trim()}%`]
      )
      return rows
    } catch (e) {
      console.error('[diary] searchRecords failed:', e)
      return []
    }
  }

  return {
    currentDate,
    entry,
    groupedRecords,
    connected,
    loadEntry,
    addRecord,
    updateRecord,
    deleteRecord,
    updateReflection,
    updateModuleData,
    getDateList,
    updateConnectionStatus,
    searchRecords,
  }
})
