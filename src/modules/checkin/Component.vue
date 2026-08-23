<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { useDiaryStore } from '@/stores/diary'
import { powerSyncDb } from '@/db/powersync'
import { formatDate, parseDate, todayStr, nowTime } from '@/utils/date'
import { toast } from '@/utils/toast'
import {
  CHECKIN_PRESETS,
  CHECKIN_ICONS,
  parseCheckinData,
  isChecked,
  buildStreak,
  quitStreak,
  lastDaysState,
  monthStats,
  todayProgress,
  activityStreak,
  firstSeenDates,
  type CheckinDay,
  type DayDot,
} from '@/utils/checkin'
import type { CheckinItem, CheckinKind, CheckinCheck } from '@/types'

const store = useDiaryStore()
const today = todayStr()

const tab = ref<'check' | 'stats' | 'manage'>('check')

const items = ref<CheckinItem[]>([])
const checks = ref<Record<string, CheckinCheck>>({})
const allDays = ref<CheckinDay[]>([])

onMounted(async () => {
  await store.loadEntry(store.currentDate)
  await loadAll()
  loadData()
})

async function loadAll() {
  try {
    const rows = await powerSyncDb.getAll<{ date: string; data: string }>(
      'SELECT date, data FROM modules WHERE module_id = ? AND deleted_at IS NULL ORDER BY date DESC',
      ['checkin']
    )
    allDays.value = rows.map(r => ({ date: r.date, ...parseCheckinData(r.data) }))
  } catch (e) {
    console.error('[checkin] loadAll failed:', e)
  }
}

function loadData() {
  const raw = store.entry?.moduleData?.checkin
  if (raw && Object.keys(raw as object).length) {
    const d = parseCheckinData(raw)
    items.value = d.items
    checks.value = d.checks
  } else {
    const seedDay = allDays.value.find(d => d.items.length)
    items.value = seedDay ? seedDay.items.map(i => ({ ...i })) : []
    checks.value = {}
    if (items.value.length && store.currentDate === today) {
      void persist()
    }
  }
}

watch(() => store.entry, () => {
  loadData()
})

function upsertLocalDay() {
  const date = store.currentDate
  const day: CheckinDay = { date, items: [...items.value], checks: { ...checks.value } }
  const idx = allDays.value.findIndex(d => d.date === date)
  if (idx >= 0) {
    allDays.value[idx] = day
  } else {
    allDays.value = [...allDays.value, day].sort((a, b) => b.date.localeCompare(a.date))
  }
}

async function persist(): Promise<boolean> {
  try {
    await store.updateModuleData('checkin', { items: items.value, checks: checks.value })
    upsertLocalDay()
    return true
  } catch (e) {
    console.error('[checkin] persist failed:', e)
    toast('保存失败，请稍后重试')
    return false
  }
}

const weekdays = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六']
const weekdaysShort = ['日', '一', '二', '三', '四', '五', '六']

