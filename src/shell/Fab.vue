<script setup lang="ts">
/**
 * 「记一笔」悬浮球：独立于 Tab 栏，落在屏幕最底部右侧。
 * 点一下 = 页面各自的「＋」；长按 0.4s = 进感悟编辑器（仅日记页有意义的动作）。
 * 长按过程反馈：放大 + 光圈；到点直接进编辑器，抬起后补的那次 click 要吞掉。
 */
const emit = defineEmits<{ activate: []; longpress: [] }>()

const LONG_PRESS = 400

let pressTimer: ReturnType<typeof setTimeout> | null = null
let longPressed = false

function pressStart() {
  longPressed = false
  pressTimer = setTimeout(() => {
    pressTimer = null
    longPressed = true
    emit('longpress')
  }, LONG_PRESS)
}

function pressEnd() {
  if (pressTimer) {
    clearTimeout(pressTimer)
    pressTimer = null
  }
}

function onClick() {
  // 长按已经进了编辑器，这次 click 丢掉，别再触发点按动作
  if (longPressed) {
    longPressed = false
    return
  }
  emit('activate')
}
</script>

<template>
  <button
    class="fab"
    aria-label="快速记一笔"
    @pointerdown="pressStart"
    @pointerup="pressEnd"
    @pointercancel="pressEnd"
    @pointerleave="pressEnd"
    @click="onClick"
  >
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round">
      <path d="M12 5v14M5 12h14" />
    </svg>
  </button>
</template>
