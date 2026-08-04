import { defineStore } from 'pinia'
import { ref } from 'vue'
import { builtinModules } from '@/modules/registry'
import type { DiaryModule } from '@/modules/types'

const STORAGE_KEY = 'diary-enabled-modules'

export const useModuleStore = defineStore('modules', () => {
  const modules = ref<DiaryModule[]>(builtinModules)
  const enabledIds = ref<Set<string>>(loadEnabled())

  function loadEnabled(): Set<string> {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) return new Set(JSON.parse(raw))
    } catch {}
    return new Set(modules.value.map(m => m.id))
  }

  function persist() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...enabledIds.value]))
  }

  function toggle(id: string) {
    if (enabledIds.value.has(id)) {
      enabledIds.value.delete(id)
    } else {
      enabledIds.value.add(id)
    }
    enabledIds.value = new Set(enabledIds.value)
    persist()
  }

  function isEnabled(id: string): boolean {
    return enabledIds.value.has(id)
  }

  const enabledModules = () => modules.value.filter(m => enabledIds.value.has(m.id))

  return { modules, enabledIds, toggle, isEnabled, enabledModules }
})
