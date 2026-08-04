<script setup lang="ts">
import { computed } from 'vue'
import { useModuleStore } from '@/stores/modules'
import { useRoute } from 'vue-router'

const moduleStore = useModuleStore()
const route = useRoute()

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
</script>

<template>
  <div id="app-container">
    <main class="main-content">
      <router-view />
    </main>
    <nav class="bottom-nav">
      <router-link
        v-for="item in navItems"
        :key="item.to"
        :to="item.to"
        class="nav-item"
        :class="{ active: route.path === item.to }"
      >
        <span class="nav-icon">{{ item.icon }}</span>
        <span class="nav-label">{{ item.label }}</span>
      </router-link>
    </nav>
  </div>
</template>
