import { ref } from 'vue'

const toastMessage = ref('')
let timer: ReturnType<typeof setTimeout> | undefined

export function toast(message: string) {
  toastMessage.value = message
  if (timer) clearTimeout(timer)
  timer = setTimeout(() => {
    toastMessage.value = ''
  }, 2000)
}

export { toastMessage }
