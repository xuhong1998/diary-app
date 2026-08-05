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
    <div class="login-logo">📝</div>
    <h1 class="login-title">我的日记</h1>
    <p class="login-subtitle">登录后可跨设备同步</p>

    <var-button
      v-if="auth.configured"
      type="primary"
      block
      size="large"
      :loading="false"
      @click="auth.signInWithGithub"
    >
      <svg viewBox="0 0 16 16" width="18" height="18" style="margin-right: 8px" fill="currentColor">
        <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/>
      </svg>
      使用 GitHub 登录
    </var-button>

    <div v-else class="login-hint">
      Supabase 未配置，请在 <code>.env</code> 中填写
      <code>VITE_SUPABASE_URL</code> 与 <code>VITE_SUPABASE_ANON_KEY</code>
    </div>

    <p class="login-footer">数据保存在你的 Supabase 项目中，可随时导出备份</p>
  </div>
</template>

<style scoped>
.login-page {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 32px;
  text-align: center;
}

.login-logo {
  font-size: 56px;
  margin-bottom: 16px;
}

.login-title {
  font-size: 24px;
  font-weight: 700;
  color: #1d2129;
}

.login-subtitle {
  color: #999;
  font-size: 14px;
  margin-top: 8px;
  margin-bottom: 40px;
}

.login-button {
  background: #42b883;
  color: #fff;
  border: none;
  border-radius: 12px;
  padding: 14px 28px;
  font-size: 16px;
  font-weight: 600;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  width: 100%;
  justify-content: center;
}

.login-footer {
  margin-top: 32px;
  color: #bbb;
  font-size: 12px;
  line-height: 1.6;
  max-width: 280px;
}

.login-hint {
  color: #e74c3c;
  font-size: 14px;
  line-height: 1.6;
  padding: 20px;
  background: #fff5f5;
  border-radius: 12px;
}

.login-hint code {
  background: #ffe0e0;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 12px;
}
</style>
