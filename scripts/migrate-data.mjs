#!/usr/bin/env node

/**
 * 数据迁移脚本: entries 表 → records / reflections / modules 表
 *
 * 用法:
 *   node scripts/migrate-data.mjs          # 执行迁移
 *   node scripts/migrate-data.mjs --dry    # 预览不写入
 */

import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

const ROOT = resolve(import.meta.dirname, '..')
const envFile = readFileSync(join(ROOT, '.env'), 'utf-8')
const env = Object.fromEntries(
  envFile.trim().split('\n').map(l => {
    const idx = l.indexOf('=')
    return [l.slice(0, idx), l.slice(idx + 1)]
  })
)

const SUPABASE_URL = env.VITE_SUPABASE_URL
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY
const HEADERS = {
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
  'Content-Type': 'application/json',
  Prefer: 'return=representation',
}

const dry = process.argv.includes('--dry')

async function fetchAllEntries() {
  console.log('📡 读取 entries 表...')
  const res = await fetch(`${SUPABASE_URL}/rest/v1/entries?order=date.asc`, { headers: HEADERS })
  if (!res.ok) throw new Error(`读取失败: ${res.status}`)
  const data = await res.json()
  console.log(`✅ ${data.length} 条 entry\n`)
  return data
}

async function batchInsert(table, rows) {
  if (!rows.length) return 0
  if (dry) {
    console.log(`  [DRY] ${table}: ${rows.length} 行`)
    return rows.length
  }
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: 'POST',
    headers: { ...HEADERS, Prefer: 'return=minimal' },
    body: JSON.stringify(rows),
  })
  if (!res.ok) {
    const txt = await res.text()
    console.error(`  ❌ ${table} 插入失败: ${res.status} ${txt}`)
    return 0
  }
  return rows.length
}

async function main() {
  const entries = await fetchAllEntries()

  const allRecords = []
  const allReflections = []
  const allModules = []

  for (const entry of entries) {
    const userId = entry.user_id

    // records
    if (entry.records?.length) {
      for (const r of entry.records) {
        allRecords.push({
          id: r.id,
          date: entry.date,
          time: r.time,
          text: r.text,
          period: r.period || 'morning',
          created_at: entry.created_at,
          updated_at: entry.updated_at,
          user_id: userId,
        })
      }
    }

    // reflections
    if (entry.reflection?.trim()) {
      allReflections.push({
        date: entry.date,
        text: entry.reflection,
        updated_at: entry.updated_at,
        user_id: userId,
      })
    }

    // modules
    const moduleData = entry.module_data ?? entry.moduleData ?? {}
    for (const [moduleId, data] of Object.entries(moduleData)) {
      if (data && Object.keys(data).length > 0) {
        allModules.push({
          date: entry.date,
          module_id: moduleId,
          data: JSON.stringify(data),
          updated_at: entry.updated_at,
          user_id: userId,
        })
      }
    }
  }

  console.log(`📊 汇总: ${allRecords.length} records, ${allReflections.length} reflections, ${allModules.length} modules\n`)

  const r1 = await batchInsert('records', allRecords)
  const r2 = await batchInsert('reflections', allReflections)
  const r3 = await batchInsert('modules', allModules)

  console.log(`\n${dry ? '预览' : '迁移'}完成: ${r1} records, ${r2} reflections, ${r3} modules`)
}

main().catch(console.error)
