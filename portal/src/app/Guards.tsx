import type { ReactElement } from 'react'
import { Navigate } from 'react-router'
import { useMe } from '../state/store'
import { homeFor } from './routes'
import { SignIn } from './SignIn'

export function Landing() {
  const me = useMe()
  return me ? <Navigate to={homeFor(me)} replace /> : <SignIn />
}

/** Keeps each console to its own users. */
export function Only({ side, children }: { side: 'mda' | 'oversight'; children: ReactElement }) {
  const me = useMe()
  if (!me) return null
  const isOversight = !me.mdaId
  if ((side === 'oversight') !== isOversight) return <Navigate to={homeFor(me)} replace />
  return children
}
