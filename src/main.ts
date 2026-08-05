import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import { useAuthStore } from './stores/auth'
import { useDiaryStore } from './stores/diary'
import '@varlet/ui/es/style'
import './styles/main.css'

const app = createApp(App)
const pinia = createPinia()
app.use(pinia)

const auth = useAuthStore()
const diary = useDiaryStore()

let focusSyncTimer: number | undefined
function onFocusSync() {
  if (focusSyncTimer) window.clearTimeout(focusSyncTimer)
  focusSyncTimer = window.setTimeout(() => {
    diary.pullFromCloud()
  }, 1500)
}

auth.init().then(() => {
  window.addEventListener('focus', onFocusSync)
  if (auth.isSignedIn) {
    diary.pullFromCloud()
  }
  app.use(router)
  app.mount('#app')
})
