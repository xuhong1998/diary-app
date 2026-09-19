<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted, nextTick } from 'vue'

/**
 * 底部玻璃 Tab 栏：悬浮 4 格 + 滑动药丸。
 * 药丸用 translate 独立定位（不与 tab 的 transform 打架），首次定位不带动画。
 */
const props = defineProps<{ active: string | null }>()
const emit = defineEmits<{ go: [name: string] }>()

const TABS = [
  {
    name: 'diary',
    label: '日记',
    icon: '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z"/></svg>',
  },
  {
    name: 'todo',
    label: '待办',
    icon: '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>',
  },
  {
    name: 'pomodoro',
    label: '番茄钟',
    icon: '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2.5"/><path d="M9 2h6"/></svg>',
  },
  {
    name: 'more',
    label: '更多',
    icon: '<svg class="ic" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="1.9"/><circle cx="12" cy="12" r="1.9"/><circle cx="19" cy="12" r="1.9"/></svg>',
  },
] as const

const barEl = ref<HTMLElement | null>(null)
const btnEls = ref<Record<string, HTMLElement | null>>({})
const pill = ref({ left: 0, width: 0, ready: false })

function movePill(animate: boolean) {
  const key = props.active
  const bar = barEl.value
  const btn = key ? btnEls.value[key] : null
  if (!bar || !btn) {
    pill.value.ready = false
    return
  }
  const br = bar.getBoundingClientRect()
  const tr = btn.getBoundingClientRect()
  if (!animate) pill.value.ready = false
  pill.value.left = tr.left - br.left
  pill.value.width = tr.width
  if (!animate) {
    requestAnimationFrame(() => {
      pill.value.ready = true
    })
  }
}

watch(
  () => props.active,
  () => nextTick(() => movePill(true))
)

onMounted(() => {
  movePill(false)
  window.addEventListener('resize', onResize)
})
onUnmounted(() => window.removeEventListener('resize', onResize))

function onResize() {
  movePill(false)
}
</script>

<template>
  <nav ref="barEl" class="tabbar glass">
    <span
      class="pill"
      :style="{
        left: pill.left + 'px',
        width: pill.width + 'px',
        transition: pill.ready ? undefined : 'none',
      }"
    ></span>
    <button
      v-for="t in TABS"
      :key="t.name"
      :ref="(el) => { if (el) btnEls[t.name] = el as HTMLElement }"
      class="tab"
      :class="{ on: active === t.name }"
      @click="emit('go', t.name)"
    >
      <span v-html="t.icon"></span>
      <span class="tx">{{ t.label }}</span>
    </button>
  </nav>
</template>
