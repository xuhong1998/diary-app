<script setup lang="ts">
import { ref, watch, nextTick, onUnmounted } from 'vue'
import { useDiaryStore } from '@/stores/diary'
import { quickNoteOpen } from '@/shell/bus'
import { nowTime, normalizeTime } from '@/utils/date'
import { toast } from '@/utils/toast'
import { escapeHtml } from '@/utils/richText'

/**
 * 快速记一笔：行首时间识别（7:10 / 7：10 / 710 / 1430 都认）的玻璃弹层。
 * 输入时实时重排徽章；中文输入法组合期间先不打断；草稿保留，保存成功才清空。
 */
const store = useDiaryStore()

const backdropEl = ref<HTMLElement | null>(null)
const sheetEl = ref<HTMLElement | null>(null)
const editorEl = ref<HTMLElement | null>(null)

/** 草稿（纯文本，行 = 一条记录）。关闭不丢，保存才清 */
let draft = ''

const esc = (s: string) => escapeHtml(s)

/** 行首时间识别 */
function parseLine(raw: string): { time: string | null; rest: string } {
  let m = raw.match(/^\s*(\d{1,2})\s*[：:]\s*(\d{2})\s*(.*)$/)
  if (m) {
    const h = +m[1]
    const mi = +m[2]
    if (h < 24 && mi < 60) return { time: h + ':' + String(mi).padStart(2, '0'), rest: m[3] }
  }
  m = raw.match(/^\s*(\d{3,4})\s+(.*)$/)
  if (m) {
    const d = m[1]
    const h = +d.slice(0, -2)
    const mi = +d.slice(-2)
    if (h < 24 && mi < 60) return { time: h + ':' + String(mi).padStart(2, '0'), rest: m[2] }
  }
  return { time: null, rest: raw }
}

function renderLine(raw: string): string {
  const p = parseLine(raw)
  const badge = p.time
    ? '<span class="badge time" data-raw="' + p.time + '" contenteditable="false">' + p.time + '</span>'
    : '<span class="badge now" contenteditable="false">现在</span>'
  // 空行要放 <br>：.txt 是 flex item，Chromium 会丢弃空节点内的光标（表现为打不了字）
  return '<div class="line">' + badge + '<span class="txt">' + (p.rest ? esc(p.rest) : '<br>') + '</span></div>'
}

/** 从 DOM 还原纯文本——徽章里的时间要拼回去，否则重绘时会被吃掉 */
function readRaw(): string {
  const editor = editorEl.value
  if (!editor) return ''
  if (!editor.children.length) return editor.textContent || ''
  return Array.from(editor.children)
    .map(line => {
      if (!(line instanceof HTMLElement) || !line.classList.contains('line')) return line.textContent || ''
      const b = line.querySelector<HTMLElement>('.badge')
      const t = line.querySelector<HTMLElement>('.txt')
      const pre = b?.dataset.raw ? b.dataset.raw + ' ' : ''
      return pre + (t ? t.textContent : '')
    })
    .join('\n')
}

function paint(text: string) {
  const editor = editorEl.value
  if (!editor) return
  editor.innerHTML = text
    .split('\n')
    .map(renderLine)
    .join('')
}

function caretToEnd() {
  const editor = editorEl.value
  if (!editor) return
  const lines = editor.querySelectorAll('.line')
  const target = lines.length ? lines[lines.length - 1].querySelector('.txt') : editor
  if (!target) return
  const r = document.createRange()
  r.selectNodeContents(target)
  r.collapse(false)
  const s = getSelection()
  if (!s) return
  s.removeAllRanges()
  s.addRange(r)
}

/** 输入时实时重排徽章；内容没变就不动 DOM，免得光标乱跳 */
function repaint() {
  const editor = editorEl.value
  if (!editor) return
  const raw = readRaw()
  const html = raw
    .split('\n')
    .map(renderLine)
    .join('')
  if (html !== editor.innerHTML) {
    editor.innerHTML = html
    caretToEnd()
  }
}

// ---------- 输入事件 ----------

let composing = false
function onCompositionStart() {
  composing = true
}
function onCompositionEnd() {
  composing = false
  repaint()
}
function onInput() {
  if (!composing) repaint()
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    paint(readRaw() + '\n')
    caretToEnd()
  }
}

/** 点到徽章 / 行空白 / 编辑器空白：光标兜底落回最后一行行尾。
 *  徽章是 contenteditable=false，直接点它浏览器放不进光标（iOS 上表现为「打不了字」） */
function onEditorClick(e: MouseEvent) {
  const t = e.target as HTMLElement | null
  if (t?.closest('.txt')) return
  editorEl.value?.focus()
  caretToEnd()
}

/** 粘贴多行：按行追加，对应「批量录入」场景 */
function onPaste(e: ClipboardEvent) {
  e.preventDefault()
  const text = (e.clipboardData || (window as unknown as { clipboardData: DataTransfer | null }).clipboardData)?.getData('text') || ''
  const incoming = text.split(/\r?\n/).filter(l => l.trim())
  if (!incoming.length) return
  const lines = readRaw().split('\n')
  while (lines.length && !lines[lines.length - 1].trim()) lines.pop()
  paint(lines.concat(incoming).join('\n'))
  caretToEnd()
}

// ---------- 开合 ----------

function open() {
  paint(draft)
  // 立刻聚焦一次：此刻还在点「＋」的用户激活窗口内（iOS 对异步 focus 不弹键盘）；
  // 弹层动画走完再补一次，兼顾桌面与动画后才可点的场景
  editorEl.value?.focus()
  caretToEnd()
  nextTick(() => {
    setTimeout(() => {
      editorEl.value?.focus()
      caretToEnd()
    }, 360)
  })
}

function close() {
  if (editorEl.value) draft = readRaw()
  quickNoteOpen.value = false
}

async function save() {
  const raw = editorEl.value ? readRaw() : draft
  const lines = raw.split('\n').filter(l => l.trim())
  if (!lines.length) return
  let n = 0
  for (const line of lines) {
    const p = parseLine(line)
    const text = p.rest.trim()
    if (!text) continue
    await store.addRecord(text, p.time ? normalizeTime(p.time) : nowTime())
    n++
  }
  draft = ''
  quickNoteOpen.value = false
  setTimeout(() => {
    toast(n > 1 ? `已添加 ${n} 条记录` : '已添加 1 条记录')
  }, 220)
}

watch(quickNoteOpen, openVal => {
  if (openVal) open()
})

onUnmounted(() => {
  if (editorEl.value) draft = readRaw()
})

defineExpose({ close, save })
</script>

<template>
  <div ref="backdropEl" class="backdrop" :class="{ show: quickNoteOpen }" @click="close"></div>

  <div ref="sheetEl" class="sheet glass qn-sheet" :class="{ show: quickNoteOpen }" role="dialog" aria-label="快速记一笔">
    <div class="sheet-grip"></div>
    <div class="sheet-head">
      <span></span>
      <span class="title">记一笔</span>
      <button class="cancel" @click="close">取消</button>
    </div>
    <div
      ref="editorEl"
      class="editor"
      contenteditable="true"
      spellcheck="false"
      @input="onInput"
      @compositionstart="onCompositionStart"
      @compositionend="onCompositionEnd"
      @keydown="onKeydown"
      @paste="onPaste"
      @click="onEditorClick"
    ></div>
    <div class="sheet-foot">
      <button class="save" @click="save">保存</button>
    </div>
  </div>
</template>
