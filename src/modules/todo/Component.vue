<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { useDiaryStore } from '@/stores/diary'
import { toast } from '@/utils/toast'
import type { TodoItem } from '@/types'

const store = useDiaryStore()
const newTodo = ref('')

onMounted(async () => {
  await store.loadEntry(store.currentDate)
})

const todos = ref<TodoItem[]>([])

function loadTodos() {
  todos.value = store.entry?.moduleData?.todo?.items ?? []
}

watch(() => store.entry, loadTodos, { immediate: true, deep: true })

const activeTodos = computed(() => todos.value.filter(t => !t.done))
const doneTodos = computed(() => todos.value.filter(t => t.done))

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
    <div class="section-gap"></div>

    <!-- Stats -->
    <div class="stats-pill">
      完成 {{ doneTodos.length }} / {{ todos.length }}
    </div>

    <!-- Active Todos -->
    <div v-if="activeTodos.length" class="list-section">
      <div class="list-header">待完成</div>
      <div class="list-group">
        <div
          v-for="(item, i) in activeTodos"
          :key="i"
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
      <div class="list-header">已完成</div>
      <div class="list-group">
        <div
          v-for="(item, i) in doneTodos"
          :key="i"
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

    <!-- Add Todo -->
    <div class="search-bar" style="margin-top: 8px;">
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
  </div>
</template>
