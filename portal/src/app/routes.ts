import type { User } from '../domain/types'

/** Each role's landing page. */
export function homeFor(user: User): string {
  switch (user.role) {
    case 'executive':
    case 'oversight':
    case 'auditor':
      return '/dashboard'
    case 'mda_officer':
    case 'mda_supervisor':
      return '/home'
    case 'admin':
      return '/admin'
  }
}
