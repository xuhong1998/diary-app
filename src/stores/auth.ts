import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Session, User } from '@supabase/supabase-js'
import { supabase, isSupabaseConfigured } from '@/db/supabase'

export const useAuthStore = defineStore('auth', () => {
  const session = ref<Session | null>(null)
  const user = ref<User | null>(null)
  const loading = ref(true)
  const configured = computed(() => isSupabaseConfigured)

  const isSignedIn = computed(() => Boolean(session.value))

  async function init() {
    loading.value = true

    console.log('[auth] init() called')
    console.log('[auth] href:', window.location.href)
    console.log('[auth] hash:', window.location.hash)
    console.log('[auth] search:', window.location.search)

    supabase.auth.onAuthStateChange((event, newSession) => {
      console.log('[auth] event:', event, 'session:', !!newSession)
      session.value = newSession
      user.value = newSession?.user ?? null
    })

    const { data, error } = await supabase.auth.getSession()
    if (error) console.warn('[auth] getSession error:', error.message)
    console.log('[auth] initial session:', !!data.session)
    session.value = data.session
    user.value = data.session?.user ?? null
    loading.value = false
  }

  async function signInWithGithub() {
    const redirectTo = window.location.origin + import.meta.env.BASE_URL
    await supabase.auth.signInWithOAuth({
      provider: 'github',
      options: { redirectTo },
    })
  }

  async function signOut() {
    await supabase.auth.signOut()
    session.value = null
    user.value = null
  }

  return {
    session,
    user,
    loading,
    configured,
    isSignedIn,
    init,
    signInWithGithub,
    signOut,
  }
})
