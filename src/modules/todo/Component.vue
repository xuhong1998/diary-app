<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'
import { useDiaryStore } from '@/stores/diary'
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
}
</script>

<template>
  <div class="todo-page">
    <h2>待办事项</h2>

    <div class="quick-input">
      <input
        v-model="newTodo"
        @keyup.enter="addTodo"
        placeholder="添加待办..."
      />
      <button @click="addTodo" :disabled="!newTodo.trim()">+</button>
    </div>

    <div class="todo-list">
      <div v-for="(item, i) in todos" :key="i" class="todo-item">
        <label>
          <input type="checkbox" :checked="item.done" @change="toggleTodo(i)" />
          <span :class="{ done: item.done }">{{ item.text }}</span>
        </label>
        <button class="delete-btn" @click="deleteTodo(i)">×</button>
      </div>
    </div>

    <div class="stats">
      <span>完成 {{ todos.filter(t => t.done).length }} / {{ todos.length }}</span>
    </div>
  </div>
</template>
