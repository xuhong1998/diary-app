import { defineStore } from 'pinia'
import { ref } from 'vue'
import { builtinModules } from '@/modules/registry'
import type { DiaryModule } from '@/modules/types'

const STORAGE_KEY = 'diary-enabled-modules'
const KNOWN_KEY = 'diary-known-modules'

export const useModuleStore = defineStore('modules', () => {
  const modules = ref<DiaryModule[]>(builtinModules)
  const enabledIds = ref<Set<string>>(loadEnabled())

  function loadEnabled(): Set<string> {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const saved = new Set<string>(JSON.parse(raw))
        const knownRaw = localStorage.getItem(KNOWN_KEY)
        const known = new Set<string>(knownRaw ? JSON.parse(knownRaw) : [...saved])
        let changed = false
        for (const m of modules.value) {
          if (!known.has(m.id)) {
            known.add(m.id)
            saved.add(m.id)
            changed = true
          }
        }
        if (changed) {
          localStorage.setItem(STORAGE_KEY, JSON.stringify([...saved]))
          localStorage.setItem(KNOWN_KEY, JSON.stringify([...known]))
        }
        return saved
      }
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
