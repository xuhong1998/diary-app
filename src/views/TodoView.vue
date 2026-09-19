<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { useDiaryStore } from '@/stores/diary'
import { powerSyncDb } from '@/db/powersync'
import { registerFab, unregisterFab } from '@/shell/bus'
import { todayStr, parseDate, addDays } from '@/utils/date'
import { useLongPressBag, type LongPressGesture } from '@/shell/useLongPress'
import LongMenu from '@/components/LongMenu.vue'
import type { TodoItem } from '@/types'

/**
 * 待办页 —— 规则：只有一种待办。没有日期、没有截止、没有自动重复。
 * 完成 = 封存（勾→划→褪→消，封存期间再点撤回）；删除 = 长按菜单 + 3s 撤销。
 * 数据走 todo blob（modules 表），整对象写回。
 */
const store = useDiaryStore()
const today = todayStr()

// ---------- 数据 ----------
const items = ref<TodoItem[]>([])

function syncFromStore() {
  const data = store.entry?.moduleData?.todo as { items?: TodoItem[] } | undefined
  const list = (data?.items ?? []).filter(t => t && t.text)
  // 旧数据可能缺 id：补上并写回一次
  if (list.some(t => !t.id)) {
    for (const t of list) if (!t.id) t.id = crypto.randomUUID()
    items.value = list
    void persist()
  } else {
    items.value = list
  }
}

watch(() => store.entry, syncFromStore, { immediate: false })

async function persist() {
  await store.updateModuleData('todo', { items: items.value })
}

const activeItems = computed(() => items.value.filter(t => !t.done))
const doneItems = computed(() =>
  items.value
    .filter(t => t.done)
    .slice()
    .sort((a, b) => (b.doneAt ?? '').localeCompare(a.doneAt ?? ''))
)

const countText = computed(() => {
  const n = activeItems.value.length
  return n ? `还有 ${n} 件` : doneItems.value.length ? '都做完了' : ''
})

// ---------- 封存四拍：勾 0–250 · 划 120–380 · 褪 300–600 · 封 200–600 ----------
const SEAL_HOLD = 1050
const SEAL_GONE = 400
const GONE_MS = 320
const ROW_GAP = 7
const UNDO_MS = 3000

const sealingId = ref<string | null>(null)
const sealedId = ref<string | null>(null)
let sealTimers: ReturnType<typeof setTimeout>[] = []

function clearSealTimers() {
  sealTimers.forEach(clearTimeout)
  sealTimers = []
}

function seal(item: TodoItem, swiperEl: HTMLElement) {
  if (sealingId.value || sealedId.value) return
  sealingId.value = item.id ?? ''
  sealTimers.push(
    setTimeout(() => {
      sealingId.value = null
      sealedId.value = item.id ?? '' // 终值与动画一致，切换不跳变
      disappear(swiperEl, () => {
        commitDone(item)
      })
    }, SEAL_HOLD)
  )
}

/** 封存期间再点 = 撤回：动画撤掉，transition 接管，平滑退回 */
function undoSeal() {
  clearSealTimers()
  sealingId.value = null
  sealedId.value = null
}

function commitDone(item: TodoItem) {
  const t = items.value.find(x => x.id === item.id)
  if (!t) return
  t.done = true
  t.doneAt = new Date().toISOString()
  void persist()
  // 计数落袋时的一下脉冲
  donebarEl.value?.classList.add('tick')
  setTimeout(() => donebarEl.value?.classList.remove('tick'), 340)
}

/** 淡出 + 收拢（完成封存与删除共用一条动线） */
function collapseEl(el: HTMLElement, durMs: number, onGone: () => void) {
  const h = el.getBoundingClientRect().height
  const ease = 'cubic-bezier(.32,.72,0,1)'
  el.style.transition = `height ${durMs}ms ${ease}, margin-bottom ${durMs}ms ${ease}, opacity ${Math.round(durMs * 0.6)}ms ease-out`
  el.style.height = h + 'px'
  el.style.marginBottom = ROW_GAP + 'px'
  el.style.overflow = 'hidden'
  void el.offsetHeight // 逼一次回流，否则这一帧会被合并掉
  el.style.opacity = '0'
  el.style.height = '0px'
  el.style.marginBottom = '0px'
  setTimeout(onGone, durMs + 40)
}

