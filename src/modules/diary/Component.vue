<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useDiaryStore } from '@/stores/diary'
import type { Period } from '@/types'

const store = useDiaryStore()
const inputText = ref('')
const editingReflection = ref(false)
const reflectionText = ref('')

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
  await store.addRecord(inputText.value)
  inputText.value = ''
}

function startEditReflection() {
  reflectionText.value = store.entry?.reflection ?? ''
  editingReflection.value = true
}

async function saveReflection() {
  await store.updateReflection(reflectionText.value)
  editingReflection.value = false
}

function prevDay() {
  const d = new Date(store.currentDate)
  d.setDate(d.getDate() - 1)
  store.loadEntry(formatDate(d))
}

function nextDay() {
  const d = new Date(store.currentDate)
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
</script>

<template>
  <div class="diary-page">
    <!-- 日期切换 -->
    <div class="date-bar">
      <button @click="prevDay">‹</button>
      <span @click="goToday">{{ store.currentDate }}</span>
      <button @click="nextDay">›</button>
    </div>

    <!-- 快速输入 -->
    <div class="quick-input">
      <input
        v-model="inputText"
        @keyup.enter="submit"
        placeholder="记一笔..."
        autofocus
      />
      <button @click="submit" :disabled="!inputText.trim()">记</button>
    </div>

    <!-- 今日记录 -->
    <div class="records">
      <div v-for="p in periodOrder" :key="p" class="period-group">
        <template v-if="store.groupedRecords[p].length">
          <div class="period-label">{{ periodLabels[p] }}</div>
          <div v-for="r in store.groupedRecords[p]" :key="r.id" class="record-item">
            <span class="record-time">{{ r.time }}</span>
            <span class="record-text">{{ r.text }}</span>
            <button class="delete-btn" @click="store.deleteRecord(r.id)">×</button>
          </div>
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
