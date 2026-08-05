<script setup lang="ts">
import { computed } from 'vue'
import { Snackbar } from '@varlet/ui'
import { useModuleStore } from '@/stores/modules'
import { useAuthStore } from '@/stores/auth'
import { useDiaryStore } from '@/stores/diary'

const moduleStore = useModuleStore()
const auth = useAuthStore()
const diary = useDiaryStore()

const lastSyncText = computed(() => {
  if (!diary.lastSyncAt) return '从未'
  const d = new Date(diary.lastSyncAt)
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  const hh = String(d.getHours()).padStart(2, '0')
  const mi = String(d.getMinutes()).padStart(2, '0')
  return `${mm}-${dd} ${hh}:${mi}`
})

const userIdentifier = computed(() => {
  const meta = auth.user?.user_metadata
  return meta?.user_name || meta?.full_name || auth.user?.email || '已登录'
})

async function doSync() {
  const res = await diary.syncNow()
  if (res.pulled || res.pushed) {
    Snackbar.success(`同步完成：拉取 ${res.pulled} 条，推送 ${res.pushed} 条`)
  } else {
    Snackbar.success('已是最新')
  }
}

async function doSignOut() {
  await auth.signOut()
  Snackbar.success('已退出登录')
}
</script>

<template>
  <div class="settings-page">
    <h2>设置</h2>

    <div class="module-list">
      <div class="setting-section-title">模块管理</div>
      <var-cell
        v-for="m in moduleStore.modules"
        :key="m.id"
        class="module-cell"
      >
        <template #icon>
          <span class="module-icon">{{ m.icon }}</span>
        </template>
        <div class="module-name">
          {{ m.name }}
          <span v-if="m.isCore" class="core-badge">核心</span>
        </div>
        <div class="module-desc">{{ m.description }}</div>
        <template #extra>
          <var-switch
            v-if="!m.isCore"
            :model-value="moduleStore.isEnabled(m.id)"
            @change="moduleStore.toggle(m.id)"
          />
          <span v-else class="locked-badge">必开</span>
        </template>
      </var-cell>
    </div>

    <div class="module-list">
      <div class="setting-section-title">云同步</div>

      <var-cell v-if="!auth.configured" class="module-cell">
        <div class="module-name">未配置</div>
        <div class="module-desc">
          请在 .env 填写 VITE_SUPABASE_URL 与 VITE_SUPABASE_ANON_KEY
        </div>
      </var-cell>

      <template v-else-if="!auth.isSignedIn">
        <var-cell class="module-cell">
          <div class="module-name">未登录</div>
          <div class="module-desc">登录后可在多设备间同步</div>
          <template #extra>
            <var-button size="small" type="primary" @click="auth.signInWithGithub">
              登录
            </var-button>
          </template>
        </var-cell>
      </template>

      <template v-else>
        <var-cell class="module-cell">
          <template #icon>
            <span class="module-icon">👤</span>
          </template>
          <div class="module-name">{{ userIdentifier }}</div>
          <div class="module-desc">最后同步：{{ lastSyncText }}</div>
          <template #extra>
            <var-button text size="small" @click="doSignOut">退出</var-button>
          </template>
        </var-cell>

        <div class="sync-actions">
          <var-button
            block
            type="primary"
            :loading="diary.syncing"
            @click="doSync"
          >
            立即同步
          </var-button>
        </div>
      </template>
    </div>

    <div class="about">
      <p>本地存储于浏览器（IndexedDB）</p>
      <p>登录后自动云同步，可随时导出备份</p>
    </div>
  </div>
</template>

<style scoped>
.sync-actions {
  margin-top: 12px;
}
</style>
