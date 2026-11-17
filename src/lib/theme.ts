export type Theme = 'light' | 'dark'

const KEY = 'qrm_theme'

export function applyTheme(t: Theme) {
  document.documentElement.classList.toggle('dark', t === 'dark')
}

export function getStoredTheme(): Theme {
  const s = localStorage.getItem(KEY)
  if (s === 'dark' || s === 'light') return s
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function toggleTheme(): Theme {
  const next: Theme = getStoredTheme() === 'dark' ? 'light' : 'dark'
  localStorage.setItem(KEY, next)
  applyTheme(next)
  return next
}
