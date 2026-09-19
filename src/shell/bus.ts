import { ref } from 'vue'

/**
 * 外壳 ↔ 页面 的轻量总线。
 * 日历 / 记一笔 / 感悟编辑器都挂在 .screen 层（App.vue），由各页面通过这里打开；
 * 「＋」的点按行为按页面分流（待办=新建待办、番茄钟=新建标签），由页面注册。
 */

// ---------- 外壳级浮层 ----------
export const calendarOpen = ref(false)
export function openCalendar() {
  calendarOpen.value = true
}

export const quickNoteOpen = ref(false)
export function openQuickNote() {
  quickNoteOpen.value = true
}

export const reflectEditorOpen = ref(false)
export function openReflectEditor() {
  reflectEditorOpen.value = true
}

export const moreMenuOpen = ref(false)
export function toggleMoreMenu() {
  moreMenuOpen.value = !moreMenuOpen.value
}
export function closeMoreMenu() {
  moreMenuOpen.value = false
}

// ---------- FAB 点按分流 ----------
const fabHandlers = new Map<string, () => void>()

export function registerFab(page: string, fn: () => void) {
  fabHandlers.set(page, fn)
}
export function unregisterFab(page: string) {
  fabHandlers.delete(page)
}
/** 页面有自己的「＋」时返回 true（外壳不再弹记一笔） */
export function invokeFab(page: string): boolean {
  const fn = fabHandlers.get(page)
  if (!fn) return false
  fn()
  return true
}
