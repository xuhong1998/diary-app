<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { useDiaryStore } from '@/stores/diary'
import { powerSyncDb } from '@/db/powersync'
import { formatDate, parseDate } from '@/utils/date'
import { parseModuleData } from '@/utils/moduleData'
import { toast } from '@/utils/toast'
import type { AlgorithmProblem } from '@/types'

const store = useDiaryStore()
onMounted(async () => {
  await store.loadEntry(store.currentDate)
  await loadStats()
})

const problems = ref<AlgorithmProblem[]>([])
const algoSheetOpen = ref(false)
const batchSheetOpen = ref(false)
const batchText = ref('')
const batchDifficulty = ref<AlgorithmProblem['difficulty']>('medium')
const editingIndex = ref<number | null>(null)
const expandedNotes = ref<Set<number>>(new Set())
const stats = ref({ today: 0, total: 0, streak: 0 })

const isEditing = computed(() => editingIndex.value !== null)

const newProblem = ref({
  title: '',
  difficulty: 'easy' as AlgorithmProblem['difficulty'],
  tags: '',
  note: '',
})

function loadProblems() {
  const data = store.entry?.moduleData?.algorithm as { problems?: AlgorithmProblem[] } | undefined
  problems.value = data?.problems ?? []
}

watch(() => store.entry, async () => {
  loadProblems()
  await loadStats()
}, { immediate: true })

