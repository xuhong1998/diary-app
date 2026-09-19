<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useDiaryStore } from '@/stores/diary'
import { usePomodoroStore } from '@/stores/pomodoro'
import { toastMessage } from '@/utils/toast'
import { useTheme } from '@/utils/theme'
import { labelOfDate, subOfDate } from '@/utils/date'
import TabBar from '@/shell/TabBar.vue'
import Fab from '@/shell/Fab.vue'
import MoreMenu from '@/shell/MoreMenu.vue'
import CalendarSheet from '@/components/CalendarSheet.vue'
import QuickNoteSheet from '@/components/QuickNoteSheet.vue'
import ReflectEditor from '@/components/ReflectEditor.vue'
import {
  openCalendar,
  openQuickNote,
  openReflectEditor,
  invokeFab,
  unregisterFab,
  closeMoreMenu,
  toggleMoreMenu,
  quickNoteOpen,
  reflectEditorOpen,
  calendarOpen,
  moreMenuOpen,
} from '@/shell/bus'

// 应用启动即实例化番茄钟 store：刷新后无论停留在哪个页面，都能恢复/补记计时
usePomodoroStore()

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const diary = useDiaryStore()
const { cycle: cycleTheme } = useTheme()

const showLayout = computed(() => !route.meta.public && !auth.loading)

/** 二级页（从「更多」进入）：底栏与球下沉收起，顶栏变「‹ 返回 + 页名」 */
const SUB_PAGES = ['export', 'settings']
const isSub = computed(() => SUB_PAGES.includes(String(route.name)))
const SUB_TITLES: Record<string, string> = { export: '导出', settings: '设置' }
const subTitle = computed(() => SUB_TITLES[String(route.name)] ?? '')

/** Tab 高亮只给顶级目的地；二级页全灭 */
const topActive = computed(() => {
  const name = String(route.name)
  return ['diary', 'todo', 'pomodoro'].includes(name) ? name : null
})

// ---------- 滚动浮现的紧凑导航栏（仅日记页；标题也可点，翻远日期不用先滚回顶部） ----------
const pagesEl = ref<HTMLElement | null>(null)
const navShow = ref(false)

const navTitle = computed(() => labelOfDate(diary.currentDate))
const navSub = computed(() => subOfDate(diary.currentDate))

function onScroll() {
  navShow.value = pagesEl.value ? pagesEl.value.scrollTop > 56 : false
}

/** 紧凑标题 = 日历入口（仅日记页渲染这条 navbar，天然不会跨页误开） */
function onNavTitle() {
  openCalendar()
}

function goTop() {
  nextTick(() => {
    if (pagesEl.value) pagesEl.value.scrollTop = 0
    navShow.value = false
    closeMoreMenu()
  })
}

watch(() => route.name, goTop)

// ---------- 页面切换 ----------
function go(name: string) {
  if (name === 'more') {
    toggleMoreMenu()
    return
  }
  router.push({ name })
}

/** 二级页返回：回到进入前的页面（历史为空则回日记） */
function goBack() {
  if (window.history.state?.back) router.back()
  else router.replace({ name: 'diary' })
}

// Esc 也能返回 / 关浮层 —— 先让浮层关，再退二级页
document.addEventListener('keydown', e => {
  if (e.key !== 'Escape') return
  if (quickNoteOpen.value) {
    quickNoteOpen.value = false
    return
  }
  if (reflectEditorOpen.value) {
    reflectEditorOpen.value = false
    return
  }
  if (calendarOpen.value) {
    calendarOpen.value = false
    return
  }
  if (moreMenuOpen.value) {
    closeMoreMenu()
    return
  }
  if (isSub.value) goBack()
})

// ---------- 「＋」悬浮球：点按按页面分流，长按 0.4s 进感悟编辑器（日记页） ----------
function onFabActivate() {
  if (invokeFab(String(route.name))) return
  openQuickNote()
}

function onFabLongpress() {
  if (String(route.name) !== 'diary') return
  openReflectEditor()
}

// 页面卸载时清理注册的 FAB 行为（按当前页名清，切换路由前旧页面先卸载）
watch(
  () => route.name,
  (_, old) => {
    if (old) unregisterFab(String(old))
  }
)

const subBack = goBack
</script>

<template>
  <router-view v-if="!showLayout" />

  <div v-else id="app-main" class="screen" :class="{ subpage: isSub }">
    <!-- 滚动后出现的紧凑玻璃导航栏（日记页专属） -->
    <div v-if="String(route.name) === 'diary'" class="navbar glass" :class="{ show: navShow }">
      <div class="nav-date" @click="onNavTitle">
        <div class="t">{{ navTitle }}</div>
        <div class="d">{{ navSub }}</div>
      </div>
    </div>

    <!-- 二级页常驻窄顶栏：‹ 在左、页名居中 -->
    <div v-if="isSub" class="subbar glass show">
      <button class="bk" aria-label="返回" @click="subBack">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6" /></svg>
      </button>
      <span class="tt">{{ subTitle }}</span>
    </div>

    <!-- 主题切换 -->
    <button v-if="!isSub" class="theme-btn" aria-label="切换主题" @click="cycleTheme">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round">
        <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />
      </svg>
    </button>

    <!-- 页面 -->
    <main ref="pagesEl" class="pages" @scroll="onScroll">
      <router-view />
    </main>

    <!-- 底部玻璃 Tab -->
    <TabBar :active="topActive" @go="go" />

    <!-- 记一笔悬浮球 -->
    <Fab @activate="onFabActivate" @longpress="onFabLongpress" />

    <!-- 更多菜单 -->
    <MoreMenu @go="go" />

    <!-- 全局浮层 -->
    <CalendarSheet />
    <QuickNoteSheet />
    <ReflectEditor />

    <!-- 轻提示 -->
    <div class="toast" :class="{ show: !!toastMessage }">{{ toastMessage }}</div>
  </div>
</template>
