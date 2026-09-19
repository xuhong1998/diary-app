<script setup lang="ts">
import { ref, watch, nextTick, onUnmounted } from 'vue'
import { useDiaryStore } from '@/stores/diary'
import { reflectEditorOpen } from '@/shell/bus'
import { labelOfDate, weekdayCn } from '@/utils/date'
import { ensureRichText } from '@/utils/richText'

/**
 * 感悟 · 全屏编辑器。没有保存按钮：一边写一边（防抖）落库并同步卡片；
 * 工具条只做四件事——加粗 / 斜体 / 列表 / 引用，光标落在哪个格式里对应按钮就高亮。
 */
const store = useDiaryStore()

const bodyEl = ref<HTMLElement | null>(null)
const phEl = ref<HTMLElement | null>(null)
const toolsEl = ref<HTMLElement | null>(null)

let saveTimer: ReturnType<typeof setTimeout> | undefined
let composing = false

const dateLine = ref('')

function syncPh() {
  if (!bodyEl.value || !phEl.value) return
  phEl.value.style.display = bodyEl.value.textContent.trim() ? 'none' : 'block'
}

/** 当前光标落在哪个格式里，工具条对应按钮就高亮 */
function syncTools() {
  const tools = toolsEl.value
  if (!tools) return
  tools.querySelectorAll('.tbtn').forEach(b => {
    const el = b as HTMLElement
    const on =
      el.dataset.cmd === 'formatBlock'
        ? String(document.queryCommandValue('formatBlock')).toLowerCase() === el.dataset.val
        : document.queryCommandState(el.dataset.cmd || '')
    el.classList.toggle('act', !!on)
  })
}

function caretToEndOf(el: HTMLElement) {
  const r = document.createRange()
  r.selectNodeContents(el)
  r.collapse(false)
  const s = window.getSelection()
  if (!s) return
  s.removeAllRanges()
  s.addRange(r)
}

function flushSave() {
  if (saveTimer) {
    clearTimeout(saveTimer)
    saveTimer = undefined
  }
  if (bodyEl.value) void store.updateReflection(bodyEl.value.innerHTML)
}

function open() {
  const body = bodyEl.value
  if (!body) return
  dateLine.value = `${labelOfDate(store.currentDate)} 星期${weekdayCn(store.currentDate)}`
  body.innerHTML = ensureRichText(store.entry?.reflection ?? '')
  syncPh()
  nextTick(() => {
    setTimeout(() => {
      body.focus()
      caretToEndOf(body)
      syncTools()
    }, 380)
  })
}

function close() {
  flushSave()
  reflectEditorOpen.value = false
  bodyEl.value?.blur()
}

function onInput() {
  if (composing) return
  syncPh()
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    saveTimer = undefined
    if (bodyEl.value) void store.updateReflection(bodyEl.value.innerHTML)
  }, 400)
}

function onCompositionStart() {
  composing = true
}
function onCompositionEnd() {
  composing = false
  onInput()
}

function onSelectionChange() {
  if (reflectEditorOpen.value) syncTools()
}

document.addEventListener('selectionchange', onSelectionChange)
onUnmounted(() => {
  document.removeEventListener('selectionchange', onSelectionChange)
  if (saveTimer) {
    clearTimeout(saveTimer)
    if (bodyEl.value) void store.updateReflection(bodyEl.value.innerHTML)
  }
})

function runCmd(e: MouseEvent) {
  const btn = (e.currentTarget as HTMLElement).closest('.tbtn') as HTMLElement | null
  if (!btn) return
  const cmd = btn.dataset.cmd || ''
  if (cmd === 'formatBlock') {
    const cur = String(document.queryCommandValue('formatBlock')).toLowerCase()
    document.execCommand('formatBlock', false, cur === btn.dataset.val ? 'p' : (btn.dataset.val ?? 'p'))
  } else {
    document.execCommand(cmd, false)
  }
  bodyEl.value?.focus()
  if (bodyEl.value) void store.updateReflection(bodyEl.value.innerHTML)
  syncTools()
}

watch(reflectEditorOpen, openVal => {
  if (openVal) open()
})
</script>

<template>
  <div class="refedit" :class="{ show: reflectEditorOpen }" role="dialog" aria-label="今日感悟">
    <div class="refedit-bar">
      <div class="row">
        <span class="ttl">今日感悟</span>
        <button class="done" @click="close">完成</button>
      </div>
      <div class="date">{{ dateLine }}</div>
    </div>
    <div class="refedit-wrap">
      <div ref="phEl" class="refedit-ph">今天想说什么？<br />看到的、想到的、突然记起来的，都能写在这儿。</div>
      <div
        ref="bodyEl"
        class="refedit-body"
        contenteditable="true"
        spellcheck="false"
        @input="onInput"
        @compositionstart="onCompositionStart"
        @compositionend="onCompositionEnd"
      ></div>
    </div>
    <div ref="toolsEl" class="refedit-tools glass">
      <button class="tbtn" data-cmd="bold" aria-label="加粗" @click="runCmd">B</button>
      <button class="tbtn" data-cmd="italic" aria-label="斜体" @click="runCmd">
        <i style="font-style: italic; font-family: Georgia, serif">I</i>
      </button>
      <span class="tsep"></span>
      <button class="tbtn" data-cmd="insertUnorderedList" aria-label="列表" @click="runCmd">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01" /></svg>
      </button>
      <button class="tbtn" data-cmd="formatBlock" data-val="blockquote" aria-label="引用" @click="runCmd">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 7V4h10v3" /><path d="M5 7h14v13H5z" opacity=".45" /><path d="M9.5 11h5M9.5 14.5h5" /></svg>
      </button>
    </div>
  </div>
</template>
