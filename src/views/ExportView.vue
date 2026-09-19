<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { exportToJSON, downloadFile } from '@/utils/exporter'
import { powerSyncDb } from '@/db/powersync'
import { getPeriod, parseTimeToDate, todayStr, formatDate } from '@/utils/date'
import { toast } from '@/utils/toast'
import type { Period } from '@/types'

/**
 * 导出页 —— 数据是你自己的，随时带走。
 * 汇总行实时算：导出前就知道会拿到什么。导入按「合并」处理，不覆盖已有记录。
 */
const mode = ref<'all' | 'today' | 'range'>('all')
const dateFrom = ref('')
const dateTo = ref(todayStr())

const summaryText = ref('')

async function paint() {
  try {
    const a = mode.value === 'today' ? todayStr() : dateFrom.value
    const b = mode.value === 'today' ? todayStr() : dateTo.value
    const cond = mode.value === 'all' ? '' : ' WHERE date BETWEEN ? AND ?'
    const params = mode.value === 'all' ? [] : [a, b]

    const recRows = await powerSyncDb.getAll<{ date: string }>(
      `SELECT DISTINCT date FROM records WHERE deleted_at IS NULL${cond}`,
      params
    )
    const refRows = await powerSyncDb.getAll<{ date: string }>(
      `SELECT date FROM reflections WHERE text != ''${cond}`,
      params
    )
    const recCount = await powerSyncDb.get<{ n: number }>(
      `SELECT COUNT(*) AS n FROM records WHERE deleted_at IS NULL${cond}`,
      params
    )
    const dates = new Set([...recRows.map(r => r.date), ...refRows.map(r => r.date)])

    summaryText.value = dates.size
      ? `将导出 ${dates.size} 天 · ${recCount?.n ?? 0} 条记录 · ${refRows.length} 篇感悟`
      : '这个范围里没有记录'
  } catch (e) {
    console.error('[export] summary failed:', e)
    summaryText.value = ''
  }
}

async function doExport() {
  const json = await exportToJSON(mode.value, dateFrom.value, dateTo.value)
  const count = JSON.parse(json).entries.length
  const stamp = formatDate(new Date()).replace(/-/g, '')
  downloadFile(json, `diary-export-${stamp}.json`)
  toast(`导出成功！共 ${count} 天`)
}

// ---------- 导入：合并模式 ----------
const fileEl = ref<HTMLInputElement | null>(null)
const importing = ref(false)

async function handleFile(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  importing.value = true
  try {
    const data = JSON.parse(await file.text())
    if (!data.entries || !Array.isArray(data.entries)) throw new Error('bad format')

    let recordCount = 0
    for (const entry of data.entries) {
      if (!entry.date) continue
      for (const record of entry.records ?? []) {
        const now = Date.now()
        await powerSyncDb.execute(
          'INSERT INTO records (id, date, time, text, period, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [crypto.randomUUID(), entry.date, record.time, record.text, getPeriod(parseTimeToDate(record.time)) as Period, now, now]
        )
        recordCount++
      }
      if (entry.reflection) {
        const existingRef = await powerSyncDb.getOptional<{ id: string }>(
          'SELECT id FROM reflections WHERE date = ?',
          [entry.date]
        )
        if (existingRef) {
          await powerSyncDb.execute(
            'UPDATE reflections SET text = ?, updated_at = ? WHERE id = ?',
            [entry.reflection, Date.now(), existingRef.id]
          )
        } else {
          await powerSyncDb.execute(
            'INSERT INTO reflections (id, date, text, updated_at) VALUES (?, ?, ?, ?)',
            [crypto.randomUUID(), entry.date, entry.reflection, Date.now()]
          )
        }
      }
    }
    toast(`导入成功！合并 ${recordCount} 条记录`)
  } catch (err) {
    console.error('[import] failed:', err)
    toast('导入失败，请检查文件格式')
  } finally {
    importing.value = false
    if (input) input.value = ''
  }
}

onMounted(() => {
  const now = new Date()
  const earliest = now.getFullYear() - 1 + '-01-01'
  dateFrom.value = earliest
  void paint()
})
</script>

<template>
  <section class="page active" data-page="export">
    <div class="pg-intro">数据是你自己的，随时带走</div>

    <div class="st-sec">
      <div class="st-h">导出数据</div>

      <div class="st-seg ex-seg">
        <button :class="{ on: mode === 'all' }" @click="mode = 'all'; paint()">全部</button>
        <button :class="{ on: mode === 'today' }" @click="mode = 'today'; paint()">仅今天</button>
        <button :class="{ on: mode === 'range' }" @click="mode = 'range'; paint()">日期范围</button>
      </div>

      <!-- 选「日期范围」才出现这两行 -->
      <div v-show="mode === 'range'" class="st-group ex-range">
        <div class="st-row">
          <div class="st-c"><div class="st-t">从</div></div>
          <input v-model="dateFrom" type="date" class="ex-date" @change="paint" />
        </div>
        <div class="st-row">
          <div class="st-c"><div class="st-t">到</div></div>
          <input v-model="dateTo" type="date" class="ex-date" @change="paint" />
        </div>
      </div>

      <!-- 汇总实时算：导出前就知道会拿到什么 -->
      <div class="ex-sum">{{ summaryText }}</div>
      <button class="ex-go" :disabled="importing" @click="doExport">导出 JSON</button>
    </div>

    <div class="st-sec">
      <div class="st-h">导入数据</div>
      <button class="ex-go ghost" @click="fileEl?.click()">
        {{ importing ? '导入中…' : '选择 JSON 文件导入' }}
      </button>
      <input ref="fileEl" type="file" accept=".json,application/json" hidden @change="handleFile" />
    </div>

    <div class="ex-tip">
      导入按「合并」处理，不会覆盖已有记录<br />仅支持本应用导出的 JSON 格式
    </div>
  </section>
</template>
