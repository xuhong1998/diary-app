<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { usePomodoroStore } from '@/stores/pomodoro'
import { powerSyncDb } from '@/db/powersync'
import { registerFab, unregisterFab } from '@/shell/bus'
import {
  parsePomodoroData,
  aggregateByTag,
  periodStart,
  formatDur,
  TAG_EMOJIS,
  TAG_COLORS,
  TAG_MINS,
  LEGACY_MODES,
  type PomodoroDay,
  type StatsPeriod,
  type PomodoroTag,
} from '@/utils/pomodoro'

/**
 * 番茄钟页 —— 不是计时器，是「重要的事我投入了多少」的记录器。
 * 圆环倒计时 + 标签 chips（idle）/ 操作键（计时中）/ 三选一（到点）；
 * 统计不摊在页面上，点「查看统计」从底部升起。
 */
const pom = usePomodoroStore()

// ---------- 圆环 ----------
const C = 2 * Math.PI * 105.5

const ringOffset = computed(() => {
  if (pom.stage === 'done') return 0 // 到点后弧留成满圈（CSS 配 opacity 变淡）
  return C * (1 - pom.progressFrac)
})

const ringColor = computed(() => (pom.stage === 'break' ? '#32ade6' : pom.curTag.color))

const labelHtml = computed(() => {
  if (pom.stage === 'idle') return '' // 中央是 ▶
  if (pom.stage === 'done') return `✓ ${pom.curTag.emoji} ${pom.curTag.name} 完成`
  if (pom.stage === 'break') return '☕️ 休息一下'
  return `${pom.curTag.emoji} ${pom.curTag.name}`
})

function onTimerClick() {
  if (pom.stage !== 'idle' || pom.mirrored) return
  pom.start()
}

// ---------- slot：chips / 操作键 / 三选一 ----------
function pickTag(id: string) {
  pom.selectTag(id)
}

// ---------- 统计弹层 ----------
const statOpen = ref(false)
const statScrimEl = ref<HTMLElement | null>(null)
const period = ref<StatsPeriod>('today')
const statRows = ref<{ emoji: string; name: string; sec: number; pom: number }[]>([])
const statEmptyText = ref('')

async function loadAllDays(): Promise<PomodoroDay[]> {
  const rows = await powerSyncDb.getAll<{ date: string; data: string }>(
    "SELECT date, data FROM modules WHERE module_id = 'pomodoro' AND deleted_at IS NULL ORDER BY date DESC"
  )
  return rows.map(r => ({ date: r.date, sessions: parsePomodoroData(r.data) }))
}

async function renderList() {
  try {
    const days = await loadAllDays()
    const aggs = aggregateByTag(days, periodStart(period.value), pom.tags)
    statRows.value = aggs.map(a => ({
      emoji: a.tag?.emoji ?? LEGACY_MODES[a.id]?.emoji ?? '•',
      name: a.tag?.name ?? LEGACY_MODES[a.id]?.name ?? a.id,
      sec: a.sec,
      pom: a.pom,
    }))
    statEmptyText.value = period.value === 'today' ? '今天还没有专注记录' : '这段时间还没有记录'
  } catch (e) {
    console.error('[pomodoro] stats load failed:', e)
  }
}

function openStat() {
  void renderList() // 打开这一刻再算一次，免得看到旧账
  statOpen.value = true
}

function closeStat() {
  statOpen.value = false
}

function pickPeriod(p: StatsPeriod) {
  period.value = p
  void renderList()
}

// 到点是要用户拿主意的时刻，界面得让给三选一 —— 统计正开着先收掉
watch(
  () => pom.stage,
  s => {
    if (s === 'done') closeStat()
  }
)

// ---------- 新建标签弹层 ----------
const tagSheetOpen = ref(false)
const tagName = ref('')
const pick = ref<{ emoji: string; color: string; min: number }>({ emoji: '🎯', color: TAG_COLORS[0], min: 25 })

function openTagSheet() {
  tagName.value = ''
  pick.value = { emoji: '🎯', color: TAG_COLORS[0], min: 25 }
  tagSheetOpen.value = true
  nextTick(() => setTimeout(() => nameEl.value?.focus(), 380))
}

function closeTagSheet() {
  tagSheetOpen.value = false
}

function submitTag() {
  const name = tagName.value.trim()
  if (!name) {
    nameEl.value?.focus()
    return
  }
  const tag: PomodoroTag = {
    id: 'u' + Date.now().toString(36),
    emoji: pick.value.emoji,
    name,
    color: pick.value.color,
    min: pick.value.min,
  }
  pom.addTag(tag)
  tagSheetOpen.value = false
}

const nameEl = ref<HTMLInputElement | null>(null)

// ---------- FAB：本页的 ＋ = 新建标签 ----------
onMounted(() => {
  registerFab('pomodoro', openTagSheet)
})
onUnmounted(() => {
  unregisterFab('pomodoro')
})
</script>

