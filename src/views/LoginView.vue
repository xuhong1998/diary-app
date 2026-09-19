<script setup lang="ts">
import { watch } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const router = useRouter()

watch(() => auth.isSignedIn, (signedIn) => {
  if (signedIn) router.replace({ name: 'diary' })
})
</script>

<template>
  <div class="login-page">
    <div class="login-title">我的日记</div>
    <div class="login-subtitle">登录后可跨设备同步<br />保留每一天的回忆</div>

    <div v-if="auth.configured" class="login-btn-wrap">
      <button class="login-btn" @click="auth.signInWithGithub">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z" /></svg>
        使用 GitHub 登录
      </button>
    </div>

    <div v-else class="login-tip">
      Supabase 未配置，请在 <code>.env</code> 中填写<br />
      <code>VITE_SUPABASE_URL</code> 与 <code>VITE_SUPABASE_ANON_KEY</code>
    </div>

    <div class="login-tip">数据保存在你的 Supabase 项目中，可随时导出备份</div>
  </div>
</template>
