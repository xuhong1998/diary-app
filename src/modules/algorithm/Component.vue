<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'
import { useDiaryStore } from '@/stores/diary'
import type { AlgorithmProblem } from '@/types'

const store = useDiaryStore()
onMounted(async () => {
  await store.loadEntry(store.currentDate)
})

const problems = ref<AlgorithmProblem[]>([])

const newProblem = ref({
  title: '',
  difficulty: 'easy' as AlgorithmProblem['difficulty'],
  tags: '',
  note: '',
})

function loadProblems() {
  problems.value = store.entry?.moduleData?.algorithm?.problems ?? []
}

watch(() => store.entry, loadProblems, { immediate: true, deep: true })

const difficultyLabels = {
  easy: '简单',
  medium: '中等',
  hard: '困难',
}

async function addProblem() {
  if (!newProblem.value.title.trim()) return
  problems.value.push({
    title: newProblem.value.title.trim(),
    difficulty: newProblem.value.difficulty,
    tags: newProblem.value.tags
      .split(/[,，\s]+/)
      .filter(Boolean),
    note: newProblem.value.note.trim() || undefined,
  })
  newProblem.value = { title: '', difficulty: 'easy', tags: '', note: '' }
  await store.updateModuleData('algorithm', { problems: problems.value })
}

async function deleteProblem(index: number) {
  problems.value.splice(index, 1)
  await store.updateModuleData('algorithm', { problems: problems.value })
}
</script>

<template>
  <div class="algo-page">
    <h2>算法练习</h2>

    <!-- 添加题目 -->
    <div class="add-form">
      <input v-model="newProblem.title" placeholder="题目名称" />
      <select v-model="newProblem.difficulty">
        <option value="easy">简单</option>
        <option value="medium">中等</option>
        <option value="hard">困难</option>
      </select>
      <input v-model="newProblem.tags" placeholder="标签 (逗号分隔)" />
      <textarea v-model="newProblem.note" placeholder="思路笔记 (可选)" rows="2"></textarea>
      <button class="primary" @click="addProblem" :disabled="!newProblem.title.trim()">
        添加
      </button>
    </div>

    <!-- 题目列表 -->
    <div class="problem-list">
      <div v-for="(p, i) in problems" :key="i" class="problem-item">
        <div class="problem-header">
          <span class="problem-title">{{ p.title }}</span>
          <span class="difficulty" :data-d="p.difficulty">
            {{ difficultyLabels[p.difficulty] }}
          </span>
          <button class="delete-btn" @click="deleteProblem(i)">×</button>
        </div>
        <div v-if="p.tags.length" class="tags">
          <span v-for="t in p.tags" :key="t" class="tag">{{ t }}</span>
        </div>
        <div v-if="p.note" class="problem-note">{{ p.note }}</div>
      </div>
      <div v-if="!problems.length" class="empty-hint">
        今天还没有刷题记录
      </div>
    </div>
  </div>
</template>
