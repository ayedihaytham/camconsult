export const THEME_STORAGE_KEY = 'camconsult-theme'
export const THEME_CHANGE_EVENT = 'camconsult-theme-change'

// Applied in the head before the page paints, including on full locale changes.
export const THEME_INIT_SCRIPT = `(() => {
  let preference;
  try { preference = localStorage.getItem('${THEME_STORAGE_KEY}'); } catch {}
  const dark = preference === 'dark' || (preference !== 'light' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.classList.toggle('dark', dark);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  const syncChrome = () => {
    const color = getComputedStyle(document.documentElement).getPropertyValue('--feature').trim();
    if (color) document.querySelectorAll('meta[name="theme-color"]').forEach(meta => {
      meta.setAttribute('content', color);
      meta.removeAttribute('media');
    });
  };
  syncChrome();
  document.addEventListener('DOMContentLoaded', syncChrome, { once: true });
})()`

export function applyTheme(dark: boolean) {
  const root = document.documentElement
  root.classList.toggle('dark', dark)
  root.dataset.theme = dark ? 'dark' : 'light'
  const color = getComputedStyle(root).getPropertyValue('--feature').trim()
  document.querySelectorAll('meta[name="theme-color"]').forEach(meta => {
    meta.setAttribute('content', color)
    meta.removeAttribute('media')
  })
}

export function readTheme() {
  let preference: string | null = null
  try { preference = localStorage.getItem(THEME_STORAGE_KEY) } catch {}
  return preference === 'dark' || (preference !== 'light' && matchMedia('(prefers-color-scheme: dark)').matches)
}
