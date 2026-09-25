// Client-side stand-in for the platform API. Holds the prototype dataset
// (persisted to localStorage, synced across tabs) and a per-tab session
// (sessionStorage). Every write goes through the service layer, which applies
// the domain rules and appends audit events; in production these calls become
// API requests and the server re-checks every rule.

import { useSyncExternalStore } from 'react'
import { login as domainLogin, newMfaCode } from '../domain/access'
import type { Dataset } from '../domain/dataset'
import { can, inScope, type Permission } from '../domain/roles'
import { monthOf, periodId, type PeriodScope } from '../domain/periods'
import { buildDataset } from '../domain/seed'
import { svcLogin, svcLoginFailed, svcSessionEnd, type Svc } from '../domain/services'
import type { User } from '../domain/types'

const DATA_KEY = 'olos.dataset'
const DATA_VERSION = 3
const SESSION_KEY = 'olos.session'
const SCOPE_KEY = 'olos.scope'

export interface Session {
  userId: string
  mfaVerified: boolean
  startedAt: string
  lastActivity: number
}

export interface MfaChallenge {
  userId: string
  code: string
  issuedAt: number
  attempts: number
}

export interface PortalState {
  ds: Dataset
  session: Session | null
  challenge: MfaChallenge | null
  scope: PeriodScope
  /** Set when the last session ended by timeout, to explain it on the login page. */
  expired: boolean
}

export type ActionResult<T = undefined> = { ok: true; value: T; message?: string } | { ok: false; error: string }

