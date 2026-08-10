#!/usr/bin/env node

/**
 * 从 Supabase 拉取日记数据，转换为 Markdown 并写入 diary 项目
 *
 * 用法:
 *   node scripts/sync-to-diary.mjs                          # 同步全部
 *   node scripts/sync-to-diary.mjs --from 2026-08-04        # 从指定日期
 *   node scripts/sync-to-diary.mjs --from 2026-08-04 --to 2026-08-09
 *   node scripts/sync-to-diary.mjs --dry-run                # 只预览不写入
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { join, resolve } from 'node:path'

// ── 配置 ────────────────────────────────────────────────
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
const DIARY_DIR = '/Users/xuhong/individual/diary'

// ── 参数解析 ─────────────────────────────────────────────
function parseArgs() {
  const args = process.argv.slice(2)
  let from = null, to = null, dryRun = false
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--from') from = args[++i]
    else if (args[i] === '--to') to = args[++i]
    else if (args[i] === '--dry-run') dryRun = true
  }
  return { from, to, dryRun }
}

// ── Supabase 查询 ────────────────────────────────────────
async function fetchEntries(from, to) {
  let url = `${SUPABASE_URL}/rest/v1/entries?order=date.asc`
  const filters = []
  if (from) filters.push(`date=gte.${from}`)
  if (to) filters.push(`date=lte.${to}`)
  if (filters.length) url += '&' + filters.join('&')

  console.log(`📡 正在从 Supabase 获取数据...`)
  console.log(`   ${url}`)

  const res = await fetch(url, {
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
    },
  })

  if (!res.ok) {
    console.error(`❌ 请求失败: ${res.status} ${res.statusText}`)
    process.exit(1)
  }

  const data = await res.json()
  console.log(`✅ 获取到 ${data.length} 条记录\n`)
  return data
}

// ── Markdown 转换（与 diary 项目 json-to-md.mjs 逻辑一致）──
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const DIFFICULTY_LABEL = { easy: '简单', medium: '中等', hard: '困难' }
const TITLE_ORDER = ['今日记录', '待办', '算法练习', '感悟']

function formatDateTitle(dateStr) {
  const [y, m, d] = dateStr.split('-')
  const date = new Date(Number(y), Number(m) - 1, Number(d))
  const weekday = WEEKDAYS[date.getDay()]
  return `${m}-${d} ${weekday}`
}

function generateRecordsSection(records) {
  const periods = { morning: '上午', afternoon: '下午', evening: '晚上' }
  const order = ['morning', 'afternoon', 'evening']
  let md = '## 今日记录\n'

  for (const p of order) {
    const items = records.filter(r => r.period === p)
    if (!items.length) continue
    md += `\n### ${periods[p]}\n`
    for (const r of items) {
      md += `${r.time} ${r.text}\n`
    }
  }
  return md
}

function generateTodoSection(data) {
  const items = data?.items ?? []
  if (!items.length) return null
  let md = '## 待办\n\n'
  for (const item of items) {
    md += `- [${item.done ? 'x' : ' '}] ${item.text}\n`
  }
  return md
}

function generateAlgorithmSection(data) {
  const problems = data?.problems ?? []
  if (!problems.length) return null
  let md = '## 算法练习\n\n'
  for (const p of problems) {
    const tags = p.tags?.length ? `（${p.tags.join('、')}）` : ''
    const diff = DIFFICULTY_LABEL[p.difficulty] ?? ''
    md += `* ${p.title}（${diff}）${tags}\n`
    if (p.note) md += `  > ${p.note}\n`
  }
  return md
}

function generateReflectionSection(reflection) {
  if (!reflection?.trim()) return null
  return `## 感悟\n\n${reflection.trim()}\n`
}

function entryToMarkdown(entry) {
  const sections = []

  if (entry.records?.length) {
    sections.push({ title: '今日记录', md: generateRecordsSection(entry.records) })
  }

  const moduleData = entry.module_data ?? entry.moduleData ?? {}
  if (moduleData.todo) {
    const md = generateTodoSection(moduleData.todo)
    if (md) sections.push({ title: '待办', md })
  }
  if (moduleData.algorithm) {
    const md = generateAlgorithmSection(moduleData.algorithm)
    if (md) sections.push({ title: '算法练习', md })
  }

  const reflectionMd = generateReflectionSection(entry.reflection)
  if (reflectionMd) {
    sections.push({ title: '感悟', md: reflectionMd })
  }

  sections.sort((a, b) => {
    const ia = TITLE_ORDER.indexOf(a.title)
    const ib = TITLE_ORDER.indexOf(b.title)
    return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib)
  })

  let md = `# 📅 ${formatDateTitle(entry.date)}\n\n---\n`
  for (const s of sections) {
    md += `\n${s.md}\n\n---\n`
  }
  return md
}

// ── main ────────────────────────────────────────────────
async function main() {
  const { from, to, dryRun } = parseArgs()

  if (!SERVICE_KEY) {
    console.error('❌ 缺少 SUPABASE_SERVICE_ROLE_KEY，请在 .env 中配置')
    process.exit(1)
  }

  const entries = await fetchEntries(from, to)
  if (!entries.length) {
    console.log('没有需要同步的记录')
    return
  }

  for (const entry of entries) {
    const [y, m] = entry.date.split('-')
    const outDir = join(DIARY_DIR, y, m)
    const md = entryToMarkdown(entry)

    const [yy, mm, dd] = entry.date.split('-')
    const date = new Date(Number(yy), Number(mm) - 1, Number(dd))
    const weekday = WEEKDAYS[date.getDay()]
    const filename = `${mm}-${dd}-${weekday}.md`

    if (dryRun) {
      console.log(`🔍 [DRY-RUN] ${filename}`)
      console.log(md.slice(0, 200) + '...\n')
      continue
    }

    if (!existsSync(outDir)) {
      mkdirSync(outDir, { recursive: true })
    }

    writeFileSync(join(outDir, filename), md, 'utf-8')
    console.log(`✅ ${entry.date} → ${y}/${m}/${filename}`)
  }

  console.log(`\n完成！共写入 ${entries.length} 个日记文件`)
}

main()