<template>
  <section class="page active" data-page="pomodoro" :style="{ '--tc': ringColor }">
    <header class="head">
      <div class="eyebrow">Pomodoro</div>
      <h1>番茄钟</h1>
    </header>

    <!-- 圆环倒计时。未开始时中央是 ▶，点一下就跑（用上次的标签） -->
    <div class="pm-timer" :data-mode="pom.stage" @click="onTimerClick">
      <svg class="pm-ring" viewBox="0 0 220 220">
        <circle class="track" cx="110" cy="110" r="105.5" />
        <circle
          class="arc"
          cx="110"
          cy="110"
          r="105.5"
          :style="{ strokeDasharray: C + ' ' + C, strokeDashoffset: ringOffset }"
        />
      </svg>
      <div class="pm-face">
        <div class="pm-time">{{ pom.clock }}</div>
        <div class="pm-label">
          <span
            v-if="pom.stage === 'idle'"
            class="pm-play"
          ><svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5.2v13.6a1 1 0 0 0 1.53.85l10.6-6.8a1 1 0 0 0 0-1.7L9.53 4.35A1 1 0 0 0 8 5.2Z" /></svg></span>
          <template v-else>{{ labelHtml }}</template>
        </div>
      </div>
    </div>

    <!-- 槽位：idle → 标签 chips；计时中 → 暂停/结束；到点 → 三选一 -->
    <div class="pm-slot">
      <div v-if="pom.stage === 'idle'" class="pm-chips">
        <button
          v-for="t in pom.tags"
          :key="t.id"
          class="pm-chip"
          :class="{ on: t.id === pom.tagId }"
          :style="{ '--c': t.color }"
          @click="pickTag(t.id)"
        >
          <span>{{ t.emoji }}</span>{{ t.name }}<span class="t">{{ t.min }}′</span>
        </button>
      </div>

      <div v-else-if="pom.stage === 'done'" class="pm-actions">
        <button class="pm-btn primary" @click="pom.startRest()">开始休息</button>
        <button class="pm-btn ghost" @click="pom.addTime()">+5 分钟</button>
        <button class="pm-btn ghost full" @click="pom.stop()">结束</button>
      </div>

      <div v-else class="pm-actions">
        <button class="pm-btn ghost" @click="pom.paused ? pom.resume() : pom.pause()">
          {{ pom.paused ? '继续' : '暂停' }}
        </button>
        <button class="pm-btn ghost" @click="pom.stop()">
          {{ pom.stage === 'break' ? '结束休息' : '结束' }}
        </button>
      </div>
    </div>

    <!-- 统计入口：站原统计区的位置，拇指够得着 -->
    <button class="pm-stats-btn" @click="openStat">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M4 20V10M10 20V4M16 20v-7M2 20h20" />
      </svg>
      查看统计
      <svg class="chev" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6" /></svg>
    </button>

    <div v-if="pom.mirrored" class="pm-mirror-hint">计时已在其他窗口运行，此处仅供查看</div>
  </section>

  <!-- 浮层：屏幕层（盖住 tabbar） -->
  <Teleport to="#app-main">
    <!-- 新建标签 -->
    <div class="pm-scrim" :class="{ show: tagSheetOpen }" @click="closeTagSheet"></div>
    <div class="pm-sheet glass" :class="{ show: tagSheetOpen }">
      <div class="pm-grip"></div>
      <h3>新建标签</h3>

      <div class="pm-field">
        <span>名称</span>
        <input ref="nameEl" v-model="tagName" class="pm-input" placeholder="比如：背八股" maxlength="8" @keydown.enter="submitTag" />
      </div>
      <div class="pm-field">
        <span>图标</span>
        <div class="pm-opts">
          <button
            v-for="e in TAG_EMOJIS"
            :key="e"
            class="pm-opt"
            :class="{ on: pick.emoji === e }"
            @click="pick.emoji = e"
          >{{ e }}</button>
        </div>
      </div>
      <div class="pm-field">
        <span>颜色</span>
        <div class="pm-opts">
          <button
            v-for="c in TAG_COLORS"
            :key="c"
            class="pm-color"
            :class="{ on: pick.color === c }"
            :style="{ background: c, color: c }"
            @click="pick.color = c"
          ></button>
        </div>
      </div>
      <div class="pm-field">
        <span>单轮时长</span>
        <div class="pm-opts">
          <button
            v-for="m in TAG_MINS"
            :key="m"
            class="pm-min"
            :class="{ on: pick.min === m }"
            @click="pick.min = m"
          >{{ m }}′</button>
        </div>
      </div>

      <div class="pm-sheet-f">
        <button class="pm-btn ghost" @click="closeTagSheet">取消</button>
        <button class="pm-btn primary" @click="submitTag">添加</button>
      </div>
    </div>

    <!-- 统计：今天 / 本周 / 累计，按标签聚合 -->
    <div ref="statScrimEl" class="pm-scrim" :class="{ show: statOpen }" @click="closeStat"></div>
    <div class="pm-sheet glass stat" :class="{ show: statOpen }">
      <div class="pm-grip"></div>
      <h3>专注统计</h3>

      <div class="pm-seg">
        <button :class="{ on: period === 'today' }" @click="pickPeriod('today')">今天</button>
        <button :class="{ on: period === 'week' }" @click="pickPeriod('week')">本周</button>
        <button :class="{ on: period === 'all' }" @click="pickPeriod('all')">累计</button>
      </div>
      <div class="pm-list">
        <div v-if="!statRows.length" class="pm-empty">{{ statEmptyText }}</div>
        <div v-for="r in statRows" :key="r.name + r.emoji" class="pm-row">
          <span class="em">{{ r.emoji }}</span>
          <span class="nm">{{ r.name }}</span>
          <span class="vl">{{ formatDur(r.sec) }}</span>
          <span class="pc">
            <template v-if="r.pom"><span>{{ r.pom }}</span><span>🍅</span></template>
            <template v-else>—</template>
          </span>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style>
.pm-mirror-hint {
  text-align: center;
  font-size: 13px;
  font-weight: 500;
  color: var(--text-3);
  margin-top: 14px;
}
</style>