function read<T>(storage: 'local' | 'session', k: string): T | null {
  try {
    const raw = (storage === 'local' ? localStorage : sessionStorage).getItem(k)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

function write(storage: 'local' | 'session', k: string, v: unknown) {
  try {
    const s = storage === 'local' ? localStorage : sessionStorage
    if (v === null) s.removeItem(k)
    else s.setItem(k, JSON.stringify(v))
  } catch {
    /* storage blocked: state lives in memory for this tab */
  }
}

function loadDataset(): Dataset {
  const saved = read<{ version: number; ds: Dataset }>('local', DATA_KEY)
  if (saved?.version === DATA_VERSION) return saved.ds
  return buildDataset()
}

/** Default scope: year to date, ending at the current month (capped to FY2026). */
export function defaultScope(now = new Date()): PeriodScope {
  const m = now.getFullYear() > 2026 ? 12 : now.getFullYear() < 2026 ? 1 : now.getMonth() + 1
  return { mode: 'ytd', periodId: periodId(m) }
}

type Listener = () => void

function createStore() {
  let state: PortalState = {
    ds: loadDataset(),
    session: read<Session>('session', SESSION_KEY),
    challenge: null,
    scope: read<PeriodScope>('session', SCOPE_KEY) ?? defaultScope(),
    expired: false,
  }
  const listeners = new Set<Listener>()
  const emit = () => listeners.forEach((l) => l())
  const setDs = (ds: Dataset) => {
    state = { ...state, ds }
    write('local', DATA_KEY, { version: DATA_VERSION, ds })
    emit()
  }
  const setSession = (session: Session | null) => {
    state = { ...state, session }
    write('session', SESSION_KEY, session)
    emit()
  }
  const me = (): User | null => {
    const s = state.session
    if (!s || !s.mfaVerified) return null
    const u = state.ds.users.find((x) => x.id === s.userId)
    return u && u.status === 'Active' ? u : null
  }

  if (typeof window !== 'undefined') {
    window.addEventListener('storage', (e) => {
      if (e.key !== DATA_KEY || !e.newValue) return
      try {
        const next = JSON.parse(e.newValue) as { version: number; ds: Dataset }
        if (next.version === DATA_VERSION) {
          state = { ...state, ds: next.ds }
          emit()
        }
      } catch {
        /* ignore malformed updates */
      }
    })
  }

  return {
    getState: () => state,
    subscribe(l: Listener) {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    me,

    // ---- Authentication (FR-AUTH-001..005) --------------------------------------
    login(email: string, password: string): ActionResult<{ mfaRequired: boolean }> {
      const now = new Date()
      const r = domainLogin(state.ds, email, password)
      if (!r.ok) {
        setDs(svcLoginFailed(state.ds, email, now))
        return r
      }
      const { user, mfaRequired } = r.value
      setDs(svcLogin(state.ds, user, now, 'LOGIN'))
      state = { ...state, expired: false }
      if (mfaRequired) {
        state = { ...state, challenge: { userId: user.id, code: newMfaCode(), issuedAt: Date.now(), attempts: 0 } }
        emit()
      } else {
        setDs(svcLogin(state.ds, user, now, 'MFA_VERIFIED'))
        setSession({ userId: user.id, mfaVerified: true, startedAt: now.toISOString(), lastActivity: Date.now() })
      }
      return { ok: true, value: { mfaRequired } }
    },
    resendMfa() {
      if (!state.challenge) return
      state = { ...state, challenge: { ...state.challenge, code: newMfaCode(), issuedAt: Date.now(), attempts: 0 } }
      emit()
    },
    verifyMfa(code: string): ActionResult {
      const c = state.challenge
      if (!c) return { ok: false, error: 'Your sign-in expired. Start again.' }
      if (Date.now() - c.issuedAt > 5 * 60_000) {
        state = { ...state, challenge: null }
        emit()
        return { ok: false, error: 'The code expired. Sign in again.' }
      }
      if (code.trim() !== c.code) {
        const attempts = c.attempts + 1
        if (attempts >= 5) {
          state = { ...state, challenge: null }
          emit()
          return { ok: false, error: 'Too many incorrect codes. Sign in again.' }
        }
        state = { ...state, challenge: { ...c, attempts } }
        emit()
        return { ok: false, error: `That code is incorrect. ${5 - attempts} attempt${5 - attempts === 1 ? '' : 's'} left.` }
      }
      const user = state.ds.users.find((u) => u.id === c.userId)!
      const now = new Date()
      setDs(svcLogin(state.ds, user, now, 'MFA_VERIFIED'))
      state = { ...state, challenge: null }
      setSession({ userId: user.id, mfaVerified: true, startedAt: now.toISOString(), lastActivity: Date.now() })
      return { ok: true, value: undefined }
    },
    cancelMfa() {
      state = { ...state, challenge: null }
      emit()
    },
    logout(expired = false) {
      const u = me()
      if (u) setDs(svcSessionEnd(state.ds, u, new Date(), expired))
      state = { ...state, expired }
      setSession(null)
    },
    /** Record activity for the inactivity timeout (FR-AUTH-003). */
    touch() {
      if (!state.session) return
      state = { ...state, session: { ...state.session, lastActivity: Date.now() } }
      write('session', SESSION_KEY, state.session)
    },
    /** Revalidate the session: expire on inactivity, end it if the account was disabled. */
    checkSession(): 'ok' | 'warn' | 'expired' | 'none' {
      const s = state.session
      if (!s) return 'none'
      const u = state.ds.users.find((x) => x.id === s.userId)
      if (!u || u.status !== 'Active') {
        this.logout(false)
        return 'expired'
      }
      const limit = state.ds.securityConfig.sessionTimeoutMin * 60_000
      const idle = Date.now() - s.lastActivity
      if (idle >= limit) {
        this.logout(true)
        return 'expired'
      }
      return idle >= limit - 60_000 ? 'warn' : 'ok'
    },

    // ---- Period scope (FR-DASH-007) -------------------------------------------------
    setScope(scope: PeriodScope) {
      state = { ...state, scope }
      write('session', SCOPE_KEY, scope)
      emit()
    },

    // ---- Generic action runner -----------------------------------------------------------
    run<T>(fn: (ds: Dataset, me: User, now: Date) => Svc<T> | { ok: false; error: string }): ActionResult<T> {
      const u = me()
      if (!u) return { ok: false, error: 'Your session has ended. Sign in again.' }
      this.touch()
      const r = fn(state.ds, u, new Date())
      if (!r.ok) return r
      setDs(r.ds)
      return { ok: true, value: r.value, message: r.message }
    },
    /** Append-only side effects that are not actions (exports). */
    record(fn: (ds: Dataset, me: User, now: Date) => Dataset) {
      const u = me()
      if (!u) return
      setDs(fn(state.ds, u, new Date()))
    },
    reset() {
      const ds = buildDataset()
      write('local', DATA_KEY, { version: DATA_VERSION, ds })
      state = { ...state, ds }
      emit()
    },
  }
}

export const store = createStore()

export function usePortal(): PortalState {
  return useSyncExternalStore(store.subscribe, store.getState)
}

export function useDs(): Dataset {
  return usePortal().ds
}

export function useMe(): User | null {
  usePortal()
  return store.me()
}

export function useScope(): PeriodScope {
  return usePortal().scope
}

export const useCan = (p: Permission) => can(useMe(), p)

/** MDAs the user may see (BR-010). */
export function scopedMdaIds(ds: Dataset, user: User | null): string[] {
  return ds.mdas.filter((m) => inScope(user, m.id)).map((m) => m.id)
}

export function userName(ds: Dataset, id: string | null | undefined): string {
  if (!id) return '—'
  if (id === 'system') return 'System'
  return ds.users.find((u) => u.id === id)?.name ?? id
}

export const scopeMonth = (scope: PeriodScope) => monthOf(scope.periodId)