function disappear(swiperEl: HTMLElement, onGone: () => void) {
  collapseEl(swiperEl, SEAL_GONE, onGone)
}

// ---------- 长按菜单 / 删除撤销 ----------
const menuEl = ref<InstanceType<typeof LongMenu> | null>(null)
let menuTarget: TodoItem | null = null

const { make: makeGesture } = useLongPressBag()
const gestures = new Map<string, LongPressGesture>()

function gestureFor(item: TodoItem) {
  const key = item.id ?? item.text
  let g = gestures.get(key)
  if (!g) {
    g = makeGesture(el => {
      if (sealingId.value || sealedId.value) return
      menuTarget = item
      menuEl.value?.openFor(el)
    })
    gestures.set(key, g)
  }
  return g
}

function onRowDown(e: PointerEvent, item: TodoItem) {
  gestureFor(item).down(e)
}
function onRowMove(e: PointerEvent, item: TodoItem) {
  gestureFor(item).move(e)
}
function onRowCancel(item: TodoItem) {
  gestureFor(item).cancel()
}
function onRowUp(e: PointerEvent, item: TodoItem) {
  if (gestureFor(item).up()) return // 长按已触发，抑制这次点击
  const swiperEl = e.currentTarget as HTMLElement
  if (sealingId.value === item.id) {
    undoSeal()
    return
  }
  if (sealedId.value === item.id) return
  if ((e.target as Element).closest('.box')) seal(item, swiperEl)
}

function onMenuEdit() {
  if (!menuTarget) return
  openSheet(menuTarget)
}

function onMenuDel() {
  if (!menuTarget) return
  const item = menuTarget
  const el = swiperEls.get(item.id ?? item.text)
  const index = items.value.findIndex(x => x.id === item.id)
  if (index < 0) return
  const commit = () => {
    items.value = items.value.filter(x => x.id !== item.id)
    void persist()
  }
  if (el) {
    collapseEl(el, GONE_MS, commit)
  } else {
    commit()
  }
  // 撤销条
  if (undoTimer) clearTimeout(undoTimer)
  lastDeleted = { item: { ...item }, index }
  undoText.value = `已删除「${item.text}」`
  undoShow.value = true
  undoTimer = setTimeout(hideUndo, UNDO_MS)
}

const undoShow = ref(false)
const undoText = ref('')
let undoTimer: ReturnType<typeof setTimeout> | undefined
let lastDeleted: { item: TodoItem; index: number } | null = null

function hideUndo() {
  undoShow.value = false
  lastDeleted = null
}

function undoDelete() {
  if (!lastDeleted) return
  const { item, index } = lastDeleted
  hideUndo()
  items.value.splice(Math.min(index, items.value.length), 0, { ...item })
  void persist()
}

const swiperEls = new Map<string, HTMLElement>()
function setSwiperEl(item: TodoItem, el: unknown) {
  const key = item.id ?? item.text
  if (el) swiperEls.set(key, el as HTMLElement)
  else swiperEls.delete(key)
}

// ---------- 已完成归档 ----------
const donebarEl = ref<HTMLElement | null>(null)
const doneOpen = ref(false)

function toggleDonebar() {
  doneOpen.value = !doneOpen.value
}

function dayLabelOf(iso?: string): string {
  if (!iso) return '更早'
  const d = parseDate(iso.slice(0, 10))
  const diff = Math.round((parseDate(today).getTime() - d.getTime()) / 86400000)
  if (diff <= 0) return '今天'
  if (diff === 1) return '昨天'
  return `${d.getMonth() + 1}月${d.getDate()}日`
}

