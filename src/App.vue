<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useModuleStore } from '@/stores/modules'
import { useAuthStore } from '@/stores/auth'
import { useDiaryStore } from '@/stores/diary'
import { useRoute } from 'vue-router'

const moduleStore = useModuleStore()
const auth = useAuthStore()
const diary = useDiaryStore()
const route = useRoute()
const sidebarOpen = ref(false)

const navItems = computed(() => {
  const items = [
    { to: '/diary', icon: '📝', label: '日记' },
  ]
  if (moduleStore.isEnabled('todo')) {
    items.push({ to: '/todo', icon: '✅', label: '待办' })
  }
  if (moduleStore.isEnabled('algorithm')) {
    items.push({ to: '/algorithm', icon: '🧮', label: '算法' })
  }
  items.push({ to: '/export', icon: '📤', label: '导出' })
  items.push({ to: '/settings', icon: '⚙️', label: '设置' })
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
  if (diary.syncing) return '同步中…'
  if (diary.lastSyncAt) {
    const d = new Date(diary.lastSyncAt)
    const hh = String(d.getHours()).padStart(2, '0')
    const mm = String(d.getMinutes()).padStart(2, '0')
    return `已同步 · ${hh}:${mm}`
  }
  return '已登录'
})

watch(() => route.path, () => {
  sidebarOpen.value = false
})
</script>

<template>
  <router-view v-if="!showLayout" />

  <div v-else id="app-container">
    <!-- 顶部栏 -->
    <var-app-bar :title="currentTitle">
      <template #left>
        <var-button
          text
          round
          color="transparent"
          text-color="#1d2129"
          @click="sidebarOpen = !sidebarOpen"
        >
          ☰
        </var-button>
      </template>
    </var-app-bar>

    <!-- 侧边抽屉 -->
    <var-popup position="left" v-model:show="sidebarOpen">
      <div class="sidebar">
        <div class="sidebar-header">
          <span class="sidebar-title">📝 我的日记</span>
        </div>
        <nav class="sidebar-nav">
          <router-link
            v-for="item in navItems"
            :key="item.to"
            :to="item.to"
            class="sidebar-item"
            :class="{ active: route.path === item.to }"
          >
            <span class="sidebar-icon">{{ item.icon }}</span>
            <span>{{ item.label }}</span>
          </router-link>
        </nav>
        <div class="sidebar-footer">
          <span class="sync-status" :class="{ active: auth.isSignedIn }">{{ syncStatus }}</span>
        </div>
      </div>
    </var-popup>

    <!-- 主内容 -->
    <main class="main-content">
      <router-view />
    </main>
  </div>
</template>

<style scoped>
.sidebar-footer {
  padding: 12px 20px;
  border-top: 1px solid #f0f0f0;
}

.sync-status {
  font-size: 12px;
  color: #bbb;
}

.sync-status.active {
  color: #42b883;
}
</style>
