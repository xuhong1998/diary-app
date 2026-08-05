import { supabase, isSupabaseConfigured } from './supabase'
import { db } from './dexie'
import type { DiaryEntry } from '@/types'

const LAST_SYNC_KEY = 'diary-last-sync-at'

export interface EntryRow {
  date: string
  records: any[]
  reflection: string
  module_data: Record<string, any>
  created_at: number
  updated_at: number
}

function toRow(e: DiaryEntry): EntryRow {
  return {
    date: e.date,
    records: e.records,
    reflection: e.reflection,
    module_data: e.moduleData,
    created_at: e.createdAt,
    updated_at: e.updatedAt,
  }
}

function toEntry(r: EntryRow): DiaryEntry {
  return {
    date: r.date,
    records: r.records,
    reflection: r.reflection,
    moduleData: r.module_data,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }
}

export function getLastSyncAt(): number {
  return Number(localStorage.getItem(LAST_SYNC_KEY) ?? 0)
}

function setLastSyncAt(ts: number) {
  const cur = getLastSyncAt()
  if (ts > cur) localStorage.setItem(LAST_SYNC_KEY, String(ts))
}

export function isConfigured() {
  return isSupabaseConfigured
}

export async function pushEntry(entry: DiaryEntry): Promise<void> {
  if (!isSupabaseConfigured) return
  const { error } = await supabase.from('entries').upsert(toRow(entry), {
    onConflict: 'date',
  })
  if (error) {
    console.warn('[sync] push failed', entry.date, error.message)
  } else {
    setLastSyncAt(entry.updatedAt)
  }
}

export async function getCloudCount(): Promise<number> {
  if (!isSupabaseConfigured) return 0
  const { count, error } = await supabase
    .from('entries')
    .select('*', { count: 'exact', head: true })
  if (error) {
    console.warn('[sync] count failed', error.message)
    return 0
  }
  return count ?? 0
}

export interface SyncResult {
  pulled: number
  pushed: number
  lastSyncAt: number
}

export async function syncAll(): Promise<SyncResult> {
  const result: SyncResult = { pulled: 0, pushed: 0, lastSyncAt: getLastSyncAt() }
  if (!isSupabaseConfigured) return result

  const localEntries = await db.entries.toArray()
  const localMap = new Map(localEntries.map(e => [e.date, e]))

  const { data: cloudRows, error } = await supabase
    .from('entries')
    .select('*')

  if (error) {
    console.warn('[sync] pull all failed', error.message)
    return result
  }

  const cloudMap = new Map((cloudRows ?? []).map(r => [r.date, r as EntryRow]))
  let maxTs = result.lastSyncAt

  for (const [date, cloudRow] of cloudMap) {
    const localEntry = localMap.get(date)
    if (!localEntry) {
      await db.entries.put(toEntry(cloudRow))
      result.pulled++
      maxTs = Math.max(maxTs, cloudRow.updated_at)
    } else if (cloudRow.updated_at > localEntry.updatedAt) {
      await db.entries.put(toEntry(cloudRow))
      result.pulled++
      maxTs = Math.max(maxTs, cloudRow.updated_at)
    }
    localMap.delete(date)
  }

  for (const localEntry of localMap.values()) {
    const { error } = await supabase.from('entries').upsert(toRow(localEntry), {
      onConflict: 'date',
    })
    if (error) {
      console.warn('[sync] push failed', localEntry.date, error.message)
    } else {
      result.pushed++
      maxTs = Math.max(maxTs, localEntry.updatedAt)
    }
  }

  setLastSyncAt(maxTs)
  result.lastSyncAt = maxTs
  return result
}
