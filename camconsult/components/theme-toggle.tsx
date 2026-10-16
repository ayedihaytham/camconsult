'use client'

import { useSyncExternalStore } from 'react'
import { Moon, Sun } from 'lucide-react'
import { getDictionary, type Lang } from '@/lib/i18n'
import { applyTheme, readTheme, THEME_CHANGE_EVENT, THEME_STORAGE_KEY } from '@/lib/theme'

function subscribe(onChange: () => void) {
  const media = matchMedia('(prefers-color-scheme: dark)')
  const sync = () => {
    applyTheme(readTheme())
    onChange()
  }
  const onStorage = (event: StorageEvent) => {
    if (event.key === THEME_STORAGE_KEY || event.key === null) sync()
  }
  media.addEventListener('change', sync)
  window.addEventListener('storage', onStorage)
  window.addEventListener(THEME_CHANGE_EVENT, onChange)
  sync()
  return () => {
    media.removeEventListener('change', sync)
    window.removeEventListener('storage', onStorage)
    window.removeEventListener(THEME_CHANGE_EVENT, onChange)
  }
}

const getSnapshot = () => document.documentElement.classList.contains('dark')
const getServerSnapshot = () => false

export function ThemeToggle({ lang }: { lang: Lang }) {
  const dark = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
  const { nav } = getDictionary(lang)

  function toggle() {
    const next = !getSnapshot()
    try { localStorage.setItem(THEME_STORAGE_KEY, next ? 'dark' : 'light') } catch {}
    applyTheme(next)
    window.dispatchEvent(new Event(THEME_CHANGE_EVENT))
  }

  return (
    <button
      type="button"
      role="switch"
      aria-checked={dark}
      aria-label={nav.darkTheme}
      title={dark ? nav.lightTheme : nav.darkTheme}
      onClick={toggle}
      className="fixed bottom-6 left-6 z-40 grid size-11 place-items-center rounded-full border border-accent/60 bg-card text-accent-ink shadow-lg shadow-shadow/10 transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
    >
      <Moon className="size-4 dark:hidden" aria-hidden="true" />
      <Sun className="hidden size-4 dark:block" aria-hidden="true" />
    </button>
  )
}
