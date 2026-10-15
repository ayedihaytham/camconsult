export const THEME_STORAGE_KEY = 'camconsult-theme'
export const THEME_CHANGE_EVENT = 'camconsult-theme-change'

// Applied in the head before the page paints, including on full locale changes.
export const THEME_INIT_SCRIPT = `(() => {
  let preference;
  try { preference = localStorage.getItem('${THEME_STORAGE_KEY}'); } catch {}
  const dark = preference === 'dark' || (preference !== 'light' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.classList.toggle('dark', dark);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
})()`

export function applyTheme(dark: boolean) {
  const root = document.documentElement
  root.classList.toggle('dark', dark)
  root.dataset.theme = dark ? 'dark' : 'light'
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#3A4F68' : '#D7DADB')
}

export function readTheme() {
  let preference: string | null = null
  try { preference = localStorage.getItem(THEME_STORAGE_KEY) } catch {}
  return preference === 'dark' || (preference !== 'light' && matchMedia('(prefers-color-scheme: dark)').matches)
}
