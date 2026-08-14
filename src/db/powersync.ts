import { PowerSyncDatabase, createConsoleLogger, LogLevels, type AbstractPowerSyncDatabase } from '@powersync/web'
import { AppSchema } from './schema'
import { supabase } from './supabase'
import { isSupabaseConfigured } from './supabase'

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

    for (const op of batch.crud) {
      const table = op.table
      const row = op.opData ?? {}
      const now = Date.now()

      try {
        if (op.op === 'PUT') {
          const { error } = await supabase.from(table).upsert({
            ...row,
            updated_at: now,
          })
          if (error) throw error
          console.log(`[powersync] PUT ${table} ok`)
        } else if (op.op === 'PATCH') {
          const { error } = await supabase
            .from(table)
            .update({ ...row, updated_at: now })
            .eq('id', op.id)
          if (error) throw error
          console.log(`[powersync] PATCH ${table} id=${op.id} ok`)
        } else if (op.op === 'DELETE') {
          const { error } = await supabase.from(table).delete().eq('id', op.id)
          if (error) throw error
          console.log(`[powersync] DELETE ${table} id=${op.id} ok`)
        }
      } catch (e) {
        console.error(`[powersync] upload ${op.op} ${table} id=${op.id} failed:`, e)
      }
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
