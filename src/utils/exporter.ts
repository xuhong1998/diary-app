import { powerSyncDb } from '@/db/powersync'
import { formatDate } from '@/utils/date'
import { parseModuleData } from '@/utils/moduleData'
import type { DiaryEntry, Period } from '@/types'

interface RecordRow {
  id: string
  date: string
  time: string
  text: string
  period: string
}

interface ReflectionRow {
  date: string
  text: string
}

interface ModuleRow {
  date: string
  module_id: string
  data: string
}

export async function exportToJSON(
  mode: 'today' | 'range' | 'all',
  dateFrom?: string,
  dateTo?: string
): Promise<string> {
  let where = 'deleted_at IS NULL'
  const params: string[] = []

  if (mode === 'today') {
    const today = formatDate(new Date())
    where += ' AND date = ?'
    params.push(today)
  } else if (mode === 'range' && dateFrom && dateTo) {
    where += ' AND date BETWEEN ? AND ?'
    params.push(dateFrom, dateTo)
  }

  const records = await powerSyncDb.getAll<RecordRow>(
    `SELECT * FROM records WHERE ${where} ORDER BY date, time`,
    params
  )

  const dates = [...new Set(records.map(r => r.date))].sort()

  if (!dates.length) {
    return JSON.stringify({
      version: 1,
      exportedAt: new Date().toISOString(),
      entries: [],
    }, null, 2)
  }

  const placeholders = dates.map(() => '?').join(',')

  const reflections = await powerSyncDb.getAll<ReflectionRow>(
    `SELECT * FROM reflections WHERE date IN (${placeholders})`,
    dates
  )

  const modules = await powerSyncDb.getAll<ModuleRow>(
    `SELECT * FROM modules WHERE date IN (${placeholders}) AND deleted_at IS NULL`,
    dates
  )

  const reflectionMap = new Map(reflections.map(r => [r.date, r.text]))
  const moduleMap = new Map<string, Record<string, unknown>[]>()
  for (const m of modules) {
    if (!moduleMap.has(m.date)) moduleMap.set(m.date, [])
    moduleMap.get(m.date)!.push({ [m.module_id]: parseModuleData(m.data) })
  }

  const entries: DiaryEntry[] = dates.map(date => ({
    date,
    records: records
      .filter(r => r.date === date)
      .map(r => ({ id: r.id, time: r.time, text: r.text, period: r.period as Period })),
    reflection: reflectionMap.get(date) ?? '',
    moduleData: Object.assign({}, ...(moduleMap.get(date) ?? [])),
    createdAt: 0,
    updatedAt: 0,
  }))

  const data = {
    version: 1,
    exportedAt: new Date().toISOString(),
    entries: entries.map(e => ({
      date: e.date,
      records: e.records,
      reflection: e.reflection,
      moduleData: e.moduleData,
    })),
  }

  return JSON.stringify(data, null, 2)
}

export function downloadFile(content: string, filename: string) {
  const blob = new Blob([content], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
