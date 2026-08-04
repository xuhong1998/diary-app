import { db } from '@/db/dexie'

export async function exportToJSON(
  mode: 'today' | 'range' | 'all',
  dateFrom?: string,
  dateTo?: string
): Promise<string> {
  let entries

  if (mode === 'all') {
    entries = await db.entries.orderBy('date').toArray()
  } else if (mode === 'range' && dateFrom && dateTo) {
    entries = await db.entries
      .where('date')
      .between(dateFrom, dateTo, true, true)
      .toArray()
  } else {
    const today = formatDate(new Date())
    entries = await db.entries.where('date').equals(today).toArray()
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
