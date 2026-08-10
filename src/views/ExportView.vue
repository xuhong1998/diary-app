<script setup lang="ts">
import { ref } from 'vue'
import { exportToJSON, downloadFile } from '@/utils/exporter'
import { powerSyncDb } from '@/db/powersync'
import { getPeriod, parseTimeToDate } from '@/utils/date'
import { toast } from '@/utils/toast'
import type { Period } from '@/types'

const exportMode = ref<'today' | 'range' | 'all'>('all')
const dateFrom = ref('')
const dateTo = ref('')

const modes = [
  { value: 'all', label: '全部数据' },
  { value: 'today', label: '仅今天' },
  { value: 'range', label: '日期范围' },
] as const

async function doExport() {
  const json = await exportToJSON(exportMode.value, dateFrom.value, dateTo.value)
  const parsed = JSON.parse(json)
  const count = parsed.entries.length

  const now = new Date()
  const stamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`

  downloadFile(json, `diary-export-${stamp}.json`)
  toast(`导出成功！共 ${count} 条记录`)
}

const fileInput = ref<HTMLInputElement | null>(null)
const importing = ref(false)

function triggerImport() {
  fileInput.value?.click()
}

async function handleFile(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return

  importing.value = true
  try {
    const text = await file.text()
    const data = JSON.parse(text)

    if (!data.entries || !Array.isArray(data.entries)) {
      toast('文件格式不正确')
      importing.value = false
      return
    }

    let recordCount = 0
    for (const entry of data.entries) {
      if (!entry.date) continue

      for (const record of entry.records ?? []) {
        const id = crypto.randomUUID()
        const now = Date.now()
        await powerSyncDb.execute(
          'INSERT INTO records (id, date, time, text, period, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [id, entry.date, record.time, record.text, getPeriod(parseTimeToDate(record.time)) as Period, now, now]
        )
        recordCount++
      }

      if (entry.reflection) {
        await powerSyncDb.execute(
          `INSERT INTO reflections (date, text, updated_at)
           VALUES (?, ?, ?)
           ON CONFLICT(date) DO UPDATE SET text = EXCLUDED.text, updated_at = EXCLUDED.updated_at`,
          [entry.date, entry.reflection, Date.now()]
        )
      }
    }

    toast(`导入成功！共 ${recordCount} 条记录`)
  } catch (err) {
    console.error('[import] failed:', err)
    toast('导入失败，请检查文件格式')
  } finally {
    importing.value = false
    if (input) input.value = ''
  }
}
</script>

<template>
  <div class="page-pad">
    <div class="section-gap"></div>

    <!-- Export Section -->
    <div class="list-header" style="padding: 0 20px 6px;">导出数据</div>

    <div class="segmented">
      <div
        v-for="m in modes"
        :key="m.value"
        class="segmented-item"
        :class="{ active: exportMode === m.value }"
        @click="exportMode = m.value"
      >{{ m.label }}</div>
    </div>

    <div v-if="exportMode === 'range'" class="list-section">
      <div class="list-group">
        <div class="list-row">
          <div class="row-content"><div class="row-title">从</div></div>
          <div class="row-accessory">
            <input type="date" v-model="dateFrom" style="border:none;background:transparent;font-size:15px;color:var(--label-primary);outline:none;font-family:var(--font-stack);" />
          </div>
        </div>
        <div class="list-row">
          <div class="row-content"><div class="row-title">到</div></div>
          <div class="row-accessory">
            <input type="date" v-model="dateTo" style="border:none;background:transparent;font-size:15px;color:var(--label-primary);outline:none;font-family:var(--font-stack);" />
          </div>
        </div>
      </div>
    </div>

    <div style="margin: 16px;">
      <button class="ios-btn" @click="doExport">导出 JSON</button>
    </div>

    <!-- Import Section -->
    <div class="list-header" style="padding: 0 20px 6px; margin-top: 16px;">导入数据</div>
    <div style="margin: 16px;">
      <input ref="fileInput" type="file" accept=".json" style="display:none" @change="handleFile" />
      <button class="ios-btn ios-btn-secondary" :disabled="importing" @click="triggerImport">
        {{ importing ? '导入中...' : '选择 JSON 文件导入' }}
      </button>
    </div>

    <div class="tip-box">
      导入会合并数据，不会覆盖已有记录<br>仅支持本应用导出的 JSON 格式
    </div>
  </div>
</template>