const archiveGroups = computed(() => {
  const groups: { key: string; items: TodoItem[] }[] = []
  for (const t of doneItems.value) {
    const key = dayLabelOf(t.doneAt)
    let g = groups.find(x => x.key === key)
    if (!g) {
      g = { key, items: [] }
      groups.push(g)
    }
    g.items.push(t)
  }
  return groups
})

/** 「再来一条」：改回未完成，回到清单 */
function again(item: TodoItem) {
  const t = items.value.find(x => x.id === item.id)
  if (!t) return
  t.done = false
  t.doneAt = undefined
  void persist()
}

// ---------- 空态 ----------
const emptyState = computed(() => {
  if (activeItems.value.length) return null
  const hasToday = doneItems.value.some(t => dayLabelOf(t.doneAt) === '今天')
  return hasToday
    ? { cls: 'alldone', icon: 'check', title: '清单空了', desc: '想到什么，再加进来。' }
    : { cls: 'todoempty', icon: 'plus', title: '还没有待办', desc: '想到什么就记一条。做完划掉，没做完就留着。' }
})

// ---------- 新建 / 编辑弹层 ----------
const sheetOpen = ref(false)
const sheetTitle = ref('新建待办')
const inputText = ref('')
const editingId = ref<string | null>(null)
const addBtnEl = ref<HTMLElement | null>(null)

function openSheet(todo?: TodoItem) {
  editingId.value = todo?.id ?? null
  sheetTitle.value = todo ? '编辑待办' : '新建待办'
  inputText.value = todo?.text ?? ''
  sheetOpen.value = true
  nextTick(() => setTimeout(() => inputEl.value?.focus(), 340))
}

function closeSheet() {
  sheetOpen.value = false
  inputEl.value?.blur()
  editingId.value = null
}

async function submit() {
  const v = inputText.value.trim()
  if (!v) return
  if (editingId.value) {
    const t = items.value.find(x => x.id === editingId.value)
    if (t) t.text = v
  } else {
    items.value.push({ id: crypto.randomUUID(), text: v, done: false })
  }
  await persist()
  closeSheet()
}

const inputEl = ref<HTMLInputElement | null>(null)

const addBtnText = computed(() => {
  const v = inputText.value.trim()
  if (editingId.value) return '保 存'
  if (!v) return '添 加'
  return `添 加「${v.length > 10 ? v.slice(0, 10) + '…' : v}」`
})

// ---------- 「再来一次」历史建议（近 30 天 todo blob，只读查询） ----------
interface Suggestion {
  text: string
  when: string
  date: string
}
const suggestions = ref<Suggestion[]>([])

async function loadSuggestions() {
  try {
    const rows = await powerSyncDb.getAll<{ date: string; data: string }>(
      "SELECT date, data FROM modules WHERE module_id = 'todo' AND deleted_at IS NULL AND date >= ? ORDER BY date DESC",
      [addDays(today, -30)]
    )
    const seen = new Set<string>()
    const out: Suggestion[] = []
    for (const r of rows) {
      const data = JSON.parse(r.data || '{}') as { items?: TodoItem[] }
      for (const t of data.items ?? []) {
        if (!t?.text || seen.has(t.text)) continue
        seen.add(t.text)
        out.push({ text: t.text, when: t.done ? dayLabelOf(t.doneAt) : '清单里', date: r.date })
      }
    }
    suggestions.value = out
  } catch {
    suggestions.value = []
  }
}

const filteredSuggestions = computed(() => {
  const kw = inputText.value.trim()
  const list = suggestions.value.filter(s => !kw || s.text.includes(kw))
  return list.slice(0, 6)
})

function pickSuggestion(s: Suggestion) {
  inputText.value = s.text
  inputEl.value?.focus()
}

// ---------- 挂载 ----------
onMounted(async () => {
  await store.loadEntry(today)
  syncFromStore()
  void loadSuggestions()
  registerFab('todo', () => openSheet())
})

onUnmounted(() => {
  unregisterFab('todo')
})
</script>

