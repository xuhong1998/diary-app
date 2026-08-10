import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import { useAuthStore } from './stores/auth'
import { useDiaryStore } from './stores/diary'
import { connectPowerSync, powerSyncDb } from './db/powersync'
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

  try {
    powerSyncDb.registerListener({
      onStatusChanged: (status: { connected?: boolean }) => {
        console.log('[powersync] status:', JSON.stringify(status))
        diary.updateConnectionStatus()
      },
    })
  } catch (e) {
    console.error('[main] registerListener failed:', e)
  }
  diary.updateConnectionStatus()

  app.use(router)
  app.mount('#app')
})
