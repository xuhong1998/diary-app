import { ref } from 'vue'

const theme = ref(localStorage.getItem('diary-theme') || 'light')

function applyTheme(t: string) {
  document.documentElement.setAttribute('data-theme', t)
}

applyTheme(theme.value)

function toggleTheme() {
  theme.value = theme.value === 'dark' ? 'light' : 'dark'
  localStorage.setItem('diary-theme', theme.value)
  applyTheme(theme.value)
}

export function useTheme() {
  return { theme, toggleTheme }
}

export { theme }