async function loadStats() {
  const all = await powerSyncDb.getAll<{ date: string; data: string }>(
    'SELECT date, data FROM modules WHERE module_id = ? AND deleted_at IS NULL',
    ['algorithm']
  )
  const dateMap: Record<string, number> = {}
  let total = 0
  for (const m of all) {
    const parsed = parseModuleData(m.data) as { problems?: AlgorithmProblem[] }
    const count = parsed.problems?.length ?? 0
    if (count > 0) {
      total += count
      dateMap[m.date] = count
    }
  }
  const todayStr = formatDate(new Date())
  const today = dateMap[todayStr] ?? 0

  let streak = 0
  let check = new Date()
  if (!dateMap[formatDate(check)]) {
    check.setDate(check.getDate() - 1)
  }
  while (dateMap[formatDate(check)]) {
    streak++
    check.setDate(check.getDate() - 1)
  }

  stats.value = { today, total, streak }
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

const weekdays = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六']

const dateDisplay = computed(() => {
  const [y, m, d] = store.currentDate.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  const wd = weekdays[date.getDay()]
  return `${store.currentDate.replace(/-/g, '/')} · ${wd}`
})

const difficultyLabels = {
  easy: '简单',
  medium: '中等',
  hard: '困难',
}

function selectDiff(diff: AlgorithmProblem['difficulty']) {
  newProblem.value.difficulty = diff
}

function openAlgoSheet() {
  editingIndex.value = null
  newProblem.value = { title: '', difficulty: 'easy', tags: '', note: '' }
  algoSheetOpen.value = true
}

function openEditSheet(index: number) {
  const p = problems.value[index]
  editingIndex.value = index
  newProblem.value = {
    title: p.title,
    difficulty: p.difficulty,
    tags: p.tags.join(', '),
    note: p.note ?? '',
  }
  algoSheetOpen.value = true
}

async function saveProblem() {
  if (!newProblem.value.title.trim()) return
  const wasEditing = editingIndex.value !== null
  const data = {
    title: newProblem.value.title.trim(),
    difficulty: newProblem.value.difficulty,
    tags: newProblem.value.tags
      .split(/[,，\s]+/)
      .filter(Boolean),
    note: newProblem.value.note.trim() || undefined,
  }
  if (wasEditing && editingIndex.value !== null) {
    problems.value[editingIndex.value] = data
  } else {
    problems.value.push(data)
  }
  await store.updateModuleData('algorithm', { problems: problems.value })
  algoSheetOpen.value = false
  editingIndex.value = null
  await loadStats()
  toast(wasEditing ? '已更新' : '已添加')
}

async function deleteProblem(index: number) {
  problems.value.splice(index, 1)
  await store.updateModuleData('algorithm', { problems: problems.value })
  await loadStats()
  toast('已删除')
}

function toggleNoteExpand(index: number) {
  if (expandedNotes.value.has(index)) {
    expandedNotes.value.delete(index)
  } else {
    expandedNotes.value.add(index)
  }
}

const parsedProblems = computed(() => {
  const text = batchText.value.trim()
  if (!text) return [] as AlgorithmProblem[]
  const blocks = text.split(/\n\s*\n/).map(b => b.trim()).filter(Boolean)
  return blocks.map(block => {
    const lines = block.split('\n').map(l => l.trim()).filter(Boolean)
    if (!lines.length) return null
    const title = lines[0]
    const tags = lines[1] ? lines[1].split(/[,，\s]+/).filter(Boolean) : []
    const note = lines.slice(2).join('\n') || undefined
    return { title, difficulty: batchDifficulty.value, tags, note }
  }).filter(Boolean) as AlgorithmProblem[]
})

function openBatchSheet() {
  batchText.value = ''
  batchDifficulty.value = 'medium'
  batchSheetOpen.value = true
}

function selectBatchDiff(diff: AlgorithmProblem['difficulty']) {
  batchDifficulty.value = diff
}

async function batchImport() {
  const parsed = parsedProblems.value
  if (!parsed.length) return
  problems.value.push(...parsed)
  await store.updateModuleData('algorithm', { problems: problems.value })
  batchSheetOpen.value = false
  batchText.value = ''
  await loadStats()
  toast(`已导入 ${parsed.length} 道题`)
}
</script>

<template>
  <div class="page-pad">
    <!-- Hero Header -->
    <div class="algo-hero">
      <div class="hero-nav left"><button @click="prevDay">‹</button></div>
      <div class="hero-nav right"><button @click="nextDay">›</button></div>
      <div class="algo-hero-title">算法练习</div>
      <div class="algo-hero-sub">{{ dateDisplay }}</div>
      <div class="algo-hero-stats">
        <div class="algo-stat">
          <div class="algo-stat-num">{{ stats.today }}</div>
          <div class="algo-stat-label">今日</div>
        </div>
        <div class="algo-stat-divider"></div>
        <div class="algo-stat">
          <div class="algo-stat-num">{{ stats.total }}</div>
          <div class="algo-stat-label">累计</div>
        </div>
        <div class="algo-stat-divider"></div>
        <div class="algo-stat">
          <div class="algo-stat-num">{{ stats.streak }}</div>
          <div class="algo-stat-label">连续天数</div>
        </div>
      </div>
    </div>

    <!-- Add Trigger Card -->
    <div class="add-trigger" @click="openAlgoSheet">
      <div class="add-trigger-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
      </div>
      <div class="add-trigger-text">
        <div class="add-trigger-title">添加题目</div>
        <div class="add-trigger-sub">记录今天刷的算法题和解题思路</div>
      </div>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--label-quaternary)" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
    </div>

    <!-- Batch Import Trigger -->
    <div class="add-trigger batch-trigger" @click="openBatchSheet">
      <div class="add-trigger-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
      </div>
      <div class="add-trigger-text">
        <div class="add-trigger-title">批量导入</div>
        <div class="add-trigger-sub">粘贴文本快速导入多道题目</div>
      </div>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--label-quaternary)" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
    </div>

    <!-- Problem List -->
    <div v-if="problems.length" class="section-title-row">
      <div class="list-header">今日练习 · {{ problems.length }} 题</div>
    </div>

    <div
      v-for="(p, i) in problems"
      :key="i"
      class="problem-v2"
      :class="p.difficulty"
    >
      <div class="problem-v2-header">
        <span class="problem-v2-title">{{ p.title }}</span>
        <span class="badge" :class="'badge-' + p.difficulty">{{ difficultyLabels[p.difficulty] }}</span>
        <button class="icon-btn" @click="openEditSheet(i)">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        </button>
        <button class="icon-btn danger" @click="deleteProblem(i)">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
        </button>
      </div>
      <div class="problem-v2-body">
        <div v-if="p.tags.length" class="problem-v2-tags">
          <span v-for="t in p.tags" :key="t" class="tag-chip">{{ t }}</span>
        </div>
        <div v-if="p.note">
          <div
            class="note-block"
            :class="{ expanded: expandedNotes.has(i) }"
            @click="toggleNoteExpand(i)"
          >{{ p.note }}</div>
          <div v-if="p.note.length > 100" class="note-expand-hint" @click="toggleNoteExpand(i)">
            {{ expandedNotes.has(i) ? '收起' : '展开' }}
          </div>
        </div>
      </div>
    </div>

    <!-- Empty state -->
    <div v-if="!problems.length" class="empty-state">
      <div class="empty-text">还没有刷题记录</div>
    </div>
  </div>

  <!-- Algorithm Form Sheet -->
  <div class="sheet-overlay" :class="{ open: algoSheetOpen }" @click="algoSheetOpen = false"></div>
  <div class="sheet" :class="{ open: algoSheetOpen }">
    <div class="sheet-grabber"></div>
    <div class="sheet-title">{{ isEditing ? '编辑算法题' : '添加算法题' }}</div>
    <div class="sheet-body">
      <!-- Title -->
      <div class="algo-form-field">
        <div class="algo-field-label">题目名称</div>
        <input class="algo-field-input" v-model="newProblem.title" placeholder="例如：两数之和">
      </div>

      <!-- Difficulty -->
      <div class="algo-form-field">
        <div class="algo-field-label">难度</div>
        <div class="diff-segmented" style="margin: 0;">
          <div
            class="diff-option"
            :class="{ active: newProblem.difficulty === 'easy' }"
            data-diff="easy"
            @click="selectDiff('easy')"
          >简单</div>
          <div
            class="diff-option"
            :class="{ active: newProblem.difficulty === 'medium' }"
            data-diff="medium"
            @click="selectDiff('medium')"
          >中等</div>
          <div
            class="diff-option"
            :class="{ active: newProblem.difficulty === 'hard' }"
            data-diff="hard"
            @click="selectDiff('hard')"
          >困难</div>
        </div>
      </div>

      <!-- Tags -->
      <div class="algo-form-field">
        <div class="algo-field-label">标签</div>
        <input class="algo-field-input" v-model="newProblem.tags" placeholder="数组, 哈希表, 双指针...">
      </div>

      <!-- Note -->
      <div class="algo-form-field">
        <div class="algo-field-label">解题思路</div>
        <textarea class="algo-field-textarea" v-model="newProblem.note" placeholder="记录你的解题思路、复杂度分析、踩过的坑..."></textarea>
        <div class="char-count">{{ newProblem.note.length }} 字</div>
      </div>

      <div class="sheet-actions">
        <button class="ios-btn-secondary ios-btn-sm" style="flex:1;" @click="algoSheetOpen = false">取消</button>
        <button class="ios-btn-sm" style="flex:1;" :disabled="!newProblem.title.trim()" @click="saveProblem">{{ isEditing ? '保存' : '添加' }}</button>
      </div>
    </div>
  </div>

  <!-- Batch Import Sheet -->
  <div class="sheet-overlay" :class="{ open: batchSheetOpen }" @click="batchSheetOpen = false"></div>
  <div class="sheet batch-sheet" :class="{ open: batchSheetOpen }">
    <div class="sheet-grabber"></div>
    <div class="sheet-title">批量导入</div>
    <div class="sheet-body">
      <div class="algo-form-field">
        <div class="algo-field-label">默认难度</div>
        <div class="diff-segmented" style="margin: 0;">
          <div
            class="diff-option"
            :class="{ active: batchDifficulty === 'easy' }"
            data-diff="easy"
            @click="selectBatchDiff('easy')"
          >简单</div>
          <div
            class="diff-option"
            :class="{ active: batchDifficulty === 'medium' }"
            data-diff="medium"
            @click="selectBatchDiff('medium')"
          >中等</div>
          <div
            class="diff-option"
            :class="{ active: batchDifficulty === 'hard' }"
            data-diff="hard"
            @click="selectBatchDiff('hard')"
          >困难</div>
        </div>
      </div>

      <div class="algo-form-field">
        <div class="algo-field-label">题目内容</div>
        <textarea
          class="algo-field-textarea batch-textarea"
          v-model="batchText"
          placeholder="每道题用空行分隔，格式：&#10;第一行：题目名称&#10;第二行：标签（逗号分隔）&#10;第三行起：解题思路&#10;&#10;例如：&#10;字符串解码&#10;单调栈&#10;这题主要需要两个单调栈…"
        ></textarea>
      </div>

      <div v-if="parsedProblems.length" class="batch-preview">
        <div class="batch-preview-title">预览 · {{ parsedProblems.length }} 题</div>
        <div v-for="(p, i) in parsedProblems" :key="i" class="batch-preview-item">
          <span class="batch-preview-name">{{ p.title }}</span>
          <span v-if="p.tags.length" class="batch-preview-tags">{{ p.tags.join('、') }}</span>
        </div>
      </div>

      <div class="sheet-actions">
        <button class="ios-btn-secondary ios-btn-sm" style="flex:1;" @click="batchSheetOpen = false">取消</button>
        <button class="ios-btn-sm" style="flex:1;" :disabled="!parsedProblems.length" @click="batchImport">导入 {{ parsedProblems.length || '' }} 题</button>
      </div>
    </div>
  </div>
</template>
