<script setup lang="ts">
import { ref, onUnmounted } from 'vue'

/**
 * 长按玻璃菜单：编辑 / 删除（删除红色）。
 * 锚在触发行下方 8px；下面放不下翻到行上方，transform-origin 跟随。
 * 待办行与日记条目共用。
 */
const emit = defineEmits<{ edit: []; del: [] }>()

const scrimEl = ref<HTMLElement | null>(null)
const menuEl = ref<HTMLElement | null>(null)
let anchorRow: HTMLElement | null = null

function openFor(row: HTMLElement) {
  anchorRow = row
  row.classList.add('lifted')
  const screen = menuEl.value?.closest('#app-main')
  if (!screen || !menuEl.value) return
  const sRect = screen.getBoundingClientRect()
  const rRect = row.getBoundingClientRect()
  const mw = menuEl.value.offsetWidth
  const mh = menuEl.value.offsetHeight

  let left = rRect.left - sRect.left
  let top = rRect.bottom - sRect.top + 8
  let oy = '0'
  if (top + mh > sRect.height - 110) {
    // 下面放不下就翻到行的上方
    top = rRect.top - sRect.top - mh - 8
    oy = '100%'
  }
  left = Math.max(12, Math.min(left, sRect.width - mw - 12))
  top = Math.max(12, top)

  menuEl.value.style.left = left + 'px'
  menuEl.value.style.top = top + 'px'
  menuEl.value.style.setProperty('--oy', oy)
  menuEl.value.classList.add('show')
  scrimEl.value?.classList.add('show')
}

function close() {
  anchorRow?.classList.remove('lifted')
  anchorRow = null
  menuEl.value?.classList.remove('show')
  scrimEl.value?.classList.remove('show')
}

function act(kind: 'edit' | 'del') {
  close()
  if (kind === 'edit') emit('edit')
  else emit('del')
}

onUnmounted(() => close())

defineExpose({ openFor, close })
</script>

<template>
  <Teleport to="#app-main">
    <div ref="scrimEl" class="menu-scrim" @click="close"></div>
    <div ref="menuEl" class="long-menu glass">
      <button class="mi" @click="act('edit')">
        <span class="mic">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>
        </span>
        <span>编辑</span>
      </button>
      <div class="msep"></div>
      <button class="mi danger" @click="act('del')">
        <span class="mic">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16" /><path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" /><path d="M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12" /></svg>
        </span>
        <span>删除</span>
      </button>
    </div>
  </Teleport>
</template>
