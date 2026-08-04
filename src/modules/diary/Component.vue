<script setup lang="ts">
import { ref, onMounted } from 'vue'
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

async function submit() {
  if (!inputText.value.trim()) return
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
  await store.updateRecord(editingId.value, {
    time: editTime.value,
    text: editText.value,
  })
  editingId.value = null
}

function startEditReflection() {
  reflectionText.value = store.entry?.reflection ?? ''
  editingReflection.value = true
}

async function saveReflection() {
  await store.updateReflection(reflectionText.value)
  editingReflection.value = false
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
      <button @click="prevDay" class="date-arrow">‹</button>
      <input
        type="date"
        :value="store.currentDate"
        @change="onDatePick"
        class="date-picker"
      />
      <button @click="goToday" class="today-btn">今天</button>
      <button @click="nextDay" class="date-arrow">›</button>
    </div>

    <!-- 快速输入 -->
    <div class="quick-input">
      <input type="time" v-model="inputTime" class="time-input" />
      <input
        v-model="inputText"
        @keyup.enter="submit"
        placeholder="记一笔..."
      />
      <button @click="submit" :disabled="!inputText.trim()">记</button>
    </div>

    <!-- 今日记录 -->
    <div class="records">
      <div v-for="p in periodOrder" :key="p" class="period-group">
        <template v-if="store.groupedRecords[p].length">
          <div class="period-label">{{ periodLabels[p] }}</div>
          <template v-for="r in store.groupedRecords[p]" :key="r.id">
            <!-- 编辑模式 -->
            <div v-if="editingId === r.id" class="record-edit">
              <input type="time" v-model="editTime" class="time-input" />
              <input v-model="editText" @keyup.enter="saveEdit" placeholder="内容" />
              <div class="edit-actions">
                <button @click="cancelEdit" class="cancel-btn">取消</button>
                <button @click="saveEdit" class="save-btn">保存</button>
              </div>
            </div>
            <!-- 正常展示 -->
            <div v-else class="record-item">
              <span class="record-time">{{ r.time }}</span>
              <span class="record-text" @click="startEdit(r.id, r.time, r.text)">{{ r.text }}</span>
              <button class="edit-btn" @click="startEdit(r.id, r.time, r.text)">改</button>
              <button class="delete-btn" @click="store.deleteRecord(r.id)">×</button>
            </div>
          </template>
        </template>
      </div>
      <div v-if="!store.entry?.records.length" class="empty-hint">
        还没有记录，记一笔吧
      </div>
    </div>

    <!-- 感悟 -->
    <div class="reflection">
      <div class="section-title" @click="startEditReflection">
        🌙 感悟
      </div>
      <div v-if="editingReflection" class="reflection-edit">
        <textarea v-model="reflectionText" placeholder="今天有什么想说的..." rows="6"></textarea>
        <div class="reflection-actions">
          <button @click="editingReflection = false">取消</button>
          <button class="primary" @click="saveReflection">保存</button>
        </div>
      </div>
      <div v-else class="reflection-view" @click="startEditReflection">
        {{ store.entry?.reflection || '点击写感悟...' }}
      </div>
    </div>
  </div>
</template>
