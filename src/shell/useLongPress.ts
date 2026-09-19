import { onUnmounted } from 'vue'

/**
 * 长按手势（待办行 / 日记条目共用）。
 * 长按 450ms 触发回调（回调收到按住的元素）；位移超过容差视为滚动，取消长按；
 * 长按已触发后抬起的那次 click 由调用方抑制（up() 返回 true）。
 * 不内部注册生命周期，允许按行动态创建；调用方持有并在卸载时 dispose。
 */

export const LONG_PRESS_MS = 450
export const MOVE_TOL = 8

export interface LongPressGesture {
  down: (e: PointerEvent) => void
  move: (e: PointerEvent) => void
  /** @returns true = 长按已触发，调用方应抑制这次点击 */
  up: () => boolean
  cancel: () => void
  dispose: () => void
}

export function createLongPress(onLongPress: (el: HTMLElement) => void): LongPressGesture {
  let timer: ReturnType<typeof setTimeout> | null = null
  let active = false
  let fired = false
  let startX = 0
  let startY = 0
  let el: HTMLElement | null = null

  const clear = () => {
    if (timer) {
      clearTimeout(timer)
      timer = null
    }
  }

  return {
    down(e: PointerEvent) {
      active = true
      fired = false
      el = e.currentTarget as HTMLElement
      startX = e.clientX
      startY = e.clientY
      clear()
      timer = setTimeout(() => {
        timer = null
        if (!active || !el) return
        fired = true
        onLongPress(el)
      }, LONG_PRESS_MS)
    },
    move(e: PointerEvent) {
      if (!active || fired) return
      // 在读页面，不是想动这条
      if (Math.abs(e.clientX - startX) > MOVE_TOL || Math.abs(e.clientY - startY) > MOVE_TOL) {
        active = false
        clear()
      }
    },
    up() {
      if (!active) return true
      const wasLong = fired
      active = false
      clear()
      return wasLong
    },
    cancel() {
      active = false
      clear()
    },
    dispose() {
      this.cancel()
    },
  }
}

/** 页面级收集器：卸载时统一 dispose 所有按行手势 */
export function useLongPressBag() {
  const bag = new Set<LongPressGesture>()
  const make = (cb: (el: HTMLElement) => void) => {
    const g = createLongPress(cb)
    bag.add(g)
    return g
  }
  onUnmounted(() => bag.forEach(g => g.dispose()))
  return { make }
}
