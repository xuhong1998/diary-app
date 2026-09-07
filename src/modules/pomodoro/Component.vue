<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useDiaryStore } from '@/stores/diary'
import { usePomodoroStore } from '@/stores/pomodoro'
import { powerSyncDb } from '@/db/powersync'
import { todayStr } from '@/utils/date'
import {
  POMODORO_MODES,
  modeById,
  phaseMinutes,
  parsePomodoroData,
  pomodoroStats,
  formatClock,
  formatMinutes,
  type PomodoroDay,
} from '@/utils/pomodoro'
import type { PomodoroSession, TodoItem } from '@/types'

const store = useDiaryStore()
const pom = usePomodoroStore()

const today = ref(todayStr())
const tab = ref<'timer' | 'stats'>('timer')
const allDays = ref<PomodoroDay[]>([])

/** 页面跨零点后回到前台：刷新 today 并重新加载当日数据 */
function onVisible() {
  if (document.visibilityState !== 'visible') return
  const t = todayStr()
  if (t === today.value) return
  today.value = t
  void store.loadEntry(t)
  void loadAll()
}

onMounted(async () => {
  await store.loadEntry(today.value)
  await loadAll()
  document.addEventListener('visibilitychange', onVisible)
})

onUnmounted(() => {
  document.removeEventListener('visibilitychange', onVisible)
})

async function loadAll() {
  try {
    const rows = await powerSyncDb.getAll<{ date: string; data: string }>(
      'SELECT date, data FROM modules WHERE module_id = ? AND deleted_at IS NULL ORDER BY date DESC',
      ['pomodoro']
    )
    allDays.value = rows.map(r => ({ date: r.date, sessions: parsePomodoroData(r.data) }))
  } catch (e) {
    console.error('[pomodoro] loadAll failed:', e)
  }
}

const sessions = computed<PomodoroSession[]>(() => {
  if (store.entry && store.entry.date === today.value) {
    return parsePomodoroData(store.entry.moduleData.pomodoro)
  }
  return allDays.value.find(d => d.date === today.value)?.sessions ?? []
})

const stats = computed(() => {
  const merged = allDays.value.filter(d => d.date !== today.value)
  merged.push({ date: today.value, sessions: sessions.value })
  return pomodoroStats(merged, today.value)
})

const todosToday = computed<TodoItem[]>(() => {
  if (store.entry?.date !== today.value) return []
  const data = store.entry.moduleData.todo as { items?: TodoItem[] } | undefined
  return (data?.items ?? []).filter(t => t && !t.done && t.text)
})

const weekdays = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六']

const dateDisplay = computed(() => {
  const [y, m, d] = today.value.split('-').map(Number)
  const wd = weekdays[new Date(y, m - 1, d).getDay()]
  return `${today.value.replace(/-/g, '/')} · ${wd}`
})

const RING_R = 88
const RING_C = 2 * Math.PI * RING_R

const ringStyle = computed(() => ({
  strokeDasharray: `${RING_C}`,
  strokeDashoffset: `${RING_C * (1 - pom.progress)}`,
}))

const totalClock = computed(() => formatClock(phaseMinutes(pom.mode, pom.phase) * 60))

const phaseText = computed(() => {
  if (pom.timerState === 'idle') return '准备专注'
  if (pom.phase === 'focus') return '专注中'
  return pom.phase === 'longBreak' ? '长休息' : '短休息'
})

const todayRecords = computed(() => [...sessions.value].reverse())

function minutesOf(s: PomodoroSession): number {
  return Math.max(1, Math.round(s.seconds / 60))
}

function modeName(id: string): string {
  return modeById(id).name
}

function plannedMinutes(s: PomodoroSession): number {
  return Math.round(s.plannedSec / 60)
}
</script>