const dateDisplay = computed(() => {
  const d = parseDate(store.currentDate)
  return `${store.currentDate.replace(/-/g, '/')} · ${weekdays[d.getDay()]}`
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

const activeItems = computed(() => items.value.filter(i => i.active))

const progress = computed(() => todayProgress(items.value, checks.value))
const progressPct = computed(() =>
  progress.value.total ? Math.round((progress.value.done / progress.value.total) * 100) : 0
)

const dayChecksMap = computed(() => {
  const map: Record<string, Record<string, CheckinCheck>> = {}
  for (const d of allDays.value) map[d.date] = d.checks
  map[store.currentDate] = checks.value
  return map
})

const overallStreak = computed(() => activityStreak(dayChecksMap.value, today))
const firstSeen = computed(() => firstSeenDates(allDays.value))

function streakOf(item: CheckinItem): number {
  if (item.kind === 'build') {
    return buildStreak(dayChecksMap.value, item.id, today)
  }
  return quitStreak(dayChecksMap.value, item.id, today, firstSeen.value[item.id] ?? '')
}

function last7Of(item: CheckinItem): DayDot[] {
  return lastDaysState(dayChecksMap.value, item.id, item.kind, today, firstSeen.value[item.id] ?? '')
}

function monthOf(item: CheckinItem) {
  return monthStats(dayChecksMap.value, item.id, item.kind, today, firstSeen.value[item.id] ?? '')
}

function weekdayOf(date: string): string {
  return weekdaysShort[parseDate(date).getDay()]
}

async function toggleCheck(item: CheckinItem) {
  if (isChecked(checks.value, item.id)) {
    delete checks.value[item.id]
  } else {
    checks.value[item.id] = { v: 1, at: nowTime() }
  }
  checks.value = { ...checks.value }
  await persist()
}

const newName = ref('')
const newIcon = ref('✅')
const newKind = ref<CheckinKind>('build')

async function addItem(name: string, icon: string, kind: CheckinKind) {
  const n = name.trim()
  if (!n) return
  if (items.value.some(i => i.name === n)) {
    toast('已存在同名打卡项')
    return
  }
  items.value = [
    ...items.value,
    { id: crypto.randomUUID(), name: n, icon, kind, active: true, createdAt: todayStr() },
  ]
  if (await persist()) toast('已添加')
}

async function submitNew() {
  await addItem(newName.value, newIcon.value, newKind.value)
  newName.value = ''
}

function presetAdded(p: { name: string }) {
  return items.value.some(i => i.name === p.name)
}

async function moveItem(index: number, dir: number) {
  const j = index + dir
  if (j < 0 || j >= items.value.length) return
  const arr = [...items.value]
  ;[arr[index], arr[j]] = [arr[j], arr[index]]
  items.value = arr
  await persist()
}

const editing = ref<CheckinItem | null>(null)
const editName = ref('')
const editIcon = ref('')
const editKind = ref<CheckinKind>('build')

function openEdit(item: CheckinItem) {
  editing.value = item
  editName.value = item.name
  editIcon.value = item.icon
  editKind.value = item.kind
}

async function saveEdit() {
  if (!editing.value || !editName.value.trim()) return
  const target = items.value.find(i => i.id === editing.value!.id)
  if (target) {
    target.name = editName.value.trim()
    target.icon = editIcon.value
    target.kind = editKind.value
    items.value = [...items.value]
  }
  editing.value = null
  if (await persist()) toast('已保存')
}

async function toggleArchive(item: CheckinItem) {
  const target = items.value.find(i => i.id === item.id)
  if (target) {
    target.active = !target.active
    items.value = [...items.value]
  }
  editing.value = null
  if (await persist()) toast(target?.active ? '已恢复' : '已归档')
}

async function removeItem(item: CheckinItem) {
  items.value = items.value.filter(i => i.id !== item.id)
  editing.value = null
  if (await persist()) toast('已删除')
}
</script>

<template>
  <div class="page-pad">
    <div class="algo-hero checkin-hero">
      <div class="hero-nav left"><button @click="prevDay" aria-label="上一天">‹</button></div>
      <div class="hero-nav right"><button v-if="!isToday" @click="nextDay" aria-label="下一天">›</button></div>
      <div class="algo-hero-title">每日打卡</div>
      <div class="algo-hero-sub">
        {{ dateDisplay }}<span v-if="isToday" class="ci-today-chip">今天</span>
      </div>
      <div class="algo-hero-stats">
        <div class="algo-stat">
          <div class="algo-stat-num">{{ progress.done }}/{{ progress.total }}</div>
          <div class="algo-stat-label">今日达成</div>
        </div>
        <div class="algo-stat-divider"></div>
        <div class="algo-stat">
          <div class="algo-stat-num">{{ overallStreak }}</div>
          <div class="algo-stat-label">连续天数</div>
        </div>
        <div class="algo-stat-divider"></div>
        <div class="algo-stat">
          <div class="algo-stat-num">{{ progress.violated }}</div>
          <div class="algo-stat-label">今日破戒</div>
        </div>
      </div>
      <div class="todo-hero-progress">
        <div class="todo-hero-progress-fill" :style="{ width: progressPct + '%' }"></div>
      </div>
    </div>

    <div class="segmented">
      <div class="segmented-item" :class="{ active: tab === 'check' }" @click="tab = 'check'">打卡</div>
      <div class="segmented-item" :class="{ active: tab === 'stats' }" @click="tab = 'stats'">统计</div>
      <div class="segmented-item" :class="{ active: tab === 'manage' }" @click="tab = 'manage'">管理</div>
    </div>

    <template v-if="tab === 'check'">
      <div v-if="activeItems.length" class="list-section">
        <div class="list-header">{{ isToday ? '今天' : '当日' }} · 达成 {{ progress.done }}/{{ progress.total }}</div>
        <div class="list-group">
          <div v-for="item in activeItems" :key="item.id" class="record-item ci-row">
            <div class="ci-icon">{{ item.icon }}</div>
            <div class="ci-main">
              <div class="ci-name" :class="{ struck: item.kind === 'quit' && isChecked(checks, item.id) }">{{ item.name }}</div>
              <div class="ci-meta">
                <span class="ci-kind" :class="item.kind">{{ item.kind === 'build' ? '养成' : '戒断' }}</span>
                <span v-if="isChecked(checks, item.id)" class="ci-time">{{ item.kind === 'quit' ? '破戒' : '达成' }} · {{ checks[item.id].at }}</span>
                <span v-else class="ci-hint">{{ item.kind === 'build' ? '待打卡' : '未破戒' }}</span>
              </div>
            </div>
            <div
              v-if="item.kind === 'build'"
              class="check-circle"
              :class="{ checked: isChecked(checks, item.id) }"
              @click="toggleCheck(item)"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>
            </div>
            <button
              v-else
              class="ci-quit-btn"
              :class="{ violated: isChecked(checks, item.id) }"
              @click="toggleCheck(item)"
              :aria-label="isChecked(checks, item.id) ? '取消破戒标记' : '标记破戒'"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
        </div>
        <div class="list-footer">养成型：点勾即达成 · 戒断型：仅在破戒时点 ✕</div>
      </div>

      <div v-else-if="!items.length" class="empty-state">
        <div class="empty-text">还没有打卡项</div>
        <div class="ci-presets empty-presets">
          <button
            v-for="p in CHECKIN_PRESETS"
            :key="p.name"
            class="ci-preset"
            @click="addItem(p.name, p.icon, p.kind)"
          >{{ p.icon }} {{ p.name }}</button>
        </div>
      </div>

      <div v-else class="empty-state">
        <div class="empty-text">当日没有启用的打卡项</div>
      </div>
    </template>

    <template v-if="tab === 'stats'">
      <div v-if="items.length" class="list-section">
        <div class="ci-stat-list">
          <div v-for="item in items" :key="item.id" class="ci-stat-card" :class="{ archived: !item.active }">
            <div class="ci-stat-head">
              <span class="ci-icon">{{ item.icon }}</span>
              <span class="ci-name">{{ item.name }}</span>
              <span class="ci-kind" :class="item.kind">{{ item.kind === 'build' ? '养成' : '戒断' }}</span>
              <span class="ci-streak">🔥 {{ streakOf(item) }}</span>
            </div>
            <div class="ci-dots">
              <div v-for="d in last7Of(item)" :key="d.date" class="ci-dot-wrap">
                <div class="ci-dot" :class="[d.state, { today: d.isToday }]"></div>
                <div class="ci-dot-label">{{ weekdayOf(d.date) }}</div>
              </div>
            </div>
            <div class="ci-stat-foot">
              本月 {{ monthOf(item).hit }}/{{ monthOf(item).total }}{{ !item.active ? ' · 已归档' : '' }}
            </div>
          </div>
        </div>
      </div>
      <div v-else class="empty-state">
        <div class="empty-text">添加打卡项后这里会显示统计</div>
      </div>
    </template>

    <template v-if="tab === 'manage'">
      <div class="list-section">
        <div class="list-header">快速添加</div>
        <div class="ci-presets">
          <button
            v-for="p in CHECKIN_PRESETS"
            :key="p.name"
            class="ci-preset"
            :class="{ added: presetAdded(p) }"
            :disabled="presetAdded(p)"
            @click="addItem(p.name, p.icon, p.kind)"
          >{{ p.icon }} {{ p.name }}</button>
        </div>
      </div>

      <div class="list-section">
        <div class="list-header">自定义打卡项</div>
        <div class="list-group ci-form">
          <input class="search-input ci-form-input" v-model="newName" placeholder="名称，如：早睡" @keydown.enter="submitNew">
          <div class="ci-emoji-grid">
            <button
              v-for="ic in CHECKIN_ICONS"
              :key="ic"
              class="ci-emoji"
              :class="{ selected: newIcon === ic }"
              @click="newIcon = ic"
            >{{ ic }}</button>
          </div>
          <div class="ci-kind-picker">
            <div class="ci-kind-option" :class="{ selected: newKind === 'build' }" @click="newKind = 'build'">
              <span class="ci-kind build">养成</span>
              <span class="ci-kind-desc">勾选即达成</span>
            </div>
            <div class="ci-kind-option" :class="{ selected: newKind === 'quit' }" @click="newKind = 'quit'">
              <span class="ci-kind quit">戒断</span>
              <span class="ci-kind-desc">破戒时标记</span>
            </div>
          </div>
          <button class="ios-btn" :disabled="!newName.trim()" @click="submitNew">添加打卡项</button>
        </div>
      </div>

      <div v-if="items.length" class="list-section">
        <div class="list-header">全部打卡项 · {{ items.length }}</div>
        <div class="list-group">
          <div v-for="(item, index) in items" :key="item.id" class="record-item ci-manage-row" :class="{ archived: !item.active }">
            <div class="ci-icon">{{ item.icon }}</div>
            <div class="ci-main">
              <div class="ci-name">{{ item.name }}</div>
              <div class="ci-meta">
                <span class="ci-kind" :class="item.kind">{{ item.kind === 'build' ? '养成' : '戒断' }}</span>
                <span v-if="!item.active" class="ci-hint">已归档</span>
              </div>
            </div>
            <button class="icon-btn muted" @click="moveItem(index, -1)" aria-label="上移">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="18 15 12 9 6 15"/></svg>
            </button>
            <button class="icon-btn muted" @click="moveItem(index, 1)" aria-label="下移">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"/></svg>
            </button>
            <button class="icon-btn" @click="openEdit(item)" aria-label="编辑">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            </button>
            <button class="icon-btn danger" @click="removeItem(item)" aria-label="删除">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
            </button>
          </div>
        </div>
        <div class="list-footer">排序调整会影响打卡页显示顺序 · 归档项不显示在打卡列表</div>
      </div>
    </template>

    <div class="sheet-overlay" :class="{ open: !!editing }" @click="editing = null"></div>
    <div class="sheet" :class="{ open: !!editing }">
      <div class="sheet-grabber"></div>
      <div class="sheet-title">编辑打卡项</div>
      <div v-if="editing" class="sheet-body">
        <input class="search-input ci-form-input" v-model="editName" placeholder="名称">
        <div class="ci-emoji-grid">
          <button
            v-for="ic in CHECKIN_ICONS"
            :key="ic"
            class="ci-emoji"
            :class="{ selected: editIcon === ic }"
            @click="editIcon = ic"
          >{{ ic }}</button>
        </div>
        <div class="ci-kind-picker">
          <div class="ci-kind-option" :class="{ selected: editKind === 'build' }" @click="editKind = 'build'">
            <span class="ci-kind build">养成</span>
            <span class="ci-kind-desc">勾选即达成</span>
          </div>
          <div class="ci-kind-option" :class="{ selected: editKind === 'quit' }" @click="editKind = 'quit'">
            <span class="ci-kind quit">戒断</span>
            <span class="ci-kind-desc">破戒时标记</span>
          </div>
        </div>
        <div class="sheet-actions">
          <button class="ios-btn ios-btn-secondary" @click="removeItem(editing)">删除</button>
          <button class="ios-btn ios-btn-secondary" @click="toggleArchive(editing)">{{ editing.active ? '归档' : '恢复' }}</button>
          <button class="ios-btn ci-save-btn" :disabled="!editName.trim()" @click="saveEdit">保存</button>
        </div>
      </div>
    </div>
  </div>
</template>
