import type { User } from '../domain/types'

export function homeFor(user: User): string {
  if (user.role === 'auditor') return '/oversight/queue'
  if (user.role === 'treasury') return '/oversight/releases'
  return '/home'
}
