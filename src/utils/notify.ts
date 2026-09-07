let audioCtx: AudioContext | null = null

function getCtx(): AudioContext | null {
  try {
    if (!audioCtx) {
      const AC =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (!AC) return null
      audioCtx = new AC()
    }
    if (audioCtx.state === 'suspended') void audioCtx.resume()
    return audioCtx
  } catch {
    return null
  }
}

/** 在用户手势（如点击开始）里调用，提前解锁音频，保证后台/息屏时也能出声 */
export function unlockAudio(): void {
  getCtx()
}

let unlockInstalled = false

/**
 * 刷新恢复等没有手势的场景下，首次任意点击/按键时解锁音频
 * （iOS 需要用户手势才能启动 AudioContext，否则恢复后的完成提示音不响）
 */
export function installAudioUnlock(): void {
  if (unlockInstalled || typeof window === 'undefined') return
  unlockInstalled = true
  const unlock = () => unlockAudio()
  window.addEventListener('pointerdown', unlock, { once: true, capture: true })
  window.addEventListener('keydown', unlock, { once: true, capture: true })
}

function tone(freq: number, at: number, dur: number, vol = 0.35): void {
  const c = getCtx()
  if (!c) return
  const osc = c.createOscillator()
  const gain = c.createGain()
  osc.type = 'sine'
  osc.frequency.value = freq
  const t = c.currentTime + at
  gain.gain.setValueAtTime(0, t)
  gain.gain.linearRampToValueAtTime(vol, t + 0.02)
  gain.gain.exponentialRampToValueAtTime(0.001, t + dur)
  osc.connect(gain)
  gain.connect(c.destination)
  osc.start(t)
  osc.stop(t + dur + 0.05)
}

/** 专注结束：上行三连音；休息结束：下行双音 */
export function playChime(kind: 'focus' | 'break'): void {
  if (kind === 'focus') {
    tone(523.25, 0, 0.35)
    tone(659.25, 0.14, 0.35)
    tone(783.99, 0.28, 0.55)
  } else {
    tone(783.99, 0, 0.3)
    tone(523.25, 0.18, 0.5)
  }
}

export function vibrate(pattern: number[] = [200, 100, 200]): void {
  try {
    navigator.vibrate?.(pattern)
  } catch {}
}

export async function requestNotifyPermission(): Promise<boolean> {
  try {
    if (!('Notification' in window)) return false
    if (Notification.permission === 'granted') return true
    if (Notification.permission === 'denied') return false
    return (await Notification.requestPermission()) === 'granted'
  } catch {
    return false
  }
}

export function sendNotification(title: string, body: string): void {
  try {
    if ('Notification' in window && Notification.permission === 'granted' && document.hidden) {
      new Notification(title, { body, tag: 'pomodoro' })
    }
  } catch {}
}
