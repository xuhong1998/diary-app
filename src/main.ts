import { createApp, watch } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import { useAuthStore } from './stores/auth'
import { useDiaryStore } from './stores/diary'
import { connectPowerSync, disconnectPowerSync, powerSyncDb } from './db/powersync'
import './styles/main.css'

const app = createApp(App)
const pinia = createPinia()
app.use(pinia)

app.config.errorHandler = (err, _instance, info) => {
  console.error('[vue] error:', info, err)
}

const auth = useAuthStore()
const diary = useDiaryStore()

auth.init().then(async () => {
  try {
    console.log('[main] connecting PowerSync...')
    await connectPowerSync()
    console.log('[main] PowerSync ready')
  } catch (e) {
    console.error('[main] PowerSync init failed:', e)
  }

  // 登录状态变化时重连/断开 PowerSync：
  // connectPowerSync 只在启动时调用一次，App 内重新登录后 SDK 不会自动重连，
  // 导致登录成功后仍显示"离线"、本地数据无法上传
  watch(
    () => auth.isSignedIn,
    async (signedIn) => {
      try {
        if (signedIn) {
          console.log('[main] signed in, reconnecting PowerSync...')
          await connectPowerSync()
        } else {
          console.log('[main] signed out, disconnecting PowerSync...')
          await disconnectPowerSync()
        }
      } catch (e) {
        console.error('[main] PowerSync reconnect failed:', e)
      }
    }
  )

  // @powersync/web 2.x 监听器回调名为 statusChanged（旧版为 onStatusChanged，已失效）
  powerSyncDb.registerListener({
    statusChanged: (status) => {
      console.log('[powersync] status:', status.getMessage?.() ?? '', '| connected:', status.connected)
      diary.updateConnectionStatus()
    },
  })
  diary.updateConnectionStatus()

  app.use(router)
  app.mount('#app')
})
