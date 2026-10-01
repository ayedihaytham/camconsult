import { useEffect, useState } from 'react'

/** Lun.–Sam. 8h–17h, heure de Tunis — calculé côté client pour rester exact
 * quel que soit le fuseau du visiteur ; `null` tant que non encore calculé
 * (évite un écart entre le rendu statique et l'heure réelle). Partagé entre
 * le footer et la section contact de l'accueil. */
export function useOpenNow() {
  const [open, setOpen] = useState<boolean | null>(null)
  useEffect(() => {
    function compute() {
      const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Africa/Tunis',
        hour: '2-digit',
        hour12: false,
        weekday: 'short',
      }).formatToParts(new Date())
      const weekday = parts.find((p) => p.type === 'weekday')?.value ?? ''
      const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? '0')
      setOpen(weekday !== 'Sun' && hour >= 8 && hour < 17)
    }
    compute()
    const id = window.setInterval(compute, 60_000)
    return () => window.clearInterval(id)
  }, [])
  return open
}
