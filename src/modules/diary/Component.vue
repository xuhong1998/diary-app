<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useDiaryStore } from '@/stores/diary'
import { nowTime, formatDate, parseDate, normalizeTime } from '@/utils/date'
import { toast } from '@/utils/toast'
import { fetchWeatherData, getCachedWeather, getWeatherSvg, type WeatherData } from '@/utils/weather'
import type { Period } from '@/types'

const store = useDiaryStore()
const quickAddText = ref('')
const quickAddOpen = ref(false)
const reflectionSheetOpen = ref(false)
const reflectionText = ref('')
const editingId = ref<string | null>(null)
const editTime = ref('')
const editText = ref('')
const weatherData = ref<WeatherData | null>(null)
const weatherLoading = ref(false)

const periodLabels: Record<Period, string> = {
  morning: '上午',
  afternoon: '下午',
  evening: '晚上',
}

const periodOrder: Period[] = ['morning', 'afternoon', 'evening']

onMounted(() => {
  store.loadEntry(store.currentDate)
  loadWeather(store.currentDate)
})

watch(() => store.currentDate, (date) => {
  loadWeather(date)
})

async function loadWeather(date: string) {
  weatherData.value = getCachedWeather(date)
  const today = formatDate(new Date())
  if (date !== today) return
  try {
    weatherLoading.value = true
    const data = await fetchWeatherData(date)
    weatherData.value = data
  } catch {
    if (!weatherData.value) toast('获取天气失败')
  } finally {
    weatherLoading.value = false
  }
}

async function refreshWeather() {
  weatherLoading.value = true
  try {
    const data = await fetchWeatherData(store.currentDate)
    weatherData.value = data
    toast(data.locationFallback ? '定位未成功，显示默认城市天气' : '天气已更新')
  } catch {
    toast('获取天气失败，请允许定位权限')
  } finally {
    weatherLoading.value = false
  }
}

const weekdays = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六']

const heroDateText = computed(() => {
  const [, m, d] = store.currentDate.split('-').map(Number)
  return `${m}月${d}日`
})

const heroWeekdayText = computed(() => {
  const [y, m, d] = store.currentDate.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  const wd = weekdays[date.getDay()]
  const today = formatDate(new Date())
  if (store.currentDate === today) return `${wd} · 今天`
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  if (store.currentDate === formatDate(tomorrow)) return `${wd} · 明天`
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  if (store.currentDate === formatDate(yesterday)) return `${wd} · 昨天`
  return wd
})

const recordCount = computed(() => store.entry?.records.length ?? 0)

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

function onDatePick(e: Event) {
  const val = (e.target as HTMLInputElement).value
  if (val) store.loadEntry(val)
}

function openQuickAdd() {
  quickAddText.value = ''
  quickAddOpen.value = true
}

async function submitQuickAdd() {
  const raw = quickAddText.value.trim()
  if (!raw) return
  const lines = raw.split('\n').map(l => l.trim()).filter(Boolean)
  let count = 0
  for (const line of lines) {
    const match = line.match(/^(\d{1,2}[:：]\d{1,2}|\d{3,4})\s*(.*)$/)
    let time: string
    let text: string
    if (match) {
      time = normalizeTime(match[1])
      text = match[2].trim()
    } else {
      time = nowTime()
      text = line
    }
    if (text) {
      await store.addRecord(text, time)
      count++
    }
  }
  quickAddText.value = ''
  quickAddOpen.value = false
  toast(count > 1 ? `已记录 ${count} 条` : '已记录')
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
  toast('已保存')
}

async function confirmDelete(id: string) {
  await store.deleteRecord(id)
  toast('已删除')
}

function startEditReflection() {
  reflectionText.value = store.entry?.reflection ?? ''
  reflectionSheetOpen.value = true
}

async function saveReflection() {
  await store.updateReflection(reflectionText.value)
  reflectionSheetOpen.value = false
  toast('感悟已保存')
}
</script>

