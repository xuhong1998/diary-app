<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useDiaryStore } from '@/stores/diary'
import { useTheme } from '@/utils/theme'
import { toast } from '@/utils/toast'

declare const __APP_VERSION__: string

/**
 * 设置页 —— 同步状态置顶一眼看到数据在哪儿；
 * 模块三行都是核心，不给开关；打卡提醒一项一推；主题三段与右上角球按钮互跟。
 */
const auth = useAuthStore()
const diary = useDiaryStore()
const { mode: themeMode, setMode } = useTheme()

const userIdentifier = computed(() => {
  const meta = auth.user?.user_metadata
  return meta?.user_name || meta?.full_name || auth.user?.email || '已登录'
})

const bannerText = computed(() => {
  if (!auth.configured) return '云同步未配置 · 数据只存本机'
  if (!auth.isSignedIn) return '未登录 · 数据只存本机'
  return diary.connected ? '已连接 · 自动同步' : '已登录 · 离线，稍后自动同步'
})

const userSubText = computed(() => (diary.connected ? '自动同步中' : '离线，稍后自动同步'))

async function signOut() {
  await auth.signOut()
  toast('已退出登录')
}
function signIn() {
  void auth.signInWithGithub()
}

// ---------- 打卡提醒：总开关收起 7 项时间（状态存本地，推送后接） ----------
const CK_KEY = 'checkin-reminders'
const CK_ROWS = [
  { em: '⏰', t: '起床', time: '07:00' },
  { em: '🥣', t: '早餐', time: '08:30' },
  { em: '🍜', t: '午餐', time: '12:00' },
  { em: '😴', t: '午休', time: '13:00' },
  { em: '🌆', t: '下班', time: '18:30' },
  { em: '🍚', t: '晚餐', time: '19:00' },
  { em: '🌙', t: '睡觉', time: '23:00' },
]

const ckMaster = ref(true)
const ckTimes = ref<Record<string, string>>({})

function loadCk() {
  try {
    const raw = localStorage.getItem(CK_KEY)
    if (raw) {
      const saved = JSON.parse(raw) as { on: boolean; times: Record<string, string> }
      ckMaster.value = saved.on
      ckTimes.value = saved.times ?? {}
    }
  } catch {}
  for (const r of CK_ROWS) {
    if (!ckTimes.value[r.t]) ckTimes.value[r.t] = r.time
  }
}

function saveCk() {
  try {
    localStorage.setItem(CK_KEY, JSON.stringify({ on: ckMaster.value, times: ckTimes.value }))
  } catch {}
}

// ---------- 模块：三行「核心」，不给开关 ----------
const MODULES = [
  { ic: '#00c7be', t: '日记', d: '时间线 · 今日感悟', icon: 'book' },
  { ic: '#30d158', t: '待办', d: '当日清单，做完封存', icon: 'check' },
  { ic: '#ff6482', t: '番茄钟', d: '标签计时 · 投入统计', icon: 'clock' },
] as const

onMounted(loadCk)
</script>

<template>
  <section class="page active" data-page="settings">
    <!-- 同步状态：置顶，一眼看到数据在哪儿 -->
    <div class="st-banner glass">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 0 0-9-9 9 9 0 0 0-6.36 2.64L3 8M3 3v5h5M3 12a9 9 0 0 0 9 9 9 9 0 0 0 6.36-2.64L21 16M21 21v-5h-5" /></svg>
      <span>{{ bannerText }}</span>
    </div>

    <div class="st-sec">
      <div class="st-h">云同步</div>
      <div class="st-group">
        <!-- 登录态 -->
        <div v-if="auth.isSignedIn" class="st-row">
          <span class="st-ic" style="--ic: #8e7ae8">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
          </span>
          <div class="st-c">
            <div class="st-t">{{ userIdentifier }}</div>
            <div class="st-d">{{ userSubText }}</div>
          </div>
          <button class="st-link danger" @click="signOut">退出</button>
        </div>
        <!-- 未登录态 -->
        <div v-else class="st-row">
          <div class="st-c">
            <div class="st-t">未登录</div>
            <div class="st-d">登录后可在多设备间同步</div>
          </div>
          <button class="st-link" @click="signIn">登录</button>
        </div>
      </div>
    </div>

    <!-- 模块：三个都是核心，不给开关 —— Tab 栏固定 4 格 -->
    <div class="st-sec">
      <div class="st-h">模块</div>
      <div class="st-group">
        <div v-for="m in MODULES" :key="m.t" class="st-row">
          <span class="st-ic" :style="{ '--ic': m.ic }">
            <svg v-if="m.icon === 'book'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z" /></svg>
            <svg v-else-if="m.icon === 'check'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" /></svg>
            <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="13" r="8" /><path d="M12 9v4l2.5 2.5" /><path d="M9 2h6" /></svg>
          </span>
          <div class="st-c">
            <div class="st-t">{{ m.t }}</div>
            <div class="st-d">{{ m.d }}</div>
          </div>
          <span class="st-core">核心</span>
        </div>
      </div>
    </div>

    <!-- 打卡：一项一推，时间跟随实际作息 -->
    <div class="st-sec">
      <div class="st-h">打卡提醒</div>
      <div class="st-group">
        <div class="st-row">
          <div class="st-c">
            <div class="st-t">每日提醒</div>
            <div class="st-d">不点不催，一天过完就翻篇</div>
          </div>
          <div
            class="st-toggle"
            :class="{ on: ckMaster }"
            role="switch"
            aria-label="打卡提醒"
            tabindex="0"
            @click="ckMaster = !ckMaster; saveCk()"
          ></div>
        </div>
        <template v-if="ckMaster">
          <div v-for="r in CK_ROWS" :key="r.t" class="st-row">
            <span class="ck-em">{{ r.em }}</span>
            <div class="st-c"><div class="st-t">{{ r.t }}</div></div>
            <input v-model="ckTimes[r.t]" type="time" class="st-time" :aria-label="r.t + '推送时间'" @change="saveCk" />
          </div>
        </template>
      </div>
    </div>

    <!-- 主题三段：和右上角那颗主题按钮是同一件事 -->
    <div class="st-sec">
      <div class="st-h">外观</div>
      <div class="st-group">
        <div class="st-row">
          <div class="st-c"><div class="st-t">主题</div></div>
          <div class="st-seg">
            <button :class="{ on: themeMode === 'auto' }" @click="setMode('auto')">跟随系统</button>
            <button :class="{ on: themeMode === 'light' }" @click="setMode('light')">浅色</button>
            <button :class="{ on: themeMode === 'dark' }" @click="setMode('dark')">深色</button>
          </div>
        </div>
      </div>
    </div>

    <div class="st-sec">
      <div class="st-h">关于</div>
      <div class="st-group">
        <div class="st-row">
          <div class="st-c"><div class="st-t">版本</div></div>
          <span class="st-val">{{ __APP_VERSION__ }}</span>
        </div>
      </div>
    </div>

    <div class="st-foot">数据存储在本地 SQLite（PowerSync）<br />登录后自动实时同步 · 支持离线</div>
  </section>
</template>
