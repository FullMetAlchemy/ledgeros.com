import { useCallback, useEffect, useState } from 'react'

export type Theme = 'light' | 'dark'
const KEY = 'olos.theme'

function initial(): Theme {
  if (typeof document !== 'undefined' && document.documentElement.classList.contains('dark')) return 'dark'
  try {
    const saved = localStorage.getItem(KEY)
    if (saved === 'light' || saved === 'dark') return saved
  } catch {
    /* fall through to the OS setting */
  }
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

/** Light/dark via the `dark` class on <html>. Starts from the saved choice or the OS setting. */
export function useTheme(): [Theme, () => void] {
  const [theme, setTheme] = useState<Theme>(initial)

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
  }, [theme])

  const toggle = useCallback(() => {
    const root = document.documentElement
    // Ease every surface between palettes for the length of the switch only,
    // so ordinary hovers stay instant.
    root.classList.add('theme-switching')
    window.setTimeout(() => root.classList.remove('theme-switching'), 250)
    setTheme((t) => {
      const next = t === 'dark' ? 'light' : 'dark'
      try {
        localStorage.setItem(KEY, next)
      } catch {
        /* preference just won't persist */
      }
      return next
    })
  }, [])

  return [theme, toggle]
}