<template>
  <section class="page active" data-page="todo">
    <header class="head">
      <div class="eyebrow">Todo</div>
      <h1>待办</h1>
      <div class="sub">{{ countText }}</div>
    </header>

    <div class="list">
      <div
        v-for="t in activeItems"
        :key="t.id ?? t.text"
        :ref="el => setSwiperEl(t, el)"
        class="swiper"
        @pointerdown="onRowDown($event, t)"
        @pointermove="onRowMove($event, t)"
        @pointerup="onRowUp($event, t)"
        @pointercancel="onRowCancel(t)"
        @contextmenu.prevent
      >
        <div class="row" :class="{ sealing: sealingId === t.id, sealed: sealedId === t.id }">
          <span class="box">
            <span class="fill"></span>
            <svg class="tick" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
          </span>
          <span class="label"><span class="tx">{{ t.text }}</span></span>
        </div>
      </div>
    </div>

    <div v-if="emptyState" class="void show">
      <div class="mark" :class="emptyState.cls">
        <svg v-if="emptyState.icon === 'check'" width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
        <svg v-else width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M5 12h14" /></svg>
      </div>
      <div class="t">{{ emptyState.title }}</div>
      <div class="d">{{ emptyState.desc }}</div>
    </div>

    <!-- 已完成归档 -->
    <div ref="donebarEl" class="donebar" :class="{ open: doneOpen }">
      <div class="sum" @click="toggleDonebar">
        <span class="ic">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
        </span>
        <span class="t">已完成 {{ doneItems.length }} 件</span>
        <span class="chev">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6" /></svg>
        </span>
      </div>
      <div v-show="doneOpen" class="donebody">
        <div v-for="g in archiveGroups" :key="g.key" class="dgroup">
          <div class="dtitle">{{ g.key }}</div>
          <div v-for="t in g.items" :key="t.id ?? t.text" class="ditem">
            <span class="dtx"><span class="tx">{{ t.text }}</span></span>
            <button class="again" title="再来一条" @click="again(t)">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-2.6-6.4" /><path d="M21 4v5h-5" /></svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  </section>

  <!-- 撤销条 / 长按菜单 / 新建弹层：屏幕层 -->
  <Teleport to="#app-main">
    <div v-show="undoShow" class="undo-bar show" @click="undoDelete">
      <span class="ut">{{ undoText }}</span>
      <button>撤销</button>
    </div>

    <LongMenu ref="menuEl" @edit="onMenuEdit" @del="onMenuDel" />

    <div class="backdrop" :class="{ show: sheetOpen }" @click="closeSheet"></div>
    <div class="sheet glass sheet-narrow" :class="{ show: sheetOpen }">
      <div class="sheet-grip"></div>
      <div class="sheet-head">
        <button class="cancel" @click="closeSheet">取消</button>
        <span class="title">{{ sheetTitle }}</span>
        <span></span>
      </div>
      <div class="field-input">
        <input
          ref="inputEl"
          v-model="inputText"
          placeholder="想到什么？"
          autocomplete="off"
          enterkeyhint="done"
          @keydown.enter="submit"
        />
      </div>
      <div class="sug-wrap">
        <div class="sugtitle">再来一次</div>
        <div v-if="!filteredSuggestions.length" class="sug-none">
          {{ inputText.trim() ? '没有做过的类似条目。' : '还没有历史条目。' }}
        </div>
        <div v-for="s in filteredSuggestions" :key="s.text" class="sug" @click="pickSuggestion(s)">
          <span class="ic">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-2.6-6.4" /><path d="M21 4v5h-5" /></svg>
          </span>
          <span class="t">{{ s.text }}</span>
          <span class="when">{{ s.when }}</span>
        </div>
      </div>
      <button ref="addBtnEl" class="save sheet-add" :class="{ off: !inputText.trim() }" @click="submit">
        {{ addBtnText }}
      </button>
    </div>
  </Teleport>
</template>
