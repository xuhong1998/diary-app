import { computed, reactive, ref, watch } from 'vue'
import { useDiaryStore } from '@/stores/diary'
import { powerSyncDb } from '@/db/powersync'
import { parseDate, todayStr, nowTime } from '@/utils/date'
import { toast } from '@/utils/toast'
import {
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

const weekdaysShort = ['日', '一', '二', '三', '四', '五', '六']

/** 每日待办（原打卡模块）数据域：items 定义每日快照 + 当日 checks，播种与统计逻辑搬自 checkin/Component.vue */
export function useCheckin() {
  const store = useDiaryStore()
  const today = todayStr()

  const items = ref<CheckinItem[]>([])
  const checks = ref<Record<string, CheckinCheck>>({})
  const allDays = ref<CheckinDay[]>([])

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

  const activeItems = computed(() => items.value.filter(i => i.active))

  const progress = computed(() => todayProgress(items.value, checks.value))

  const dayChecksMap = computed(() => {
    const map: Record<string, Record<string, CheckinCheck>> = {}
    for (const d of allDays.value) map[d.date] = d.checks
    map[store.currentDate] = checks.value
    return map
  })

  const overallStreak = computed(() => activityStreak(dayChecksMap.value, today))
  const firstSeen = computed(() => firstSeenDates(allDays.value))

  const isToday = computed(() => store.currentDate === today)

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
      toast('已存在同名每日待办')
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

  /** 容器 loadEntry 之后调用：拉全历史 + 当日播种 */
  async function init() {
    await loadAll()
    loadData()
  }

  return reactive({
    items, checks, editing, isToday, activeItems, progress, overallStreak,
    newName, newIcon, newKind, editName, editIcon, editKind,
    init, loadData, toggleCheck, addItem, submitNew, presetAdded,
    moveItem, openEdit, saveEdit, toggleArchive, removeItem,
    streakOf, last7Of, monthOf, weekdayOf,
  })
}
