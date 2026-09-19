<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useDiaryStore } from '@/stores/diary'
import { calendarOpen } from '@/shell/bus'
import { todayStr, makeDateKey } from '@/utils/date'

/**
 * 日历浮层：点日记标题升起，选哪天就渲染哪天。
 * 青点 = 有记录（有流水或有感悟都算）；未来日期禁选；选中圆从中心弹出。
 */
const store = useDiaryStore()
const today = todayStr()

const calTitle = ref('')
interface Cell {
  key: string
  d: number
  has: boolean
  isToday: boolean
  sel: boolean
  off: boolean
  blank?: boolean
}
const lead = ref(0)
const cells = ref<Cell[]>([])
const gridEl = ref<HTMLElement | null>(null)
const slideX = ref('0px')

let viewY = 0
let viewM = 0
const gridKey = ref('')

async function init() {
  const { y, m } = parseYMD(store.currentDate)
  viewY = y
  viewM = m
  slideX.value = '0px'
  await render()
}

function parseYMD(key: string) {
  const [y, m] = key.split('-').map(Number)
  return { y, m: m - 1 }
}

function render() {
  calTitle.value = `${viewY}年${viewM + 1}月`

  const first = new Date(viewY, viewM, 1)
  lead.value = first.getDay()
  const days = new Date(viewY, viewM + 1, 0).getDate()

  return store.getDateList().then(list => {
    const hasSet = new Set(list)
    const rows: Cell[] = []
    for (let i = 0; i < lead.value; i++) rows.push({ key: `b${i}`, d: 0, has: false, isToday: false, sel: false, off: true, blank: true })
    for (let d = 1; d <= days; d++) {
      const key = makeDateKey(viewY, viewM + 1, d)
      rows.push({
        key,
        d,
        has: hasSet.has(key),
        isToday: key === today,
        sel: key === store.currentDate,
        off: key > today,
      })
    }
    cells.value = rows

    // 右箭头的最远边界是「今天」所在的月 —— 不能翻到未来
    const t = parseYMD(today)
    nextDisabled.value = viewY > t.y || (viewY === t.y && viewM >= t.m)
    gridKey.value = `${viewY}-${viewM}`
  })
}

const nextDisabled = ref(false)

function shiftMonth(step: number) {
  viewM += step
  if (viewM < 0) {
    viewM = 11
    viewY--
  } else if (viewM > 11) {
    viewM = 0
    viewY++
  }
  slideX.value = step > 0 ? '24px' : '-24px'
  void render()
}

function pick(cell: Cell) {
  if (cell.blank || cell.off) return
  store.loadEntry(cell.key)
  close()
}

function close() {
  calendarOpen.value = false
}

watch(calendarOpen, open => {
  if (open) void init()
})

// 首次打开（dir=0）--sx 为 0，只做淡入；换月才从侧面滑入
const monthLabel = computed(() => calTitle.value)
</script>

<template>
  <div class="backdrop cal-backdrop" :class="{ show: calendarOpen }" @click="close"></div>

  <div id="calSheet" class="sheet glass" :class="{ show: calendarOpen }" role="dialog" aria-label="选择日期">
    <div class="sheet-grip"></div>
    <div class="sheet-head cal-head">
      <button class="cal-nav" id="calPrev" aria-label="上个月" @click="shiftMonth(-1)">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6" /></svg>
      </button>
      <span class="title">{{ monthLabel }}</span>
      <button class="cal-nav" id="calNext" aria-label="下个月" :disabled="nextDisabled" @click="shiftMonth(1)">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6" /></svg>
      </button>
    </div>
    <div class="cal-week">
      <span>日</span><span>一</span><span>二</span><span>三</span><span>四</span><span>五</span><span>六</span>
    </div>
    <div class="cal-wrap">
      <Transition name="calslide">
        <div
          v-if="calendarOpen"
          :key="gridKey"
          ref="gridEl"
          class="cal-grid"
          :style="{ '--sx': slideX }"
        >
          <template v-for="c in cells" :key="c.key">
            <span v-if="c.blank" class="cal-blank"></span>
            <button v-else class="cal-d" :class="{ has: c.has, today: c.isToday, sel: c.sel, off: c.off }" :disabled="c.off" @click="pick(c)">
              <span class="n">{{ c.d }}</span><i class="dot"></i>
            </button>
          </template>
        </div>
      </Transition>
    </div>
  </div>
</template>

<style>
/* 换月滑入：方向由 --sx 决定；离开即刻消失，只有新网格滑进来 */
.calslide-enter-active {
  transition: transform 0.28s cubic-bezier(0.32, 0.72, 0, 1), opacity 0.22s ease;
}
.calslide-enter-from {
  opacity: 0;
  transform: translateX(var(--sx, 24px));
}
.calslide-leave-active {
  display: none;
}
</style>
