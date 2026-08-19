<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { useDiaryStore } from '@/stores/diary'
import { powerSyncDb } from '@/db/powersync'
import { formatDate, parseDate, todayStr } from '@/utils/date'
import { parseModuleData } from '@/utils/moduleData'
import { toast } from '@/utils/toast'
import { applyReview, dueItems, initialReviewFields, masteryOf, nextReviewDate } from '@/utils/review'
import type { Mastery, ReviewResult } from '@/utils/review'
import type { AlgorithmProblem } from '@/types'

const store = useDiaryStore()
onMounted(async () => {
  await store.loadEntry(store.currentDate)
  await loadAll()
})

const problems = ref<AlgorithmProblem[]>([])
const allEntries = ref<{ date: string; problems: AlgorithmProblem[] }[]>([])
const algoSheetOpen = ref(false)
const batchSheetOpen = ref(false)
const detailOpen = ref(false)
const detailIndex = ref<number | null>(null)
const batchText = ref('')
const batchDifficulty = ref<AlgorithmProblem['difficulty']>('medium')
const editingIndex = ref<number | null>(null)

const masteryLabels: Record<Mastery, string> = {
  new: '新学',
  learning: '巩固中',
  mastered: '已掌握',
}

const reviewSheetOpen = ref(false)
const reviewQueue = ref<{ item: AlgorithmProblem; date: string }[]>([])
const reviewIndex = ref(0)
const revealNote = ref(false)
const reviewFinished = ref(false)

const detailProblem = computed(() =>
  detailIndex.value !== null ? problems.value[detailIndex.value] ?? null : null
)

const currentReview = computed(() => reviewQueue.value[reviewIndex.value] ?? null)

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
  await loadAll()
}, { immediate: true })

const stats = computed(() => {
  const t = todayStr()
  let total = 0
  const dateMap: Record<string, number> = {}
  for (const e of allEntries.value) {
    if (e.problems.length) {
      total += e.problems.length
      dateMap[e.date] = e.problems.length
    }
  }
  let streak = 0
  const check = new Date()
  if (!dateMap[formatDate(check)]) check.setDate(check.getDate() - 1)
  while (dateMap[formatDate(check)]) {
    streak++
    check.setDate(check.getDate() - 1)
  }
  return {
    total,
    today: dateMap[t] ?? 0,
    due: dueItems(allEntries.value, t).length,
    streak,
  }
})

async function loadAll() {
  try {
    const rows = await powerSyncDb.getAll<{ date: string; data: string }>(
      'SELECT date, data FROM modules WHERE module_id = ? AND deleted_at IS NULL',
      ['algorithm']
    )
    const t = todayStr()
    const entries: { date: string; problems: AlgorithmProblem[] }[] = []
    const migrations: { date: string; problems: AlgorithmProblem[] }[] = []
    for (const r of rows) {
      const parsed = parseModuleData(r.data) as { problems?: AlgorithmProblem[] }
      let list = parsed.problems ?? []
      const outdated = list.some(p => !p.id || typeof p.stage !== 'number' || !p.nextReview)
      if (outdated) {
        list = list.map(p => ({
          ...p,
          id: p.id || crypto.randomUUID(),
          stage: typeof p.stage === 'number' ? p.stage : 0,
          nextReview: p.nextReview || nextReviewDate(0, t),
        }))
        migrations.push({ date: r.date, problems: list })
      }
      entries.push({ date: r.date, problems: list })
    }
    allEntries.value = entries
    for (const m of migrations) {
      await store.updateModuleData('algorithm', { problems: m.problems }, m.date)
    }
  } catch (e) {
    console.error('[algorithm] loadAll failed:', e)
  }
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
    const idx = editingIndex.value
    problems.value[idx] = { ...problems.value[idx], ...data }
  } else {
    problems.value.push({ id: crypto.randomUUID(), ...data, ...initialReviewFields(todayStr()) })
  }
  await store.updateModuleData('algorithm', { problems: problems.value })
  algoSheetOpen.value = false
  editingIndex.value = null
  await loadAll()
  toast(wasEditing ? '已更新' : '已添加')
}

function openDetail(index: number) {
  detailIndex.value = index
  detailOpen.value = true
}

function editFromDetail() {
  if (detailIndex.value === null) return
  detailOpen.value = false
  openEditSheet(detailIndex.value)
}