<template>
  <div class="page-pad">
    <!-- Hero Header -->
    <div class="diary-hero">
      <div class="hero-nav left"><button @click="prevDay">‹</button></div>
      <div class="hero-nav right"><button @click="nextDay">›</button></div>
      <div class="hero-date">{{ heroDateText }}</div>
      <div class="hero-weekday">{{ heroWeekdayText }}</div>
      <div class="hero-meta">
        <div v-if="weatherData" class="hero-pill" @click="refreshWeather" style="cursor:pointer">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" v-html="getWeatherSvg(weatherData.icon)"></svg>
          {{ weatherData.temp }}° {{ weatherData.desc }}
          <span v-if="weatherData.humidity" style="opacity:0.7;margin-left:4px;">{{ weatherData.humidity }}%</span>
        </div>
        <div v-else-if="weatherLoading" class="hero-pill">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="animation:spin 1s linear infinite"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
          定位中
        </div>
        <div v-else class="hero-pill" @click="refreshWeather" style="cursor:pointer">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/><circle cx="12" cy="12" r="5"/></svg>
          获取天气
        </div>
        <div v-if="weatherData" class="hero-pill" :title="weatherData.locationFallback ? '定位未成功，显示默认城市' : ''">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
          <template v-if="weatherData.locationFallback">⚠️ {{ weatherData.city }}</template>
          <template v-else>{{ weatherData.city }}</template>
        </div>
        <div class="hero-pill">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
          {{ recordCount }} 条
        </div>
      </div>
    </div>

    <!-- Hidden date picker for navigation -->
    <input
      type="date"
      :value="store.currentDate"
      @change="onDatePick"
      style="position: absolute; opacity: 0; pointer-events: none;"
    />

    <!-- Timeline -->
    <div class="timeline" v-if="recordCount">
      <div v-for="p in periodOrder" :key="p" class="timeline-period">
        <template v-if="store.groupedRecords[p].length">
          <div class="timeline-dot" :class="p"></div>
          <div class="timeline-line"></div>
          <div class="timeline-label">{{ periodLabels[p] }}</div>
          <template v-for="r in store.groupedRecords[p]" :key="r.id">
            <!-- Edit mode -->
            <div v-if="editingId === r.id" class="entry-edit">
              <input
                class="time-input"
                v-model="editTime"
                placeholder="HH:MM"
                @blur="editTime = normalizeTime(editTime)"
              />
              <input
                class="search-input"
                v-model="editText"
                placeholder="内容"
                @keydown.enter="saveEdit"
              />
              <div class="entry-edit-actions">
                <button class="ios-btn-secondary ios-btn-sm" @click="cancelEdit">取消</button>
                <button class="ios-btn-sm" @click="saveEdit">保存</button>
              </div>
            </div>
            <!-- Normal display -->
            <div v-else class="timeline-entry" @click="startEdit(r.id, r.time, r.text)">
              <span class="entry-time">{{ r.time }}</span>
              <span class="entry-text">{{ r.text }}</span>
              <div class="entry-actions">
                <button class="icon-btn muted" @click.stop="startEdit(r.id, r.time, r.text)">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                </button>
                <button class="icon-btn danger" @click.stop="confirmDelete(r.id)">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                </button>
              </div>
            </div>
          </template>
        </template>
      </div>
    </div>

    <!-- Empty state -->
    <div v-else class="empty-state">
      <div class="empty-text">还没有记录，点 + 记一笔吧</div>
    </div>

    <!-- Reflection -->
    <div class="reflection-v2" @click="startEditReflection" style="margin: 16px 16px 0;">
      <div class="reflection-v2-header">
        <div class="reflection-v2-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
        </div>
        <span class="reflection-v2-title">今日感悟</span>
      </div>
      <div v-if="store.entry?.reflection" class="reflection-v2-text">{{ store.entry.reflection }}</div>
      <div v-else class="reflection-v2-placeholder">点击写感悟...</div>
    </div>
  </div>

  <!-- FAB -->
  <button class="fab" @click="openQuickAdd">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
  </button>

  <!-- Quick Add Sheet -->
  <div class="sheet-overlay" :class="{ open: quickAddOpen }" @click="quickAddOpen = false"></div>
  <div class="sheet quick-add-sheet" :class="{ open: quickAddOpen }">
    <div class="sheet-grabber"></div>
    <div class="sheet-title">记一笔</div>
    <div class="sheet-body" style="display:flex;flex-direction:column;flex:1;overflow:hidden;">
      <textarea class="quick-add-editor" v-model="quickAddText" placeholder="7:10 起床刷牙准备坐地铁&#10;8:50 下地铁吃了半笼小笼包&#10;11:30 点外卖吃鸡排饭"></textarea>
      <div class="sheet-actions">
        <button class="ios-btn-secondary ios-btn-sm" style="flex:1;" @click="quickAddOpen = false">取消</button>
        <button class="ios-btn-sm" style="flex:1;" :disabled="!quickAddText.trim()" @click="submitQuickAdd">记录</button>
      </div>
    </div>
  </div>

  <!-- Reflection Sheet -->
  <div class="sheet-overlay" :class="{ open: reflectionSheetOpen }" @click="reflectionSheetOpen = false"></div>
  <div class="sheet" :class="{ open: reflectionSheetOpen }">
    <div class="sheet-grabber"></div>
    <div class="sheet-title">写写今天的感悟</div>
    <div class="sheet-body">
      <textarea class="sheet-textarea" v-model="reflectionText" placeholder="今天有什么想说的..."></textarea>
      <div class="sheet-actions">
        <button class="ios-btn-secondary ios-btn-sm" style="flex:1;" @click="reflectionSheetOpen = false">取消</button>
        <button class="ios-btn-sm" style="flex:1;" @click="saveReflection">保存</button>
      </div>
    </div>
  </div>
</template>
