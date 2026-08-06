<script setup lang="ts">
import { ref } from 'vue'
import { exportToJSON, downloadFile } from '@/utils/exporter'
import { toast } from '@/utils/toast'

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
</script>

<template>
  <div class="page-pad">
    <div class="section-gap"></div>

    <!-- Segmented Control -->
    <div class="segmented">
      <div
        v-for="m in modes"
        :key="m.value"
        class="segmented-item"
        :class="{ active: exportMode === m.value }"
        @click="exportMode = m.value"
      >{{ m.label }}</div>
    </div>

    <!-- Date Range (only for range mode) -->
    <div v-if="exportMode === 'range'" class="list-section">
      <div class="list-header">日期范围</div>
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

    <!-- Export button -->
    <div style="margin: 16px;">
      <button class="ios-btn" @click="doExport">导出 JSON</button>
    </div>

    <!-- Tip -->
    <div class="tip-box">
      导出的 JSON 文件可用 <code>scripts/json-to-md.mjs</code> 脚本转换为 Markdown 文件
    </div>
  </div>
</template>
