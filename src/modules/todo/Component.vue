<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'
import { Dialog } from '@varlet/ui'
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
  Dialog({
    title: '删除待办',
    message: '确定删除这条待办吗？',
    onConfirm: async () => {
      todos.value.splice(index, 1)
      await store.updateModuleData('todo', { items: todos.value })
    },
  })
}
</script>

<template>
  <div class="todo-page">
    <h2>待办事项</h2>

    <div class="quick-input">
      <var-input
        variant="outlined"
        size="small"
        v-model="newTodo"
        placeholder="添加待办..."
        @keydown.enter="addTodo"
      />
      <var-button
        type="primary"
        size="small"
        round
        :disabled="!newTodo.trim()"
        @click="addTodo"
      >+</var-button>
    </div>

    <div class="todo-list">
      <var-cell
        v-for="(item, i) in todos"
        :key="i"
        class="todo-cell"
      >
        <template #icon>
          <var-checkbox v-model="item.done" @change="toggleTodo(i)" />
        </template>
        <span :class="{ done: item.done }">{{ item.text }}</span>
        <template #extra>
          <var-button text size="small" @click="deleteTodo(i)">×</var-button>
        </template>
      </var-cell>
    </div>

    <div class="stats">
      <span>完成 {{ todos.filter(t => t.done).length }} / {{ todos.length }}</span>
    </div>
  </div>
</template>

<style scoped>
.todo-page {
  --var-cell-horizontal-padding: 12px;
  --var-cell-vertical-padding: 12px;
}
.done {
  text-decoration: line-through;
  color: #bbb;
}
</style>
