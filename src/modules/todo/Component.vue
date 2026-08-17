<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { useDiaryStore } from '@/stores/diary'
import { formatDate, parseDate } from '@/utils/date'
import { toast } from '@/utils/toast'
import type { TodoItem } from '@/types'

const store = useDiaryStore()
const newTodo = ref('')

onMounted(async () => {
  await store.loadEntry(store.currentDate)
})

const todos = ref<TodoItem[]>([])

function loadTodos() {
  const data = store.entry?.moduleData?.todo as { items?: TodoItem[] } | undefined
  todos.value = data?.items ?? []
}

watch(() => store.entry, loadTodos, { immediate: true })

const activeTodos = computed(() => todos.value.filter(t => !t.done))
const doneTodos = computed(() => todos.value.filter(t => t.done))

const completionPct = computed(() =>
  todos.value.length ? Math.round((doneTodos.value.length / todos.value.length) * 100) : 0
)

const weekdays = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六']

const dateDisplay = computed(() => {
  const [y, m, d] = store.currentDate.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  const wd = weekdays[date.getDay()]
  return `${store.currentDate.replace(/-/g, '/')} · ${wd}`
})

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

async function addTodo() {
  if (!newTodo.value.trim()) return
  todos.value.push({ text: newTodo.value.trim(), done: false })
  newTodo.value = ''
  await store.updateModuleData('todo', { items: todos.value })
}

async function toggleTodo(index: number) {
  todos.value[index].done = !todos.value[index].done
  await store.updateModuleData('todo', { items: todos.value })
}

async function deleteTodo(index: number) {
  todos.value.splice(index, 1)
  await store.updateModuleData('todo', { items: todos.value })
  toast('已删除')
}
</script>

<template>
  <div class="page-pad">
    <!-- Hero Header -->
    <div class="algo-hero todo-hero">
      <div class="hero-nav left"><button @click="prevDay" aria-label="上一天">‹</button></div>
      <div class="hero-nav right"><button @click="nextDay" aria-label="下一天">›</button></div>
      <div class="algo-hero-title">待办</div>
      <div class="algo-hero-sub">{{ dateDisplay }}</div>
      <div class="algo-hero-stats">
        <div class="algo-stat">
          <div class="algo-stat-num">{{ activeTodos.length }}</div>
          <div class="algo-stat-label">待完成</div>
        </div>
        <div class="algo-stat-divider"></div>
        <div class="algo-stat">
          <div class="algo-stat-num">{{ doneTodos.length }}</div>
          <div class="algo-stat-label">已完成</div>
        </div>
        <div class="algo-stat-divider"></div>
        <div class="algo-stat">
          <div class="algo-stat-num">{{ completionPct }}%</div>
          <div class="algo-stat-label">完成率</div>
        </div>
      </div>
      <div class="todo-hero-progress">
        <div class="todo-hero-progress-fill" :style="{ width: completionPct + '%' }"></div>
      </div>
    </div>

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
          :key="todos.indexOf(item)"
          class="record-item"
        >
          <div class="check-circle" @click="toggleTodo(todos.indexOf(item))">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>
          </div>
          <span class="todo-text">{{ item.text }}</span>
          <button class="icon-btn danger" @click="deleteTodo(todos.indexOf(item))">
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
          :key="todos.indexOf(item)"
          class="record-item"
        >
          <div class="check-circle checked" @click="toggleTodo(todos.indexOf(item))">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>
          </div>
          <span class="todo-text done">{{ item.text }}</span>
          <button class="icon-btn danger" @click="deleteTodo(todos.indexOf(item))">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
          </button>
        </div>
      </div>
    </div>

    <!-- Empty state -->
    <div v-if="!todos.length" class="empty-state">
      <div class="empty-text">还没有待办事项</div>
    </div>
  </div>
</template>