async function deleteFromDetail() {
  if (detailIndex.value === null) return
  detailOpen.value = false
  await deleteProblem(detailIndex.value)
  detailIndex.value = null
}

async function deleteProblem(index: number) {
  problems.value.splice(index, 1)
  await store.updateModuleData('algorithm', { problems: problems.value })
  await loadAll()
  toast('已删除')
}

const parsedProblems = computed(() => {
  const text = batchText.value.trim()
  if (!text) return [] as AlgorithmProblem[]
  const blocks = text.split(/\n\s*\n/).map(b => b.trim()).filter(Boolean)
  return blocks.map(block => {
    const lines = block.split('\n').map(l => l.trim()).filter(Boolean)
    const title = lines[0] ?? ''
    const tags = lines[1] ? lines[1].split(/[,，\s]+/).filter(Boolean) : []
    const note = lines.slice(2).join('\n') || undefined
    return {
      id: crypto.randomUUID(),
      title,
      difficulty: batchDifficulty.value,
      tags,
      note,
      ...initialReviewFields(todayStr()),
    }
  })
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
  await loadAll()
  toast(`已导入 ${parsed.length} 道题`)
}

function startReview() {
  if (!stats.value.due) {
    toast('今日没有待复习的题目')
    return
  }
  reviewQueue.value = dueItems(allEntries.value, todayStr())
  reviewIndex.value = 0
  revealNote.value = false
  reviewFinished.value = false
  reviewSheetOpen.value = true
}

function reviewOne(p: AlgorithmProblem) {
  reviewQueue.value = [{ item: p, date: store.currentDate }]
  reviewIndex.value = 0
  revealNote.value = false
  reviewFinished.value = false
  detailOpen.value = false
  reviewSheetOpen.value = true
}

function skipReview() {
  if (reviewIndex.value < reviewQueue.value.length - 1) {
    reviewIndex.value++
    revealNote.value = false
  } else {
    reviewFinished.value = true
  }
}

async function rate(result: ReviewResult) {
  const entry = currentReview.value
  if (!entry) return
  const updated = applyReview(entry.item, result, todayStr())

  const target = allEntries.value.find(e => e.date === entry.date)
  if (target) {
    const nextProblems = target.problems.map(p => (p.id === updated.id ? updated : p))
    if (entry.date === store.currentDate) problems.value = nextProblems
    await store.updateModuleData('algorithm', { problems: nextProblems }, entry.date)
    target.problems = nextProblems
  }

  if (reviewIndex.value < reviewQueue.value.length - 1) {
    reviewIndex.value++
    revealNote.value = false
  } else {
    reviewFinished.value = true
  }
}

const searchKeyword = ref('')
const searchResults = ref<{ date: string; problem: AlgorithmProblem }[]>([])
const searched = ref(false)

watch(searchKeyword, (v) => {
  if (!v.trim()) clearSearch()
})

async function doSearch() {
  const kw = searchKeyword.value.trim().toLowerCase()
  if (!kw) {
    clearSearch()
    return
  }
  const all = await powerSyncDb.getAll<{ date: string; data: string }>(
    'SELECT date, data FROM modules WHERE module_id = ? AND deleted_at IS NULL',
    ['algorithm']
  )
  const results: { date: string; problem: AlgorithmProblem }[] = []
  for (const m of all) {
    const parsed = parseModuleData(m.data) as { problems?: AlgorithmProblem[] }
    for (const p of parsed.problems ?? []) {
      const haystack = [p.title, ...(p.tags ?? []), p.note ?? ''].join(' ').toLowerCase()
      if (haystack.includes(kw)) results.push({ date: m.date, problem: p })
    }
  }
  results.sort((a, b) => b.date.localeCompare(a.date))
  searchResults.value = results
  searched.value = true
}

function clearSearch() {
  searchKeyword.value = ''
  searchResults.value = []
  searched.value = false
}

async function openSearchResult(r: { date: string; problem: AlgorithmProblem }) {
  if (r.date !== store.currentDate) {
    await store.loadEntry(r.date)
    loadProblems()
  }
  const index = problems.value.findIndex(p => p.id === r.problem.id)
  if (index !== -1) openDetail(index)
}
</script>

<template>
  <div class="page-pad">
    <!-- Hero Header -->
    <div class="algo-hero">
      <div class="hero-nav left"><button @click="prevDay" aria-label="上一天">‹</button></div>
      <div class="hero-nav right"><button @click="nextDay" aria-label="下一天">›</button></div>
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
        <div class="algo-stat-divider"></div>
        <div class="algo-stat">
          <div class="algo-stat-num">{{ stats.due }}</div>
          <div class="algo-stat-label">待复习</div>
        </div>
      </div>
    </div>

    <!-- Review Trigger Card -->
    <div class="add-trigger" :class="{ 'is-disabled': !stats.due }" @click="startReview">
      <div class="add-trigger-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a9 9 0 0 0-9-9 9 9 0 0 0-6.36 2.64L3 8M3 3v5h5M3 12a9 9 0 0 0 9 9 9 9 0 0 0 6.36-2.64L21 16M21 21v-5h-5"/></svg>
      </div>
      <div class="add-trigger-text">
        <div class="add-trigger-title">复习 · 待复习 {{ stats.due }} 题</div>
        <div class="add-trigger-sub">{{ stats.due ? '回顾到期题目，加深解题思路' : '今日没有到期的复习，继续加油' }}</div>
      </div>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--label-quaternary)" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
    </div>

    <!-- Search -->
    <div class="search-bar algo-search-bar">
      <input
        class="search-input"
        v-model="searchKeyword"
        placeholder="搜索题目、标签、解题思路..."
        @keydown.enter="doSearch"
      >
      <button class="ios-btn-sm" :disabled="!searchKeyword.trim()" @click="doSearch">搜索</button>
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

    <!-- Search Results -->
    <template v-if="searched">
      <div class="section-title-row">
        <div class="list-header">搜索结果 · {{ searchResults.length }} 题</div>
        <button class="algo-search-clear" @click="clearSearch">清除</button>
      </div>

      <div v-if="!searchResults.length" class="empty-state">
        <div class="empty-text">没有找到相关题目</div>
      </div>

      <div
        v-for="r in searchResults"
        :key="r.problem.id"
        class="problem-v2"
        :class="r.problem.difficulty"
        @click="openSearchResult(r)"
      >
        <div class="problem-v2-header">
          <span class="problem-v2-title">{{ r.problem.title }}</span>
          <span class="badge" :class="'badge-' + r.problem.difficulty">{{ difficultyLabels[r.problem.difficulty] }}</span>
          <span class="badge" :class="'badge-' + masteryOf(r.problem)">{{ masteryLabels[masteryOf(r.problem)] }}</span>
        </div>
        <div class="problem-v2-body">
          <div class="algo-search-date">{{ r.date }}</div>
          <div v-if="r.problem.tags.length" class="problem-v2-tags">
            <span v-for="t in r.problem.tags" :key="t" class="tag-chip">{{ t }}</span>
          </div>
        </div>
      </div>
    </template>

    <!-- Problem List -->
    <div v-if="problems.length && !searched" class="section-title-row">
      <div class="list-header">今日练习 · {{ problems.length }} 题</div>
    </div>

    <template v-if="!searched">
    <div
      v-for="(p, i) in problems"
      :key="p.id"
      class="problem-v2"
      :class="[p.difficulty, 'm-' + masteryOf(p)]"
      @click="openDetail(i)"
    >
      <div class="problem-v2-header">
        <span class="problem-v2-title">{{ p.title }}</span>
        <span class="badge" :class="'badge-' + p.difficulty">{{ difficultyLabels[p.difficulty] }}</span>
        <span class="badge" :class="'badge-' + masteryOf(p)">{{ masteryLabels[masteryOf(p)] }}</span>
        <button class="icon-btn" @click.stop="openEditSheet(i)">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        </button>
        <button class="icon-btn danger" @click.stop="deleteProblem(i)">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
        </button>
      </div>
      <div class="problem-v2-body">
        <div v-if="p.tags.length" class="problem-v2-tags">
          <span v-for="t in p.tags" :key="t" class="tag-chip">{{ t }}</span>
        </div>
        <div v-if="p.note">
          <div class="note-block">{{ p.note }}</div>
          <div v-if="p.note.length > 100" class="note-expand-hint">
            查看全部 ›
          </div>
        </div>
      </div>
    </div>

    <!-- Empty state -->
    <div v-if="!problems.length && !searched" class="empty-state">
      <div class="empty-text">还没有刷题记录</div>
    </div>
    </template>
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

  <!-- Problem Detail Sheet -->
  <div class="sheet-overlay" :class="{ open: detailOpen }" @click="detailOpen = false"></div>
  <div v-if="detailProblem" class="sheet detail-sheet" :class="[{ open: detailOpen }, detailProblem.difficulty]">
    <div class="sheet-grabber"></div>
    <div class="detail-close" @click="detailOpen = false">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
    </div>
    <div class="detail-content">
      <div class="detail-meta-row">
        <span class="badge" :class="'badge-' + detailProblem.difficulty">{{ difficultyLabels[detailProblem.difficulty] }}</span>
        <span class="badge" :class="'badge-' + masteryOf(detailProblem)">{{ masteryLabels[masteryOf(detailProblem)] }}</span>
        <span class="detail-date">{{ dateDisplay }}</span>
      </div>
      <div class="detail-title">{{ detailProblem.title }}</div>
      <div v-if="detailProblem.tags.length" class="detail-tags">
        <span v-for="t in detailProblem.tags" :key="t" class="tag-chip">{{ t }}</span>
      </div>
      <div v-if="detailProblem.note" class="detail-note-section">
        <div class="algo-field-label">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
          解题思路
        </div>
        <div class="detail-note">{{ detailProblem.note }}</div>
      </div>
      <div v-else class="detail-note-empty">未记录解题思路</div>
      <div class="detail-next-review">下次复习：{{ detailProblem.nextReview }}</div>
    </div>
    <div class="detail-actions">
      <button class="ios-btn-secondary ios-btn-sm" @click="editFromDetail">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        编辑
      </button>
      <button class="ios-btn-sm" @click="reviewOne(detailProblem)">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a9 9 0 0 0-9-9 9 9 0 0 0-6.36 2.64L3 8M3 3v5h5M3 12a9 9 0 0 0 9 9 9 9 0 0 0 6.36-2.64L21 16M21 21v-5h-5"/></svg>
        立即复习
      </button>
      <button class="ios-btn-sm detail-delete-btn" @click="deleteFromDetail">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
        删除
      </button>
    </div>
  </div>

  <!-- Review Sheet -->
  <div class="sheet-overlay" :class="{ open: reviewSheetOpen }" @click="reviewSheetOpen = false"></div>
  <div class="sheet review-sheet" :class="{ open: reviewSheetOpen }">
    <div class="sheet-grabber"></div>

    <div v-if="!reviewFinished && currentReview" class="review-body">
      <div class="review-head">
        <span class="review-progress">{{ reviewIndex + 1 }} / {{ reviewQueue.length }}</span>
        <button class="text-btn" @click="skipReview">跳过</button>
      </div>
      <div class="review-card">
        <div class="review-meta">
          <span class="badge" :class="'badge-' + currentReview.item.difficulty">{{ difficultyLabels[currentReview.item.difficulty] }}</span>
          <span class="badge" :class="'badge-' + masteryOf(currentReview.item)">{{ masteryLabels[masteryOf(currentReview.item)] }}</span>
        </div>
        <div class="review-topic">{{ currentReview.item.title }}</div>
        <div v-if="!revealNote" class="review-recall">先在脑海里回想一下解题思路…</div>
        <button v-if="!revealNote" class="review-reveal-btn" @click="revealNote = true">查看思路</button>
        <template v-else>
          <div v-if="currentReview.item.note" class="note-block review-note">{{ currentReview.item.note }}</div>
          <div v-else class="detail-note-empty">未记录解题思路</div>
        </template>
      </div>
      <div class="rate-row">
        <button class="rate-btn forgot" :disabled="!revealNote" @click="rate('forgot')">
          忘了<span class="rate-btn-sub">明天再来</span>
        </button>
        <button class="rate-btn fuzzy" :disabled="!revealNote" @click="rate('fuzzy')">
          模糊<span class="rate-btn-sub">再巩固</span>
        </button>
        <button class="rate-btn good" :disabled="!revealNote" @click="rate('good')">
          记住了<span class="rate-btn-sub">拉长间隔</span>
        </button>
      </div>
    </div>

    <div v-else class="review-done">
      <div class="review-done-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="8 12 11 15 16 9"/></svg>
      </div>
      <div class="review-done-title">{{ reviewQueue.length > 1 ? '今日复习完成' : '复习完成' }}</div>
      <div class="review-done-sub">按记忆曲线安排了下次复习时间</div>
      <button class="ios-btn-sm review-done-btn" @click="reviewSheetOpen = false">完成</button>
    </div>
  </div>
</template>
