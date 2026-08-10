<script setup lang="ts">
import { computed } from 'vue'
import { useModuleStore } from '@/stores/modules'
import { useAuthStore } from '@/stores/auth'
import { useDiaryStore } from '@/stores/diary'
import { toast } from '@/utils/toast'
import { useTheme } from '@/utils/theme'

const moduleStore = useModuleStore()
const auth = useAuthStore()
const diary = useDiaryStore()
const { theme, toggleTheme } = useTheme()

const moduleIconConfig: Record<string, { bg: string; svg: string }> = {
  diary: {
    bg: 'var(--ios-blue)',
    svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16v16H4z"/><path d="M8 4v16M4 8h4"/></svg>',
  },
  todo: {
    bg: 'var(--ios-green)',
    svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>',
  },
  algorithm: {
    bg: 'var(--ios-orange)',
    svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="4" width="16" height="16" rx="2"/><path d="M9 8l3 3-3 3M14 8v6"/></svg>',
  },
}

const userIdentifier = computed(() => {
  const meta = auth.user?.user_metadata
  return meta?.user_name || meta?.full_name || auth.user?.email || '已登录'
})

const syncBannerText = computed(() => {
  if (!auth.configured) return '云同步未配置'
  if (!auth.isSignedIn) return '未登录'
  return diary.connected ? '已连接 · 自动同步' : '离线模式'
})

async function doSignOut() {
  await auth.signOut()
  toast('已退出登录')
}
</script>

<template>
  <div class="page-pad">
    <div class="section-gap"></div>

    <!-- Sync Banner -->
    <div class="sync-banner">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a9 9 0 0 0-9-9 9 75 0 0 0-6.36 2.64L3 8M3 3v5h5M3 12a9 9 0 0 0 9 9 9 9 0 0 0 6.36-2.64L21 16M21 21v-5h-5"/></svg>
      {{ syncBannerText }}
    </div>

    <!-- Module Management -->
    <div class="list-section">
      <div class="list-header">模块管理</div>
      <div class="list-group">
        <div v-for="m in moduleStore.modules" :key="m.id" class="list-row">
          <div class="row-icon" :style="{ background: moduleIconConfig[m.id]?.bg || 'var(--ios-gray)' }">
            <span v-html="moduleIconConfig[m.id]?.svg || ''"></span>
          </div>
          <div class="row-content">
            <div class="row-title">{{ m.name }}</div>
            <div class="row-subtitle">{{ m.description }}</div>
          </div>
          <div class="row-accessory">
            <span v-if="m.isCore" class="badge" style="background:var(--fill-quaternary);color:var(--label-tertiary);">核心</span>
            <div
              v-else
              class="toggle"
              :class="{ on: moduleStore.isEnabled(m.id) }"
              @click="moduleStore.toggle(m.id)"
            >
              <div class="toggle-track"></div>
              <div class="toggle-thumb"></div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Cloud Sync -->
    <div class="list-section">
      <div class="list-header">云同步</div>
      <div class="list-group">
        <div v-if="!auth.configured" class="list-row">
          <div class="row-content">
            <div class="row-title">未配置</div>
            <div class="row-subtitle">请在 .env 填写 VITE_SUPABASE_URL 与 VITE_SUPABASE_ANON_KEY</div>
          </div>
        </div>

        <div v-else-if="!auth.isSignedIn" class="list-row">
          <div class="row-content">
            <div class="row-title">未登录</div>
            <div class="row-subtitle">登录后可在多设备间同步</div>
          </div>
          <div class="row-accessory">
            <button class="ios-btn-sm" @click="auth.signInWithGithub">登录</button>
          </div>
        </div>

        <template v-else>
          <div class="list-row">
            <div class="row-icon" style="background: var(--ios-purple);">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            </div>
            <div class="row-content">
              <div class="row-title">{{ userIdentifier }}</div>
              <div class="row-subtitle">{{ diary.connected ? '自动同步中' : '离线' }}</div>
            </div>
            <div class="row-accessory">
              <button class="icon-btn danger" @click="doSignOut">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
              </button>
            </div>
          </div>
        </template>
      </div>
    </div>

    <!-- Appearance -->
    <div class="list-section">
      <div class="list-header">外观</div>
      <div class="list-group">
        <div class="list-row" @click="toggleTheme">
          <div class="row-content"><div class="row-title">深色模式</div></div>
          <div class="toggle" :class="{ on: theme === 'dark' }" @click.stop="toggleTheme">
            <div class="toggle-track"></div>
            <div class="toggle-thumb"></div>
          </div>
        </div>
      </div>
    </div>

    <!-- About -->
    <div class="list-section">
      <div class="list-header">关于</div>
      <div class="list-group">
        <div class="list-row">
          <div class="row-content"><div class="row-title">版本</div></div>
          <div class="row-accessory"><span class="row-subtitle">2.0.0</span></div>
        </div>
      </div>
    </div>

    <div class="list-footer" style="text-align:center;">
      数据存储于本地 SQLite（PowerSync）<br>登录后自动实时同步，支持离线
    </div>
  </div>
</template>
