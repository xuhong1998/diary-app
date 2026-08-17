<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { useDiaryStore } from '@/stores/diary'
import { powerSyncDb } from '@/db/powersync'
import { formatDate, parseDate, todayStr } from '@/utils/date'
import { parseModuleData } from '@/utils/moduleData'
import { toast } from '@/utils/toast'
import { applyReview, dueItems, initialReviewFields, masteryOf } from '@/utils/review'
import type { Mastery, ReviewResult } from '@/utils/review'
import type { InterviewItem, InterviewModuleData } from '@/types'

const store = useDiaryStore()

const PRESET_CATEGORIES = [
  'JavaScript', 'CSS', 'Vue', '浏览器', '网络',
  '性能优化', '工程化', '手写题', '项目场景', '其他',
]

const masteryLabels: Record<Mastery, string> = {
  new: '新学',
  learning: '巩固中',
  mastered: '已掌握',
}

interface InterviewEntry {
  date: string
  items: InterviewItem[]
  summary: string
}

const items = ref<InterviewItem[]>([])
const summary = ref('')
const allEntries = ref<InterviewEntry[]>([])
const filterCategory = ref('全部')

const addSheetOpen = ref(false)
const summarySheetOpen = ref(false)
const detailOpen = ref(false)
const detailId = ref<string | null>(null)
const editingId = ref<string | null>(null)

const newItem = ref({
  topic: '',
  category: 'JavaScript',
  customCategory: '',
  note: '',
})

const summaryText = ref('')

const reviewSheetOpen = ref(false)
const reviewQueue = ref<{ item: InterviewItem; date: string }[]>([])
const reviewIndex = ref(0)
const revealNote = ref(false)
const reviewFinished = ref(false)

onMounted(async () => {
  await store.loadEntry(store.currentDate)
  await loadAll()
})

watch(() => store.entry, () => {
  loadItems()
  filterCategory.value = '全部'
}, { immediate: true })

function loadItems() {
  const data = store.entry?.moduleData?.interview as InterviewModuleData | undefined
  items.value = data?.items ?? []
  summary.value = data?.summary ?? ''
}

async function loadAll() {
  try {
    const rows = await powerSyncDb.getAll<{ date: string; data: string }>(
      'SELECT date, data FROM modules WHERE module_id = ? AND deleted_at IS NULL ORDER BY date DESC',
      ['interview']
    )
    allEntries.value = rows.map(r => {
      const parsed = parseModuleData(r.data) as Partial<InterviewModuleData>
      return { date: r.date, items: parsed.items ?? [], summary: parsed.summary ?? '' }
    })
  } catch (e) {
    console.error('[interview] loadAll failed:', e)
  }
}

async function persist() {
  await store.updateModuleData('interview', {
    items: items.value,
    summary: summary.value,
  })
}

