import { Lock } from 'lucide-react'
import type { ReactElement } from 'react'
import { Link, Navigate } from 'react-router'
import { can, ROLE_LABEL, type Permission } from '../domain/roles'
import { useMe } from '../state/store'
import { EmptyState } from '../ui/Panel'
import { homeFor } from './routes'

export function Landing() {
  const me = useMe()
  return <Navigate to={me ? homeFor(me) : '/login'} replace />
}

/** Blocks a page the role may not use and explains why (FRD §15, unauthorized action). */
export function Require({ permission, children }: { permission: Permission; children: ReactElement }) {
  const me = useMe()
  if (!me) return null
  if (!can(me, permission))
    return (
      <EmptyState
        title="You don’t have access to this page"
        body={`${ROLE_LABEL[me.role]} accounts can’t open it. If you need access, ask your System Administrator to review your role.`}
        action={
          <Link to={homeFor(me)} className="inline-flex h-9 items-center gap-2 rounded-md border border-line-2 bg-surface px-4 text-[13px] font-semibold hover:bg-sunk">
            <Lock size={14} aria-hidden /> Back to my home page
          </Link>
        }
      />
    )
  return children
}