<template>
  <div class="page-pad">
    <!-- Hero Header -->
    <div class="algo-hero pomodoro-hero">
      <div class="algo-hero-title">番茄钟</div>
      <div class="algo-hero-sub">{{ dateDisplay }}</div>
      <div class="algo-hero-stats">
        <div class="algo-stat">
          <div class="algo-stat-num">{{ stats.todayCount }}</div>
          <div class="algo-stat-label">今日番茄</div>
        </div>
        <div class="algo-stat-divider"></div>
        <div class="algo-stat">
          <div class="algo-stat-num">{{ stats.todayMinutes }}</div>
          <div class="algo-stat-label">今日分钟</div>
        </div>
        <div class="algo-stat-divider"></div>
        <div class="algo-stat">
          <div class="algo-stat-num">{{ stats.streak }}</div>
          <div class="algo-stat-label">连续天数</div>
        </div>
      </div>
    </div>

    <div class="segmented">
      <div class="segmented-item" :class="{ active: tab === 'timer' }" @click="tab = 'timer'">计时</div>
      <div class="segmented-item" :class="{ active: tab === 'stats' }" @click="tab = 'stats'">统计</div>
    </div>

    <template v-if="tab === 'timer'">
      <!-- Mode presets -->
      <div class="pom-modes" :class="{ disabled: pom.timerState !== 'idle' }">
        <button
          v-for="m in POMODORO_MODES"
          :key="m.id"
          class="pom-mode"
          :class="{ active: pom.modeId === m.id }"
          @click="pom.selectMode(m.id)"
        >
          <span class="pom-mode-name">{{ m.name }}</span>
          <span class="pom-mode-sub">{{ m.focusMin }}′ + {{ m.breakMin }}′</span>
        </button>
      </div>

      <!-- Timer ring -->
      <div class="pom-timer-card">
        <div class="pom-ring" :class="{ 'break-phase': !pom.isFocus }">
          <svg viewBox="0 0 200 200">
            <circle class="pom-ring-track" cx="100" cy="100" :r="RING_R"></circle>
            <circle class="pom-ring-bar" cx="100" cy="100" :r="RING_R" :style="ringStyle"></circle>
          </svg>
          <div class="pom-ring-center">
            <div class="pom-phase">
              {{ phaseText }}
              <span v-if="pom.isFocus && pom.timerState !== 'idle'" class="pom-round">{{ pom.roundLabel }}</span>
            </div>
            <div class="pom-clock">{{ pom.clock }}</div>
            <div v-if="pom.timerState !== 'idle'" class="pom-clock-sub">{{ totalClock }}</div>
            <div v-if="pom.todoText && pom.timerState !== 'idle'" class="pom-focus-task">{{ pom.todoText }}</div>
          </div>
        </div>

        <div class="pom-controls">
          <button
            v-if="pom.timerState === 'idle'"
            class="ios-btn pom-main-btn"
            :disabled="pom.mirrored"
            @click="pom.start()"
          >开始专注</button>
          <template v-else>
            <button
              class="ios-btn pom-main-btn"
              :disabled="pom.mirrored"
              @click="pom.timerState === 'running' ? pom.pause() : pom.resume()"
            >{{ pom.timerState === 'running' ? '暂停' : '继续' }}</button>
            <button
              class="ios-btn ios-btn-secondary pom-main-btn"
              :disabled="pom.mirrored"
              @click="pom.skip()"
            >
              {{ pom.isFocus ? '结束并休息' : '跳过休息' }}
            </button>
          </template>
        </div>
        <div v-if="pom.timerState !== 'idle'" class="pom-reset-row">
          <button class="pom-reset" :disabled="pom.mirrored" @click="pom.reset()">重置（不记录本轮）</button>
        </div>
        <div v-if="pom.mirrored" class="pom-tasks-empty">计时已在其他窗口运行，此处仅供查看</div>
      </div>

      <!-- Task association -->
      <div class="pom-tasks">
        <div class="pom-tasks-label">关联待办（专注什么？）</div>
        <div class="pom-task-list">
          <button
            class="pom-task-chip"
            :class="{ active: !pom.todoId }"
            @click="pom.setTodo(undefined)"
          >不关联</button>
          <button
            v-for="t in todosToday"
            :key="t.id ?? t.text"
            class="pom-task-chip"
            :class="{ active: !!t.id && pom.todoId === t.id }"
            @click="pom.setTodo(t.id, t.text)"
          >{{ t.text }}</button>
        </div>
        <div v-if="!todosToday.length" class="pom-tasks-empty">今天还没有待完成的待办，可先去「待办」添加</div>
      </div>

      <!-- Today records -->
      <div v-if="todayRecords.length" class="list-section">
        <div class="list-header">今日记录 · {{ sessions.length }} 次</div>
        <div class="list-group">
          <div v-for="s in todayRecords" :key="s.id" class="pom-record">
            <div class="pom-record-time">{{ s.startedAt }}–{{ s.endedAt }}</div>
            <div class="pom-record-main">
              <div class="pom-record-task">{{ s.todoText || '未关联任务' }}</div>
              <div class="pom-record-meta">{{ modeName(s.modeId) }} · 计划 {{ plannedMinutes(s) }} 分钟</div>
            </div>
            <div class="pom-record-right">
              <div class="pom-record-min">{{ minutesOf(s) }}′</div>
              <span v-if="!s.completed" class="badge pom-badge-incomplete">提前结束</span>
            </div>
          </div>
        </div>
      </div>
    </template>

    <template v-else>
      <div class="list-section">
        <div class="list-header">专注统计</div>
        <div class="list-group">
          <div class="list-row">
            <div class="row-icon" style="background: var(--ios-red);"><span>🍅</span></div>
            <div class="row-content">
              <div class="row-title">今日专注</div>
              <div class="row-subtitle">{{ stats.todayCount }} 个番茄</div>
            </div>
            <div class="row-accessory"><span class="row-subtitle">{{ formatMinutes(stats.todayMinutes) }}</span></div>
          </div>
          <div class="list-row">
            <div class="row-icon" style="background: var(--ios-orange);"><span>📅</span></div>
            <div class="row-content">
              <div class="row-title">本周专注</div>
              <div class="row-subtitle">最近 7 天</div>
            </div>
            <div class="row-accessory"><span class="row-subtitle">{{ formatMinutes(stats.weekMinutes) }}</span></div>
          </div>
          <div class="list-row">
            <div class="row-icon" style="background: var(--ios-purple);"><span>∑</span></div>
            <div class="row-content">
              <div class="row-title">累计专注</div>
              <div class="row-subtitle">{{ stats.totalCount }} 次记录</div>
            </div>
            <div class="row-accessory"><span class="row-subtitle">{{ formatMinutes(stats.totalMinutes) }}</span></div>
          </div>
          <div class="list-row">
            <div class="row-icon" style="background: var(--ios-green);"><span>🔥</span></div>
            <div class="row-content">
              <div class="row-title">连续天数</div>
              <div class="row-subtitle">每天至少 1 次专注</div>
            </div>
            <div class="row-accessory"><span class="row-subtitle">{{ stats.streak }} 天</span></div>
          </div>
        </div>
      </div>
      <div class="tip-box">专注满 1 分钟的提前结束也会计入记录</div>
    </template>
  </div>
</template>
