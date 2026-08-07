<script setup lang="ts">
import { ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { fetchWeatherData, getWeatherSvg, type WeatherData } from '@/utils/weather'

const auth = useAuthStore()
const router = useRouter()

watch(() => auth.isSignedIn, (signedIn) => {
  if (signedIn) router.replace({ name: 'diary' })
})

const debugLog = ref<string[]>([])
const weatherData = ref<WeatherData | null>(null)
const debugLoading = ref(false)

const envSummary = `Secure=${window.isSecureContext} · ${location.protocol.replace(':', '').toUpperCase()} · ${window.self !== window.top ? 'iframe' : '顶层'} · ${navigator.userAgent.slice(0, 60)}`

function addLog(msg: string) {
  const now = new Date().toLocaleTimeString()
  debugLog.value.unshift(`[${now}] ${msg}`)
}

async function testLocation() {
  debugLoading.value = true
  debugLog.value = []
  weatherData.value = null
  addLog(`环境: ${envSummary}`)
  try {
    const today = new Date().toISOString().slice(0, 10)
    addLog(`日期: ${today}`)
    const data = await fetchWeatherData(today, addLog)
    weatherData.value = data
    addLog(`✅ 成功: ${data.city} ${data.temp}°C ${data.desc} 湿度${data.humidity}%${data.locationFallback ? ' (定位未成功，显示默认城市)' : ''}`)
  } catch (e: any) {
    addLog(`❌ 失败: ${e?.message || e}`)
  } finally {
    debugLoading.value = false
  }
}
</script>

<template>
  <div class="login-page">
    <div class="login-logo">
      <svg width="48" height="48" viewBox="0 0 148 180" fill="none">
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
    <div class="login-title">我的日记</div>
    <div class="login-subtitle">登录后可跨设备同步<br>保留每一天的回忆</div>

    <!-- 调试: 定位 + 天气 -->
    <div style="width:100%; max-width:360px; margin:24px auto 0; text-align:left;">
      <button class="ios-btn" :disabled="debugLoading" @click="testLocation" style="width:100%; margin-bottom:12px;">
        {{ debugLoading ? '测试中...' : '测试定位 + 天气' }}
      </button>

      <div v-if="weatherData" style="background:#fff; border-radius:16px; padding:16px; margin-bottom:12px; box-shadow:0 1px 4px rgba(0,0,0,0.06); display:flex; align-items:center; gap:12px;">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#007AFF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" v-html="getWeatherSvg(weatherData.icon)"></svg>
        <div>
          <div style="font-size:20px; font-weight:600;">{{ weatherData.temp }}°C {{ weatherData.desc }}</div>
          <div style="font-size:13px; color:#8e8e93;">📍 {{ weatherData.city }} · 湿度 {{ weatherData.humidity }}%</div>
          <div v-if="weatherData.locationFallback" style="font-size:12px; color:#FF9500; margin-top:2px;">⚠️ 定位未成功，显示默认城市天气</div>
        </div>
      </div>

      <div v-if="debugLog.length" style="background:#1e1e1e; color:#0f0; border-radius:12px; padding:12px; font-size:12px; font-family:monospace; max-height:200px; overflow-y:auto; line-height:1.6;">
        <div v-for="(log, i) in debugLog" :key="i">{{ log }}</div>
      </div>
    </div>

    <div v-if="auth.configured" class="login-btn-wrap">
      <button class="ios-btn" @click="auth.signInWithGithub">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/></svg>
        使用 GitHub 登录
      </button>
    </div>

    <div v-else class="tip-box" style="max-width:320px;">
      Supabase 未配置，请在 <code>.env</code> 中填写
      <code>VITE_SUPABASE_URL</code> 与 <code>VITE_SUPABASE_ANON_KEY</code>
    </div>

    <div class="login-footer">
      数据保存在你的 Supabase 项目中，可随时导出备份
    </div>
  </div>
</template>
