'use client'

import { useState } from 'react'

/** Inscription aux rappels / analyses : même comportement que l'ancien site (confirmation locale). */
export function NewsletterForm({ placeholder, cta, success, inputClass }: { placeholder: string; cta: string; success: string; inputClass?: string }) {
  const [done, setDone] = useState(false)
  if (done) return <p role="status" style={{ fontWeight: 600 }}>{success}</p>
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        setDone(true)
      }}
    >
      <input type="email" required placeholder={placeholder} aria-label={placeholder} className={inputClass} dir="ltr" />
      <button type="submit" className="go">{cta}</button>
    </form>
  )
}
