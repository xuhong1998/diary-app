<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useModuleStore } from '@/stores/modules'
import { useAuthStore } from '@/stores/auth'
import { useDiaryStore } from '@/stores/diary'
import { useRoute } from 'vue-router'
import { toastMessage } from '@/utils/toast'
import { useTheme } from '@/utils/theme'

const moduleStore = useModuleStore()
const auth = useAuthStore()
const diary = useDiaryStore()
const route = useRoute()
const drawerOpen = ref(false)
const { theme, toggleTheme } = useTheme()

const navIcons: Record<string, string> = {
  diary: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16v16H4z"/><path d="M8 4v16M4 8h4"/></svg>',
  todo: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>',
  algorithm: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="4" width="16" height="16" rx="2"/><path d="M9 8l3 3-3 3M14 8v6"/></svg>',
  interview: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/></svg>',
  export: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>',
  search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>',
  settings: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>',
}

const navItems = computed(() => {
  const items = [
    { to: '/diary', icon: 'diary', label: '日记' },
  ]
  if (moduleStore.isEnabled('todo')) {
    items.push({ to: '/todo', icon: 'todo', label: '待办' })
  }
  if (moduleStore.isEnabled('algorithm')) {
    items.push({ to: '/algorithm', icon: 'algorithm', label: '算法' })
  }
  if (moduleStore.isEnabled('interview')) {
    items.push({ to: '/interview', icon: 'interview', label: '面试题' })
  }
  items.push({ to: '/export', icon: 'export', label: '导出' })
  items.push({ to: '/search', icon: 'search', label: '搜索' })
  items.push({ to: '/settings', icon: 'settings', label: '设置' })
  return items
})

const currentTitle = computed(() => {
  return navItems.value.find(i => i.to === route.path)?.label || '日记'
})

const showLayout = computed(() => {
  return !route.meta.public && !auth.loading
})

const syncStatus = computed(() => {
  if (auth.loading) return ''
  if (!auth.configured) return '未配置云同步'
  if (!auth.isSignedIn) return '未登录'
  if (diary.connected) return '已同步'
  return '离线'
})

function closeDrawer() {
  drawerOpen.value = false
}

watch(() => route.path, () => {
  drawerOpen.value = false
})
</script>

<template>
  <router-view v-if="!showLayout" />

  <div v-else id="app-main">
    <!-- Navigation Bar -->
    <div class="nav-bar">
      <div class="nav-bar-content">
        <div class="nav-left">
          <button class="nav-menu-btn" @click="drawerOpen = true" aria-label="打开菜单">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
          </button>
        </div>
        <div class="nav-right">
          <button class="nav-icon-btn" @click="toggleTheme" aria-label="切换深色模式">
            <svg v-if="theme === 'light'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
            <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>
          </button>
        </div>
      </div>
      <div class="nav-large-title">{{ currentTitle }}</div>
    </div>

    <!-- Scroll Content -->
    <div class="scroll-content">
      <router-view />
    </div>
  </div>

  <!-- Drawer Overlay -->
  <div class="drawer-overlay" :class="{ open: drawerOpen }" @click="closeDrawer"></div>

  <!-- Drawer -->
  <div class="drawer" :class="{ open: drawerOpen }">
    <div class="drawer-header">
      <div class="drawer-logo">
        <svg width="28" height="28" viewBox="0 0 148 180" fill="none">
          <path d="M20,20 L130,20 Q148,20 148,38 L148,182 Q148,200 130,200 L20,200 Q2,200 2,182 L2,38 Q2,20 20,20 Z" fill="#fff" rx="16"/>
          <path d="M2,50 L148,50" stroke="#E0E8F0" stroke-width="2"/>
          <rect x="2" y="20" width="22" height="180" fill="rgba(0,122,255,0.3)" rx="4"/>
          <line x1="13" y1="20" x2="13" y2="200" stroke="#0051D5" stroke-width="2" opacity="0.4"/>
          <line x1="36" y1="76" x2="120" y2="76" stroke="#CDD8E0" stroke-width="6" stroke-linecap="round"/>
          <line x1="36" y1="100" x2="120" y2="100" stroke="#CDD8E0" stroke-width="6" stroke-linecap="round"/>
          <line x1="36" y1="124" x2="100" y2="124" stroke="#CDD8E0" stroke-width="6" stroke-linecap="round"/>
          <line x1="36" y1="148" x2="116" y2="148" stroke="#CDD8E0" stroke-width="6" stroke-linecap="round"/>
        </svg>
      </div>
      <div class="drawer-title">我的日记</div>
      <div class="drawer-subtitle">记录每一天的美好</div>
    </div>
    <nav class="drawer-nav">
      <router-link
        v-for="item in navItems"
        :key="item.to"
        :to="item.to"
        class="drawer-item"
        :class="{ active: route.path === item.to }"
        @click="closeDrawer"
      >
        <span v-html="navIcons[item.icon]"></span>
        <span class="drawer-item-label">{{ item.label }}</span>
      </router-link>
    </nav>
    <div class="drawer-footer">
      <div class="drawer-sync">
        <span class="sync-dot" :class="{ active: auth.isSignedIn }"></span>
        {{ syncStatus }}
      </div>
    </div>
  </div>

  <!-- Global Toast -->
  <div v-if="toastMessage" class="toast" :key="toastMessage">{{ toastMessage }}</div>
</template>
