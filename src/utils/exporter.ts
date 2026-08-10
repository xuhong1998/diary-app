import { powerSyncDb } from '@/db/powersync'
import type { DiaryEntry } from '@/types'

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

  const entries: DiaryEntry[] = []
  for (const date of dates) {
    const dateRecords = records
      .filter(r => r.date === date)
      .map(r => ({ id: r.id, time: r.time, text: r.text, period: r.period as any }))

    const reflection = await powerSyncDb.getOptional<ReflectionRow>(
      'SELECT * FROM reflections WHERE date = ?',
      [date]
    )

    const modules = await powerSyncDb.getAll<ModuleRow>(
      'SELECT * FROM modules WHERE date = ? AND deleted_at IS NULL',
      [date]
    )

    const moduleData: Record<string, any> = {}
    for (const m of modules) {
      try {
        let parsed: any = typeof m.data === 'string' ? JSON.parse(m.data) : m.data
        if (typeof parsed === 'string') parsed = JSON.parse(parsed)
        moduleData[m.module_id] = parsed
      } catch {
        moduleData[m.module_id] = {}
      }
    }

    entries.push({
      date,
      records: dateRecords,
      reflection: reflection?.text ?? '',
      moduleData,
      createdAt: 0,
      updatedAt: 0,
    })
  }

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

function formatDate(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}
