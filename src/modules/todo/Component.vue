<script setup lang="ts">
import { computed, onMounted, provide, ref, watch } from 'vue'
import { useDiaryStore } from '@/stores/diary'
import { formatDate, parseDate, todayStr } from '@/utils/date'
import { toast } from '@/utils/toast'
import { combinedDayProgress } from '@/utils/todoProgress'
import type { TodoItem } from '@/types'
import { useCheckin } from './useCheckin'
import { checkinKey } from './checkinKey'
import CheckinTodaySection from './sections/CheckinTodaySection.vue'
import CheckinStatsSection from './sections/CheckinStatsSection.vue'
import CheckinManageSection from './sections/CheckinManageSection.vue'

const store = useDiaryStore()
const today = todayStr()

const tab = ref<'today' | 'stats' | 'manage'>('today')
const newTodo = ref('')

// 每日待办（checkin blob）：跨天延续 + 连续统计
const ci = useCheckin()
provide(checkinKey, ci)

onMounted(async () => {
  await store.loadEntry(store.currentDate)
  await ci.init()
})

// 普通待办（todo blob）：当日一次性清单
const todos = ref<TodoItem[]>([])

function loadTodos() {
  const data = store.entry?.moduleData?.todo as { items?: TodoItem[] } | undefined
  const items = data?.items ?? []
  if (items.some(t => t && !t.id)) {
    todos.value = items.map(t => ({ ...t, id: t.id ?? crypto.randomUUID() }))
    void store.updateModuleData('todo', { items: todos.value })
  } else {
    todos.value = items
  }
}

watch(() => store.entry, loadTodos, { immediate: true })

const activeTodos = computed(() => todos.value.filter(t => !t.done))
const doneTodos = computed(() => todos.value.filter(t => t.done))

const combined = computed(() => combinedDayProgress(todos.value, ci.items, ci.checks))

const weekdays = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六']

const dateDisplay = computed(() => {
  const [y, m, d] = store.currentDate.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  const wd = weekdays[date.getDay()]
  return `${store.currentDate.replace(/-/g, '/')} · ${wd}`
})

const isToday = computed(() => store.currentDate === today)

function prevDay() {
  const d = parseDate(store.currentDate)
  d.setDate(d.getDate() - 1)
  store.loadEntry(formatDate(d))
}

function nextDay() {
  if (store.currentDate >= today) return
  const d = parseDate(store.currentDate)
  d.setDate(d.getDate() + 1)
  store.loadEntry(formatDate(d))
}

async function addTodo() {
  if (!newTodo.value.trim()) return
  todos.value.push({ id: crypto.randomUUID(), text: newTodo.value.trim(), done: false })
  newTodo.value = ''
  await store.updateModuleData('todo', { items: todos.value })
}

async function toggleTodo(item: TodoItem) {
  const target = todos.value.find(t => t.id === item.id)
  if (!target) return
  target.done = !target.done
  await store.updateModuleData('todo', { items: todos.value })
}

async function deleteTodo(item: TodoItem) {
  todos.value = todos.value.filter(t => t.id !== item.id)
  await store.updateModuleData('todo', { items: todos.value })
  toast('已删除')
}
</script>

<template>
  <div class="page-pad">
    <!-- Hero Header -->
    <div class="algo-hero todo-hero">
      <div class="hero-nav left"><button @click="prevDay" aria-label="上一天">‹</button></div>
      <div class="hero-nav right"><button v-if="!isToday" @click="nextDay" aria-label="下一天">›</button></div>
      <div class="algo-hero-title">待办</div>
      <div class="algo-hero-sub">
        {{ dateDisplay }}<span v-if="isToday" class="ci-today-chip">今天</span>
      </div>
      <div class="algo-hero-stats">
        <div class="algo-stat">
          <div class="algo-stat-num">{{ combined.done }}/{{ combined.total }}</div>
          <div class="algo-stat-label">今日完成</div>
        </div>
        <div class="algo-stat-divider"></div>
        <div class="algo-stat">
          <div class="algo-stat-num">{{ combined.pendingTodos }}</div>
          <div class="algo-stat-label">待完成</div>
        </div>
        <div class="algo-stat-divider"></div>
        <div class="algo-stat">
          <div class="algo-stat-num">{{ ci.overallStreak }}</div>
          <div class="algo-stat-label">每日连续</div>
        </div>
      </div>
      <div class="todo-hero-progress">
        <div class="todo-hero-progress-fill" :style="{ width: combined.pct + '%' }"></div>
      </div>
    </div>

    <div class="segmented">
      <div class="segmented-item" :class="{ active: tab === 'today' }" @click="tab = 'today'">今日</div>
      <div class="segmented-item" :class="{ active: tab === 'stats' }" @click="tab = 'stats'">统计</div>
      <div class="segmented-item" :class="{ active: tab === 'manage' }" @click="tab = 'manage'">管理</div>
    </div>

    <template v-if="tab === 'today'">
      <!-- Add Bar -->
      <div class="search-bar todo-add-bar">
        <input
          class="search-input"
          v-model="newTodo"
          placeholder="添加待办..."
          @keydown.enter="addTodo"
        >
        <button class="ios-btn-sm" :disabled="!newTodo.trim()" @click="addTodo">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        </button>
      </div>

      <!-- Active Todos -->
      <div v-if="activeTodos.length" class="list-section">
        <div class="list-header">待完成 · {{ activeTodos.length }}</div>
        <div class="list-group">
          <div
            v-for="item in activeTodos"
            :key="item.id"
            class="record-item"
          >
            <div class="check-circle" @click="toggleTodo(item)">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>
            </div>
            <span class="todo-text">{{ item.text }}</span>
            <button class="icon-btn danger" @click="deleteTodo(item)">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
            </button>
          </div>
        </div>
      </div>

      <!-- Completed Todos -->
      <div v-if="doneTodos.length" class="list-section">
        <div class="list-header">已完成 · {{ doneTodos.length }}</div>
        <div class="list-group">
          <div
            v-for="item in doneTodos"
            :key="item.id"
            class="record-item"
          >
            <div class="check-circle checked" @click="toggleTodo(item)">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>
            </div>
            <span class="todo-text done">{{ item.text }}</span>
            <button class="icon-btn danger" @click="deleteTodo(item)">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
            </button>
          </div>
        </div>
      </div>

      <!-- Daily (checkin) items -->
      <CheckinTodaySection />
    </template>

    <CheckinStatsSection v-else-if="tab === 'stats'" />
    <CheckinManageSection v-else />
  </div>
</template>
