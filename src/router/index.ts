import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const routes = [
  {
    path: '/',
    redirect: '/diary',
  },
  {
    path: '/login',
    name: 'login',
    component: () => import('@/views/LoginView.vue'),
    meta: { public: true },
  },
  {
    path: '/diary',
    name: 'diary',
    component: () => import('@/views/DiaryView.vue'),
  },
  {
    path: '/todo',
    name: 'todo',
    component: () => import('@/views/TodoView.vue'),
  },
  {
    path: '/pomodoro',
    name: 'pomodoro',
    component: () => import('@/views/PomodoroView.vue'),
  },
  // 二级页：底栏收起，顶栏 ‹ 返回
  {
    path: '/export',
    name: 'export',
    component: () => import('@/views/ExportView.vue'),
  },
  {
    path: '/settings',
    name: 'settings',
    component: () => import('@/views/SettingsView.vue'),
  },
  // 旧入口收编
  { path: '/checkin', redirect: '/todo' },
  { path: '/algorithm', redirect: '/diary' },
  { path: '/interview', redirect: '/diary' },
  { path: '/search', redirect: '/diary' },
]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
})

router.beforeEach((to) => {
  const auth = useAuthStore()
  if (auth.loading) return true
  if (!to.meta.public && !auth.isSignedIn) {
    return { name: 'login' }
  }
  if (to.name === 'login' && auth.isSignedIn) {
    return { name: 'diary' }
  }
})

export default router
