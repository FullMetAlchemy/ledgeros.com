import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { store, usePortal } from '../state/store'
import { Button } from '../ui/Button'
import { Dialog } from '../ui/Dialog'

const CHECK_EVERY_MS = 10_000
const ACTIVITY = ['pointerdown', 'keydown', 'wheel', 'touchstart'] as const

/** Inactivity timeout with a one-minute warning (FR-AUTH-003). */
export function SessionWatcher() {
  const { ds } = usePortal()
  const navigate = useNavigate()
  const [warn, setWarn] = useState(false)

  useEffect(() => {
    let last = 0
    const onActivity = () => {
      // Throttle writes to session storage.
      if (Date.now() - last < 5_000) return
      last = Date.now()
      store.touch()
    }
    ACTIVITY.forEach((e) => window.addEventListener(e, onActivity, { passive: true }))
    const tick = () => {
      const s = store.checkSession()
      if (s === 'expired' || s === 'none') navigate('/login', { replace: true })
      setWarn(s === 'warn')
    }
    const t = window.setInterval(tick, CHECK_EVERY_MS)
    return () => {
      ACTIVITY.forEach((e) => window.removeEventListener(e, onActivity))
      window.clearInterval(t)
    }
  }, [navigate])

  if (!warn) return null
  return (
    <Dialog
      open
      onClose={() => {
        store.touch()
        setWarn(false)
      }}
      eyebrow="Session"
      title="You’ll be signed out soon"
      footer={
        <>
          <Button
            onClick={() => {
              store.logout()
              navigate('/login')
            }}
          >
            Sign out now
          </Button>
          <Button
            variant="primary"
            onClick={() => {
              store.touch()
              setWarn(false)
            }}
          >
            Stay signed in
          </Button>
        </>
      }
    >
      <p className="text-[13.5px] text-ink-2">
        For security, sessions end after {ds.securityConfig.sessionTimeoutMin} minutes without activity. You have less than a minute left.
      </p>
    </Dialog>
  )
}
