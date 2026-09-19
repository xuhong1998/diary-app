import { ref, computed, watch } from 'vue'

export type ThemeMode = 'auto' | 'light' | 'dark'

const KEY = 'diary-theme'
const mql =
  typeof window !== 'undefined' && window.matchMedia
    ? window.matchMedia('(prefers-color-scheme: dark)')
    : null

function load(): ThemeMode {
  try {
    const v = localStorage.getItem(KEY)
    if (v === 'light' || v === 'dark') return v
  } catch {}
  return 'auto'
}

const mode = ref<ThemeMode>(load())

const resolved = computed<'light' | 'dark'>(() => {
  if (mode.value === 'auto') return mql?.matches ? 'dark' : 'light'
  return mode.value
})

function apply() {
  document.documentElement.setAttribute('data-theme', resolved.value)
}

function setMode(m: ThemeMode) {
  mode.value = m
  try {
    localStorage.setItem(KEY, m)
  } catch {}
}

/** 右上角球按钮：跟随系统 → 强制浅色 → 强制深色 → 循环 */
function cycle() {
  const order: ThemeMode[] = ['auto', 'light', 'dark']
  setMode(order[(order.indexOf(mode.value) + 1) % order.length])
}

if (mql) {
  // 跟随系统时系统主题变化要实时生效
  mql.addEventListener?.('change', () => {
    if (mode.value === 'auto') apply()
  })
}
watch(resolved, apply)
apply()

export function useTheme() {
  return { mode, resolved, setMode, cycle }
}
