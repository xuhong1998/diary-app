<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useModuleStore } from '@/stores/modules'
import { useRoute } from 'vue-router'

const moduleStore = useModuleStore()
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

watch(() => route.path, () => {
  sidebarOpen.value = false
})
</script>

<template>
  <div id="app-container" :class="{ 'sidebar-open': sidebarOpen }">
    <!-- 顶部栏 -->
    <header class="top-bar">
      <button class="menu-btn" @click="sidebarOpen = !sidebarOpen">
        <span class="hamburger"></span>
      </button>
      <span class="top-title">{{ navItems.find(i => i.to === route.path)?.label || '日记' }}</span>
    </header>

    <!-- 遮罩 -->
    <div v-if="sidebarOpen" class="overlay" @click="sidebarOpen = false"></div>

    <!-- 侧边栏 -->
    <aside class="sidebar" :class="{ open: sidebarOpen }">
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
    </aside>

    <!-- 主内容 -->
    <main class="main-content">
      <router-view />
    </main>
  </div>
</template>
