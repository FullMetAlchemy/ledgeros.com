import { Moon, Sun } from 'lucide-react'
import { useTheme } from './theme'

/** Toggles the `dark` class on <html>; shows the theme you will switch to. */
export function ThemeToggle() {
  const [theme, toggle] = useTheme()
  const dark = theme === 'dark'
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={dark ? 'Switch to light mode' : 'Switch to dark mode'}
      className="grid h-9 w-9 cursor-pointer place-items-center rounded-md border border-line bg-surface text-muted transition-colors duration-200 hover:bg-sunk hover:text-ink"
    >
      {dark ? <Sun size={17} aria-hidden /> : <Moon size={17} aria-hidden />}
    </button>
  )
}
