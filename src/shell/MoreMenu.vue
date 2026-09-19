<script setup lang="ts">
import { moreMenuOpen, closeMoreMenu } from './bus'

/** 「更多」菜单：导出 / 设置，两个二级页入口 */
const emit = defineEmits<{ go: [name: string] }>()

function go(name: string) {
  closeMoreMenu()
  emit('go', name)
}
</script>

<template>
  <div class="more-scrim" :class="{ show: moreMenuOpen }" @click="closeMoreMenu"></div>
  <div class="more-menu glass" :class="{ show: moreMenuOpen }">
    <button @click="go('export')">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
        <path d="M12 3v12" />
        <path d="m8 11 4 4 4-4" />
        <path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
      </svg>
      导出
    </button>
    <button @click="go('settings')">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round">
        <path d="M4 6h16M4 12h16M4 18h16" />
        <circle cx="9" cy="6" r="2.1" fill="currentColor" stroke="none" />
        <circle cx="15" cy="12" r="2.1" fill="currentColor" stroke="none" />
        <circle cx="8" cy="18" r="2.1" fill="currentColor" stroke="none" />
      </svg>
      设置
    </button>
  </div>
</template>
