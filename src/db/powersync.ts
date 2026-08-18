import { PowerSyncDatabase, createConsoleLogger, LogLevels, type AbstractPowerSyncDatabase } from '@powersync/web'
import { AppSchema } from './schema'
import { supabase } from './supabase'
import { isSupabaseConfigured } from './supabase'
import { toast } from '@/utils/toast'

const POWERSYNC_URL = import.meta.env.VITE_POWERSYNC_URL ?? ''

const logger = createConsoleLogger({ minLevel: LogLevels.debug })

export const powerSyncDb = new PowerSyncDatabase({
  schema: AppSchema,
  database: {
    dbFilename: 'diary.db',
    databaseWorkerLogLevel: LogLevels.debug,
  },
  sync: {
    logLevel: LogLevels.debug,
  },
  logger,
})

export function isPowerSyncConfigured(): boolean {
  return Boolean(POWERSYNC_URL) && isSupabaseConfigured
}

const UPSERT_CONFLICT_COLUMNS: Record<string, string> = {
  reflections: 'date',
}

let lastUploadFailToastAt = 0

class BackendConnector {
  async fetchCredentials() {
    const { data, error } = await supabase.auth.getSession()
    if (error || !data.session) {
      throw new Error('User not authenticated')
    }
    console.log('[powersync] fetchCredentials OK, endpoint:', POWERSYNC_URL)
    return {
      endpoint: POWERSYNC_URL,
      token: data.session.access_token,
    }
  }

  async uploadData(database: AbstractPowerSyncDatabase) {
    const batch = await database.getCrudBatch()
    if (!batch) return

    let hasError = false

    for (const op of batch.crud) {
      const table = op.table
      const row = op.opData ?? {}
      const now = Date.now()

      try {
        if (op.op === 'PUT') {
          const { error } = await supabase.from(table).upsert(
            { ...row, id: op.id, updated_at: now },
            { onConflict: UPSERT_CONFLICT_COLUMNS[table] ?? 'id' }
          )
          if (error) throw error
          console.log(`[powersync] PUT ${table} id=${op.id} ok`)
        } else if (op.op === 'PATCH') {
          const { data: matched, error } = await supabase
            .from(table)
            .update({ ...row, updated_at: now })
            .eq('id', op.id)
            .select('id')
          if (error) throw error
          if (matched && matched.length > 0) {
            console.log(`[powersync] PATCH ${table} id=${op.id} ok`)
          } else {
            const local = await database.getOptional<Record<string, unknown>>(
              `SELECT * FROM ${table} WHERE id = ?`,
              [op.id]
            )
            if (local) {
              const { error: upsertError } = await supabase.from(table).upsert(
                { ...local, updated_at: now },
                { onConflict: UPSERT_CONFLICT_COLUMNS[table] ?? 'id' }
              )
              if (upsertError) throw upsertError
              console.warn(`[powersync] PATCH ${table} id=${op.id} matched 0 rows, self-healed via upsert`)
            } else {
              console.warn(`[powersync] PATCH ${table} id=${op.id} matched 0 rows, local row gone, skipped`)
            }
          }
        } else if (op.op === 'DELETE') {
          const { error } = await supabase.from(table).delete().eq('id', op.id)
          if (error) throw error
          console.log(`[powersync] DELETE ${table} id=${op.id} ok`)
        }
      } catch (e) {
        hasError = true
        console.error(`[powersync] upload ${op.op} ${table} id=${op.id} failed:`, e)
        break
      }
    }

    if (hasError) {
      const ts = Date.now()
      if (ts - lastUploadFailToastAt > 30_000) {
        lastUploadFailToastAt = ts
        toast('云同步失败，稍后自动重试')
      }
      throw new Error('PowerSync upload failed')
    }

    await batch.complete()
  }
}

let connector: BackendConnector | null = null

export async function connectPowerSync() {
  await powerSyncDb.init()
  if (!isPowerSyncConfigured()) {
    console.warn('[powersync] not configured, running local-only')
    return
  }
  connector ??= new BackendConnector()
  console.log('[powersync] connecting...')
  await powerSyncDb.connect(connector)
  console.log('[powersync] connected')
}

export async function disconnectPowerSync() {
  await powerSyncDb.disconnect()
}
