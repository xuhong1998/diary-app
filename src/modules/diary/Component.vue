<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { Dialog, Snackbar } from '@varlet/ui'
import { useDiaryStore, nowTime } from '@/stores/diary'
import type { Period } from '@/types'

const store = useDiaryStore()
const inputText = ref('')
const inputTime = ref(nowTime())
const editingReflection = ref(false)
const reflectionText = ref('')
const editingId = ref<string | null>(null)
const editTime = ref('')
const editText = ref('')

const periodLabels: Record<Period, string> = {
  morning: '上午',
  afternoon: '下午',
  evening: '晚上',
}

const periodOrder: Period[] = ['morning', 'afternoon', 'evening']

onMounted(() => {
  store.loadEntry(store.currentDate)
})

function normalizeTime(input: string): string {
  const cleaned = input.trim().replace(/：/g, ':').replace(/[^\d:]/g, '')
  if (!cleaned) return nowTime()
  let h: number, m: number
  if (cleaned.includes(':')) {
    const parts = cleaned.split(':')
    h = parseInt(parts[0], 10)
    m = parseInt(parts[1] || '0', 10)
  } else if (cleaned.length <= 2) {
    h = parseInt(cleaned, 10)
    m = 0
  } else {
    h = parseInt(cleaned.slice(0, -2), 10)
    m = parseInt(cleaned.slice(-2), 10)
  }
  h = Math.max(0, Math.min(23, h || 0))
  m = Math.max(0, Math.min(59, m || 0))
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

async function submit() {
  if (!inputText.value.trim()) return
  inputTime.value = normalizeTime(inputTime.value)
  await store.addRecord(inputText.value, inputTime.value)
  inputText.value = ''
  inputTime.value = nowTime()
}

function startEdit(id: string, time: string, text: string) {
  editingId.value = id
  editTime.value = time
  editText.value = text
}

function cancelEdit() {
  editingId.value = null
}

async function saveEdit() {
  if (!editingId.value || !editText.value.trim()) return
  editTime.value = normalizeTime(editTime.value)
  await store.updateRecord(editingId.value, {
    time: editTime.value,
    text: editText.value,
  })
  editingId.value = null
  Snackbar.success('已保存')
}

function confirmDelete(id: string) {
  Dialog({
    title: '删除记录',
    message: '确定删除这条记录吗？',
    onConfirm: async () => {
      await store.deleteRecord(id)
      Snackbar.success('已删除')
    },
  })
}

function startEditReflection() {
  reflectionText.value = store.entry?.reflection ?? ''
  editingReflection.value = true
}

async function saveReflection() {
  await store.updateReflection(reflectionText.value)
  editingReflection.value = false
  Snackbar.success('感悟已保存')
}

function parseDate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

function prevDay() {
  const d = parseDate(store.currentDate)
  d.setDate(d.getDate() - 1)
  store.loadEntry(formatDate(d))
}

function nextDay() {
  const d = parseDate(store.currentDate)
  d.setDate(d.getDate() + 1)
  store.loadEntry(formatDate(d))
}

function formatDate(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

function goToday() {
  const d = new Date()
  store.loadEntry(formatDate(d))
}

function onDatePick(e: Event) {
  const val = (e.target as HTMLInputElement).value
  if (val) store.loadEntry(val)
}
</script>

<template>
  <div class="diary-page">
    <!-- 日期切换 -->
    <div class="date-bar">
      <var-button text round @click="prevDay" class="date-arrow">‹</var-button>
      <input
        type="date"
        :value="store.currentDate"
        @change="onDatePick"
        class="date-picker"
      />
      <var-button text size="small" @click="goToday" class="today-btn">今天</var-button>
      <var-button text round @click="nextDay" class="date-arrow">›</var-button>
    </div>

    <!-- 快速输入 -->
    <div class="quick-input">
      <var-input
        variant="outlined"
        size="small"
        v-model="inputTime"
        placeholder="HH:MM"
        style="width: 92px"
        @blur="inputTime = normalizeTime(inputTime)"
      />
      <var-input
        variant="outlined"
        size="small"
        v-model="inputText"
        placeholder="记一笔..."
        @keydown.enter="submit"
      />
      <var-button type="primary" size="small" @click="submit" :disabled="!inputText.trim()">记</var-button>
    </div>

    <!-- 今日记录 -->
    <div class="records">
      <div v-for="p in periodOrder" :key="p" class="period-group">
        <template v-if="store.groupedRecords[p].length">
          <div class="period-label">{{ periodLabels[p] }}</div>
          <template v-for="r in store.groupedRecords[p]" :key="r.id">
            <!-- 编辑模式 -->
            <div v-if="editingId === r.id" class="record-edit">
              <var-input
                variant="outlined"
                size="small"
                v-model="editTime"
                placeholder="HH:MM"
                style="width: 92px"
                @blur="editTime = normalizeTime(editTime)"
              />
              <var-input
                variant="outlined"
                size="small"
                v-model="editText"
                placeholder="内容"
                @keydown.enter="saveEdit"
              />
              <div class="edit-actions">
                <var-button size="small" @click="cancelEdit">取消</var-button>
                <var-button type="primary" size="small" @click="saveEdit">保存</var-button>
              </div>
            </div>
            <!-- 正常展示 -->
            <var-cell
              v-else
              v-ripple
              class="record-cell"
              @click="startEdit(r.id, r.time, r.text)"
            >
              <template #icon>
                <span class="record-time">{{ r.time }}</span>
              </template>
              <span class="record-text">{{ r.text }}</span>
              <template #extra>
                <var-button text size="small" @click.stop="startEdit(r.id, r.time, r.text)">改</var-button>
                <var-button text size="small" @click.stop="confirmDelete(r.id)">删</var-button>
              </template>
            </var-cell>
          </template>
        </template>
      </div>
      <var-paper v-if="!store.entry?.records.length" class="empty-hint" :elevation="0">
        还没有记录，记一笔吧
      </var-paper>
    </div>

    <!-- 感悟 -->
    <div class="reflection">
      <div class="section-title" @click="startEditReflection">
        🌙 感悟
      </div>
      <var-paper
        class="reflection-view"
        :elevation="2"
        v-ripple
        @click="startEditReflection"
      >
        {{ store.entry?.reflection || '点击写感悟...' }}
      </var-paper>
    </div>

    <!-- 感悟编辑弹层 -->
    <var-popup position="bottom" v-model:show="editingReflection" :overlay="false">
      <div class="reflection-popup">
        <div class="reflection-popup-title">🌙 写写今天的感悟</div>
        <var-input
          variant="outlined"
          :multiline="true"
          :rows="6"
          v-model="reflectionText"
          placeholder="今天有什么想说的..."
        />
        <div class="reflection-actions">
          <var-button @click="editingReflection = false">取消</var-button>
          <var-button type="primary" @click="saveReflection">保存</var-button>
        </div>
      </div>
    </var-popup>
  </div>
</template>

<style scoped>
.diary-page {
  --var-cell-horizontal-padding: 12px;
  --var-cell-vertical-padding: 10px;
}
</style>
