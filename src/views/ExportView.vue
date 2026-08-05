<script setup lang="ts">
import { ref } from 'vue'
import { Snackbar } from '@varlet/ui'
import { exportToJSON, downloadFile } from '@/utils/exporter'

const exportMode = ref<'today' | 'range' | 'all'>('all')
const dateFrom = ref('')
const dateTo = ref('')

async function doExport() {
  const json = await exportToJSON(exportMode.value, dateFrom.value, dateTo.value)
  const parsed = JSON.parse(json)
  const count = parsed.entries.length

  const now = new Date()
  const stamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`

  downloadFile(json, `diary-export-${stamp}.json`)
  Snackbar.success(`导出成功！共 ${count} 条记录`)
}
</script>

<template>
  <div class="export-page">
    <h2>导出数据</h2>

    <div class="export-options">
      <var-radio v-model="exportMode" value="all">全部数据</var-radio>
      <var-radio v-model="exportMode" value="today">仅今天</var-radio>
      <var-radio v-model="exportMode" value="range">日期范围</var-radio>
    </div>

    <div v-if="exportMode === 'range'" class="date-range">
      <div>
        <label>从</label>
        <input type="date" v-model="dateFrom" />
      </div>
      <div>
        <label>到</label>
        <input type="date" v-model="dateTo" />
      </div>
    </div>

    <var-button type="primary" block @click="doExport">导出 JSON</var-button>

    <div class="tip">
      导出的 JSON 文件可用 <code>scripts/json-to-md.mjs</code> 脚本转换为 Markdown 文件
    </div>
  </div>
</template>