const stats = computed(() => {
  const t = todayStr()
  let total = 0
  const catCount: Record<string, number> = {}
  const mastery = { new: 0, learning: 0, mastered: 0 }
  const dateMap: Record<string, number> = {}
  for (const e of allEntries.value) {
    if (e.items.length) {
      total += e.items.length
      dateMap[e.date] = e.items.length
    }
    for (const it of e.items) {
      catCount[it.category] = (catCount[it.category] ?? 0) + 1
      mastery[masteryOf(it)]++
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
    today: dateMap[store.currentDate] ?? 0,
    due: dueItems(allEntries.value, t).length,
    streak,
    catCount,
    mastery,
  }
})

const categoryStats = computed(() => {
  const entries = Object.entries(stats.value.catCount).sort((a, b) => b[1] - a[1])
  const max = entries[0]?.[1] ?? 1
  return entries.map(([name, count]) => ({
    name,
    count,
    pct: Math.round((count / max) * 100),
  }))
})

const masteryPct = computed(() => {
  const total = stats.value.total || 1
  return {
    new: (stats.value.mastery.new / total) * 100,
    learning: (stats.value.mastery.learning / total) * 100,
    mastered: (stats.value.mastery.mastered / total) * 100,
  }
})

const knownCategories = computed(() => {
  const customs = new Set<string>()
  for (const e of allEntries.value) {
    for (const it of e.items) {
      if (!PRESET_CATEGORIES.includes(it.category)) customs.add(it.category)
    }
  }
  return [...PRESET_CATEGORIES, ...customs]
})

const filterChips = computed(() => {
  const counts: Record<string, number> = {}
  for (const it of items.value) counts[it.category] = (counts[it.category] ?? 0) + 1
  const cats = Object.keys(counts).sort((a, b) => counts[b] - counts[a])
  return ['全部', ...cats]
})

const filteredItems = computed(() => {
  if (filterCategory.value === '全部') return items.value
  return items.value.filter(i => i.category === filterCategory.value)
})

const detailItem = computed(() =>
  detailId.value ? items.value.find(i => i.id === detailId.value) ?? null : null
)

const currentReview = computed(() => reviewQueue.value[reviewIndex.value] ?? null)

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

function openAddSheet() {
  editingId.value = null
  newItem.value = { topic: '', category: 'JavaScript', customCategory: '', note: '' }
  addSheetOpen.value = true
}

function openEdit(id: string) {
  const it = items.value.find(i => i.id === id)
  if (!it) return
  editingId.value = id
  newItem.value = {
    topic: it.topic,
    category: PRESET_CATEGORIES.includes(it.category) ? it.category : 'JavaScript',
    customCategory: PRESET_CATEGORIES.includes(it.category) ? '' : it.category,
    note: it.note,
  }
  addSheetOpen.value = true
}

function selectCategory(c: string) {
  newItem.value.category = c
  newItem.value.customCategory = ''
}

async function saveItem() {
  const topic = newItem.value.topic.trim()
  if (!topic) return
  const category = (newItem.value.customCategory.trim() || newItem.value.category).trim()
  if (!category) return
  const note = newItem.value.note.trim()
  const wasEditing = editingId.value !== null

  if (wasEditing && editingId.value) {
    const idx = items.value.findIndex(i => i.id === editingId.value)
    if (idx >= 0) items.value[idx] = { ...items.value[idx], topic, category, note }
  } else {
    items.value.push({
      id: crypto.randomUUID(),
      topic,
      category,
      note,
      ...initialReviewFields(todayStr()),
    })
  }

  await persist()
  addSheetOpen.value = false
  editingId.value = null
  await loadAll()
  toast(wasEditing ? '已更新' : '已添加')
}

async function removeItem(id: string) {
  items.value = items.value.filter(i => i.id !== id)
  await persist()
  await loadAll()
  toast('已删除')
}

function openDetail(id: string) {
  detailId.value = id
  detailOpen.value = true
}

function editFromDetail() {
  if (!detailId.value) return
  detailOpen.value = false
  openEdit(detailId.value)
}

async function deleteFromDetail() {
  if (!detailId.value) return
  detailOpen.value = false
  await removeItem(detailId.value)
  detailId.value = null
}

function openSummarySheet() {
  summaryText.value = summary.value
  summarySheetOpen.value = true
}

async function saveSummary() {
  summary.value = summaryText.value
  await persist()
  summarySheetOpen.value = false
  toast('已保存')
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

function reviewOne(item: InterviewItem) {
  reviewQueue.value = [{ item, date: store.currentDate }]
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
    const nextItems = target.items.map(i => (i.id === updated.id ? updated : i))
    if (entry.date === store.currentDate) items.value = nextItems
    await store.updateModuleData('interview', { items: nextItems, summary: target.summary }, entry.date)
    target.items = nextItems
  }

  if (reviewIndex.value < reviewQueue.value.length - 1) {
    reviewIndex.value++
    revealNote.value = false
  } else {
    reviewFinished.value = true
  }
}
</script>

<template>
  <div class="page-pad">
    <!-- Hero Header -->
    <div class="algo-hero iv-hero">
      <div class="hero-nav left"><button @click="prevDay" aria-label="上一天">‹</button></div>
      <div class="hero-nav right"><button @click="nextDay" aria-label="下一天">›</button></div>
      <div class="algo-hero-title">面试题</div>
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
          <div class="algo-stat-num">{{ stats.due }}</div>
          <div class="algo-stat-label">待复习</div>
        </div>
        <div class="algo-stat-divider"></div>
        <div class="algo-stat">
          <div class="algo-stat-num">{{ stats.streak }}</div>
          <div class="algo-stat-label">连续天数</div>
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
        <div class="add-trigger-sub">{{ stats.due ? '回顾到期知识点，加深记忆' : '今日没有到期的复习，继续加油' }}</div>
      </div>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--label-quaternary)" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
    </div>

    <!-- Add Trigger Card -->
    <div class="add-trigger" @click="openAddSheet">
      <div class="add-trigger-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
      </div>
      <div class="add-trigger-text">
        <div class="add-trigger-title">添加知识点</div>
        <div class="add-trigger-sub">记录今天学习的面试题和笔记</div>
      </div>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--label-quaternary)" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
    </div>

    <!-- Category Filter Chips -->
    <div v-if="items.length" class="chip-scroll">
      <button
        v-for="c in filterChips"
        :key="c"
        class="chip"
        :class="{ active: filterCategory === c }"
        @click="filterCategory = c"
      >{{ c }}</button>
    </div>

    <!-- Item List -->
    <div v-if="filteredItems.length" class="section-title-row">
      <div class="list-header">今日记录 · {{ filteredItems.length }} 条</div>
    </div>

    <div
      v-for="it in filteredItems"
      :key="it.id"
      class="problem-v2"
      :class="'m-' + masteryOf(it)"
      @click="openDetail(it.id)"
    >
      <div class="problem-v2-header">
        <span class="problem-v2-title">{{ it.topic }}</span>
        <span class="badge" :class="'badge-' + masteryOf(it)">{{ masteryLabels[masteryOf(it)] }}</span>
        <button class="icon-btn" @click.stop="openEdit(it.id)">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        </button>
        <button class="icon-btn danger" @click.stop="removeItem(it.id)">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
        </button>
      </div>
      <div v-if="it.note" class="problem-v2-body">
        <div class="note-block">{{ it.note }}</div>
        <div v-if="it.note.length > 100" class="note-expand-hint">查看全部 ›</div>
      </div>
    </div>

    <div v-if="!items.length" class="empty-state">
      <div class="empty-text">还没有记录面试题</div>
    </div>

    <!-- Daily Summary -->
    <div class="summary-card" @click="openSummarySheet">
      <div class="summary-card-title">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
        今日总结
      </div>
      <div v-if="summary" class="summary-card-text">{{ summary }}</div>
      <div v-else class="summary-card-empty">回顾一下今天学到了什么…</div>
    </div>

    <!-- Stats -->
    <div class="list-section">
      <div class="list-header">统计</div>
      <div class="list-group">
        <div v-if="categoryStats.length" class="stats-block">
          <div class="stats-sub-title">分类分布</div>
          <div class="stat-rows">
            <div v-for="c in categoryStats" :key="c.name" class="stat-row">
              <span class="stat-row-label">{{ c.name }}</span>
              <div class="stat-track"><div class="stat-fill" :style="{ width: c.pct + '%' }"></div></div>
              <span class="stat-count">{{ c.count }}</span>
            </div>
          </div>
        </div>

        <div v-if="stats.total" class="stats-block">
          <div class="stats-sub-title">掌握程度</div>
          <div class="mastery-track">
            <div class="mastery-seg new" :style="{ width: masteryPct.new + '%' }"></div>
            <div class="mastery-seg learning" :style="{ width: masteryPct.learning + '%' }"></div>
            <div class="mastery-seg mastered" :style="{ width: masteryPct.mastered + '%' }"></div>
          </div>
          <div class="mastery-legend">
            <span class="mastery-legend-item"><span class="mastery-dot new"></span>新学 {{ stats.mastery.new }}</span>
            <span class="mastery-legend-item"><span class="mastery-dot learning"></span>巩固中 {{ stats.mastery.learning }}</span>
            <span class="mastery-legend-item"><span class="mastery-dot mastered"></span>已掌握 {{ stats.mastery.mastered }}</span>
          </div>
        </div>

        <div v-if="!stats.total" class="stats-block">
          <div class="summary-card-empty">添加知识点后这里会展示统计</div>
        </div>
      </div>
    </div>
  </div>

  <!-- Add / Edit Sheet -->
  <div class="sheet-overlay" :class="{ open: addSheetOpen }" @click="addSheetOpen = false"></div>
  <div class="sheet" :class="{ open: addSheetOpen }">
    <div class="sheet-grabber"></div>
    <div class="sheet-title">{{ editingId ? '编辑知识点' : '添加知识点' }}</div>
    <div class="sheet-body">
      <div class="algo-form-field">
        <div class="algo-field-label">知识点</div>
        <input class="algo-field-input" v-model="newItem.topic" placeholder="例如：事件循环机制">
      </div>

      <div class="algo-form-field">
        <div class="algo-field-label">分类</div>
        <div class="chip-wrap">
          <button
            v-for="c in knownCategories"
            :key="c"
            class="chip"
            :class="{ active: !newItem.customCategory && newItem.category === c }"
            @click="selectCategory(c)"
          >{{ c }}</button>
        </div>
      </div>

      <div class="algo-form-field">
        <div class="algo-field-label">自定义分类</div>
        <input class="algo-field-input" v-model="newItem.customCategory" placeholder="留空则使用上方选中的分类">
      </div>

      <div class="algo-form-field">
        <div class="algo-field-label">笔记</div>
        <textarea class="algo-field-textarea" v-model="newItem.note" placeholder="记录你的理解、关键点、面试官追问的方向..."></textarea>
        <div class="char-count">{{ newItem.note.length }} 字</div>
      </div>

      <div class="sheet-actions">
        <button class="ios-btn-secondary ios-btn-sm" style="flex:1;" @click="addSheetOpen = false">取消</button>
        <button class="ios-btn-sm" style="flex:1;" :disabled="!newItem.topic.trim()" @click="saveItem">{{ editingId ? '保存' : '添加' }}</button>
      </div>
    </div>
  </div>

  <!-- Summary Sheet -->
  <div class="sheet-overlay" :class="{ open: summarySheetOpen }" @click="summarySheetOpen = false"></div>
  <div class="sheet" :class="{ open: summarySheetOpen }">
    <div class="sheet-grabber"></div>
    <div class="sheet-title">今日总结</div>
    <div class="sheet-body">
      <div class="algo-form-field">
        <textarea class="algo-field-textarea summary-textarea" v-model="summaryText" placeholder="今天整体学得怎么样？哪些知识点还需要加强？"></textarea>
        <div class="char-count">{{ summaryText.length }} 字</div>
      </div>
      <div class="sheet-actions">
        <button class="ios-btn-secondary ios-btn-sm" style="flex:1;" @click="summarySheetOpen = false">取消</button>
        <button class="ios-btn-sm" style="flex:1;" @click="saveSummary">保存</button>
      </div>
    </div>
  </div>

  <!-- Detail Sheet -->
  <div class="sheet-overlay" :class="{ open: detailOpen }" @click="detailOpen = false"></div>
  <div v-if="detailItem" class="sheet detail-sheet" :class="{ open: detailOpen }">
    <div class="sheet-grabber"></div>
    <div class="detail-close" @click="detailOpen = false">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
    </div>
    <div class="detail-content">
      <div class="detail-meta-row">
        <span class="tag-chip">{{ detailItem.category }}</span>
        <span class="badge" :class="'badge-' + masteryOf(detailItem)">{{ masteryLabels[masteryOf(detailItem)] }}</span>
        <span class="detail-date">{{ dateDisplay }}</span>
      </div>
      <div class="detail-title">{{ detailItem.topic }}</div>
      <div v-if="detailItem.note" class="detail-note-section">
        <div class="algo-field-label">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
          笔记
        </div>
        <div class="detail-note">{{ detailItem.note }}</div>
      </div>
      <div v-else class="detail-note-empty">未记录笔记</div>
      <div class="detail-next-review">下次复习：{{ detailItem.nextReview }}</div>
    </div>
    <div class="detail-actions">
      <button class="ios-btn-secondary ios-btn-sm" @click="editFromDetail">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        编辑
      </button>
      <button class="ios-btn-sm" @click="reviewOne(detailItem)">
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
          <span class="tag-chip">{{ currentReview.item.category }}</span>
          <span class="badge" :class="'badge-' + masteryOf(currentReview.item)">{{ masteryLabels[masteryOf(currentReview.item)] }}</span>
        </div>
        <div class="review-topic">{{ currentReview.item.topic }}</div>
        <div v-if="!revealNote" class="review-recall">先在脑海里回想一下这个知识点…</div>
        <button v-if="!revealNote" class="review-reveal-btn" @click="revealNote = true">查看笔记</button>
        <template v-else>
          <div v-if="currentReview.item.note" class="note-block review-note">{{ currentReview.item.note }}</div>
          <div v-else class="detail-note-empty">未记录笔记</div>
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
