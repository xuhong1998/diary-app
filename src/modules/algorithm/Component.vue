<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'
import { Dialog } from '@varlet/ui'
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

const difficultyChipType = {
  easy: 'success',
  medium: 'warning',
  hard: 'danger',
} as const

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
  Dialog({
    title: '删除题目',
    message: '确定删除这道题目的记录吗？',
    onConfirm: async () => {
      problems.value.splice(index, 1)
      await store.updateModuleData('algorithm', { problems: problems.value })
    },
  })
}
</script>

<template>
  <div class="algo-page">
    <h2>算法练习</h2>

    <!-- 添加题目 -->
    <div class="add-form">
      <var-input variant="outlined" size="small" v-model="newProblem.title" placeholder="题目名称" />
      <var-select variant="outlined" size="small" v-model="newProblem.difficulty" placeholder="难度">
        <var-option value="easy">简单</var-option>
        <var-option value="medium">中等</var-option>
        <var-option value="hard">困难</var-option>
      </var-select>
      <var-input variant="outlined" size="small" v-model="newProblem.tags" placeholder="标签 (逗号分隔)" />
      <var-input
        variant="outlined"
        size="small"
        :multiline="true"
        :rows="2"
        v-model="newProblem.note"
        placeholder="思路笔记 (可选)"
      />
      <var-button type="primary" block :disabled="!newProblem.title.trim()" @click="addProblem">
        添加
      </var-button>
    </div>

    <!-- 题目列表 -->
    <div class="problem-list">
      <var-paper
        v-for="(p, i) in problems"
        :key="i"
        :elevation="2"
        class="problem-item"
      >
        <div class="problem-header">
          <span class="problem-title">{{ p.title }}</span>
          <var-chip :type="difficultyChipType[p.difficulty]">
            {{ difficultyLabels[p.difficulty] }}
          </var-chip>
          <var-button text size="small" @click="deleteProblem(i)">×</var-button>
        </div>
        <div v-if="p.tags.length" class="tags">
          <var-chip v-for="t in p.tags" :key="t">{{ t }}</var-chip>
        </div>
        <div v-if="p.note" class="problem-note">{{ p.note }}</div>
      </var-paper>
      <var-paper v-if="!problems.length" :elevation="0" class="empty-hint">
        今天还没有刷题记录
      </var-paper>
    </div>
  </div>
</template>

<style scoped>
.problem-header {
  display: flex;
  align-items: center;
  gap: 8px;
}
.problem-title {
  flex: 1;
  font-weight: 600;
  font-size: 15px;
}
.tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 8px;
}
.problem-note {
  margin-top: 8px;
  font-size: 13px;
  color: #888;
  line-height: 1.5;
}
.empty-hint {
  text-align: center;
  color: #bbb;
  padding: 40px 0;
  font-size: 14px;
}
</style>
