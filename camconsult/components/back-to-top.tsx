'use client'

import { useEffect, useState } from 'react'
import { ArrowUp } from 'lucide-react'
import { cn } from '@/lib/utils'

export function BackToTop({ label = 'Haut de page' }: { label?: string }) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 480)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <button
      type="button"
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      aria-label={label}
      title={label}
      className={cn(
        'fixed bottom-6 right-6 z-40 grid size-11 place-items-center rounded-full border border-accent/60 bg-feature text-accent-ink shadow-lg shadow-shadow/20 transition-all duration-300 hover:bg-accent hover:text-accent-foreground',
        visible ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-3 opacity-0',
      )}
    >
      <ArrowUp className="size-4" aria-hidden="true" />
    </button>
  )
}
