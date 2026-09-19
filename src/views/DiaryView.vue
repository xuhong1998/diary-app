<script setup lang="ts">
import { ref, computed, watch, onMounted, nextTick } from 'vue'
import { useDiaryStore } from '@/stores/diary'
import { openCalendar, openReflectEditor } from '@/shell/bus'
import { labelOfDate, subOfDate, todayStr, normalizeTime, nowTime } from '@/utils/date'
import { ensureRichText, previewOf } from '@/utils/richText'
import { fetchWeatherData, getCachedWeather, type WeatherData } from '@/utils/weather'
import { toast } from '@/utils/toast'
import { useLongPressBag, type LongPressGesture } from '@/shell/useLongPress'
import LongMenu from '@/components/LongMenu.vue'
import type { Period } from '@/types'

const store = useDiaryStore()
const todayKey = todayStr()

// ---------- 头部：大标题即日历入口 ----------
const dateText = computed(() => labelOfDate(store.currentDate))
const subText = computed(() => subOfDate(store.currentDate))

// ---------- 天气胶囊（自动记录，空日期也照常） ----------
const weatherData = ref<WeatherData | null>(null)

const WEATHER_EMOJI: Record<string, string> = {
  sun: '☀️',
  'cloud-sun': '🌤️',
  cloud: '☁️',
  fog: '🌫️',
  rain: '🌧️',
  snow: '❄️',
  thunder: '⛈️',
}

const weatherEm = computed(() =>
  weatherData.value ? (WEATHER_EMOJI[weatherData.value.icon] ?? '☁️') : '☁️'
)

async function loadWeather(date: string) {
  weatherData.value = getCachedWeather(date)
  if (date !== todayKey) return
  try {
    weatherData.value = await fetchWeatherData(date)
  } catch {
    /* 保留缓存值；取不到就不摆数字 */
  }
}

// ---------- 时间线：上午 / 下午 / 晚上 ----------
const PERIODS: { key: Period; label: string; cls: string }[] = [
  { key: 'morning', label: '上午', cls: '' },
  { key: 'afternoon', label: '下午', cls: 'p2' },
  { key: 'evening', label: '晚上', cls: 'p3' },
]

const groups = computed(() =>
  PERIODS.map(p => ({ ...p, records: store.groupedRecords[p.key] })).filter(g => g.records.length)
)

const hasRecords = computed(() => (store.entry?.records.length ?? 0) > 0)

// ---------- 条目：长按菜单（编辑 / 删除）+ 撤销 ----------
const entryMenu = ref<InstanceType<typeof LongMenu> | null>(null)
let menuTargetId: string | null = null

const { make: makeGesture } = useLongPressBag()
const gestures = new Map<string, LongPressGesture>()

function gestureFor(id: string) {
  let g = gestures.get(id)
  if (!g) {
    g = makeGesture(el => {
      menuTargetId = id
      entryMenu.value?.openFor(el)
    })
    gestures.set(id, g)
  }
  return g
}

const onEntryDown = (e: PointerEvent, id: string) => gestureFor(id).down(e)
const onEntryMove = (e: PointerEvent, id: string) => gestureFor(id).move(e)
const onEntryCancel = (id: string) => gestureFor(id).cancel()
const onEntryUp = (id: string) => gestureFor(id).up()

function onMenuEdit() {
  const r = store.entry?.records.find(x => x.id === menuTargetId)
  if (!r) return
  editTime.value = r.time
  editText.value = r.text
  entrySheetOpen.value = true
}

async function onMenuDel() {
  if (!menuTargetId) return
  const r = store.entry?.records.find(x => x.id === menuTargetId)
  if (!r) return
  gestures.get(menuTargetId)?.dispose()
  gestures.delete(menuTargetId)
  await store.deleteRecord(menuTargetId)
  pendingDelete.value = { time: r.time, text: r.text }
  if (undoTimer) clearTimeout(undoTimer)
  undoTimer = setTimeout(() => {
    pendingDelete.value = null
  }, 3000)
}

const pendingDelete = ref<{ time: string; text: string } | null>(null)
let undoTimer: ReturnType<typeof setTimeout> | undefined

async function undoDelete() {
  if (!pendingDelete.value) return
  if (undoTimer) clearTimeout(undoTimer)
  await store.addRecord(pendingDelete.value.text, pendingDelete.value.time)
  pendingDelete.value = null
}

// ---------- 条目编辑弹层 ----------
const entrySheetOpen = ref(false)
const editTime = ref('')
const editText = ref('')

async function saveEntry() {
  if (!menuTargetId || !editText.value.trim()) return
  await store.updateRecord(menuTargetId, {
    time: normalizeTime(editTime.value || nowTime()),
    text: editText.value,
  })
  entrySheetOpen.value = false
  toast('已保存')
}

async function deleteEntry() {
  entrySheetOpen.value = false
  await onMenuDel()
}

// ---------- 感悟卡片：空白 / 截断 / 展开 三态 ----------
const reflection = computed(() => store.entry?.reflection ?? '')
const reflectOpen = ref(false)
const truncated = ref(false)
const bodyEl = ref<HTMLElement | null>(null)

const reflectBlank = computed(() => !reflection.value.trim())
const previewHtml = computed(() => previewOf(reflection.value))

function measureTruncated() {
  nextTick(() => {
    const el = bodyEl.value
    truncated.value = !!el && el.scrollHeight - el.clientHeight > 1
  })
}

watch([reflection, reflectOpen], () => {
  if (!reflectOpen.value) measureTruncated()
})

const moreLabel = computed(() => (reflectOpen.value ? '收起' : '展开全文 ›'))
const showMore = computed(() => !reflectBlank.value && (reflectOpen.value || truncated.value))

function toggleMore() {
  reflectOpen.value = !reflectOpen.value
}

onMounted(() => {
  void store.loadEntry(store.currentDate)
  void loadWeather(store.currentDate)
  measureTruncated()
})
</script>

<template>
  <section class="page active" data-page="diary">
    <header class="head">
      <div class="eyebrow">Diary</div>
      <!-- 标题即入口：点开日历选日期。chevron 是唯一的「这儿能点」提示 -->
      <h1 class="date-btn" role="button" tabindex="0" aria-label="选择日期" @click="openCalendar" @keydown.enter.prevent="openCalendar">
        <span>{{ dateText }}</span>
        <svg class="chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6" /></svg>
      </h1>
      <div class="sub">{{ subText }}</div>
    </header>

    <div class="weather glass">
      <span class="em">{{ weatherEm }}</span>
      <div>
        <div class="val">{{ weatherData ? weatherData.temp + '°' : '' }}</div>
      </div>
      <div class="loc">{{ weatherData?.city ?? '' }}</div>
      <div class="spacer"></div>
      <div class="hum">{{ weatherData?.humidity ? '湿度 ' + weatherData.humidity + '%' : '' }}</div>
    </div>

    <!-- 时间线 -->
    <template v-if="hasRecords">
      <template v-for="g in groups" :key="g.key">
        <div class="section-label" :class="g.cls">
          <span class="dot"></span>{{ g.label }}
          <span class="count">{{ g.records.length }} 条</span>
        </div>
        <div
          v-for="r in g.records"
          :key="r.id"
          class="entry"
          @pointerdown="onEntryDown($event, r.id)"
          @pointermove="onEntryMove($event, r.id)"
          @pointerup="onEntryUp(r.id)"
          @pointercancel="onEntryCancel(r.id)"
          @contextmenu.prevent
        >
          <div class="time">{{ r.time }}</div>
          <div class="txt">{{ r.text }}</div>
        </div>
      </template>
    </template>
    <div v-else class="tl-void">
      <div class="t">这天没写什么</div>
      <div class="d">想起来的时候，记一笔就好。</div>
    </div>

    <!-- 感悟卡片 -->
    <div
      class="reflect glass"
      :class="{ blank: reflectBlank, open: reflectOpen }"
      @click="reflectBlank && openReflectEditor()"
    >
      <div class="h">
        <span>{{ store.currentDate === todayKey ? '今日感悟' : '感悟' }}</span>
        <span v-if="!reflectBlank" class="edit" @click.stop="openReflectEditor">编辑 ›</span>
      </div>
      <div v-if="reflectOpen" ref="bodyEl" class="b" v-html="ensureRichText(reflection)"></div>
      <div v-else ref="bodyEl" class="b clamp" v-html="previewHtml"></div>
      <span v-if="showMore" class="more" @click.stop="toggleMore">{{ moreLabel }}</span>
    </div>
  </section>

  <!-- 长按菜单 / 条目编辑 / 撤销条：屏幕层 -->
  <Teleport to="#app-main">
    <LongMenu ref="entryMenu" @edit="onMenuEdit" @del="onMenuDel" />

    <div class="backdrop" :class="{ show: entrySheetOpen }" @click="entrySheetOpen = false"></div>
    <div class="sheet glass sheet-narrow entry-sheet" :class="{ show: entrySheetOpen }">
      <div class="sheet-grip"></div>
      <div class="sheet-head">
        <button class="cancel" @click="entrySheetOpen = false">取消</button>
        <span class="title">编辑记录</span>
        <span></span>
      </div>
      <div class="entry-input time field-input">
        <input v-model="editTime" placeholder="HH:MM" @blur="editTime = normalizeTime(editTime)" />
      </div>
      <div class="entry-input" style="margin-top: 10px">
        <input v-model="editText" placeholder="内容" @keydown.enter="saveEntry" />
      </div>
      <button class="save" style="margin-top: 18px" @click="saveEntry">保存</button>
      <button class="entry-del" @click="deleteEntry">删除这条记录</button>
    </div>

    <div v-if="pendingDelete" class="undo-bar show" @click="undoDelete">
      <span class="ut">已删除一条记录</span>
      <button>撤销</button>
    </div>
  </Teleport>
</template>
