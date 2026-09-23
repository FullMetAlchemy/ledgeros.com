// Client-side stand-in for the ledger API. Holds the demo dataset, persists it
// to localStorage and syncs across tabs, so the MDA portal and the oversight
// console can be run side by side. Every write goes through the domain rules;
// in production these calls become API requests and the server re-checks them.

import { useSyncExternalStore } from 'react'
import { sweepDeadlines, transition } from '../domain/flagMachine'
import { isOversightRole } from '../domain/policy'
import { buildFlags, buildUsers, MDAS } from '../domain/seed'
import { createSubmission, type CreateParams, type Obligation } from '../domain/submissions/create'
import { parseAmount } from '../domain/submissions/defs'
import { transitionSubmission } from '../domain/submissions/machine'
import { VENDORS } from '../domain/submissions/reference'
import { buildSubmissions } from '../domain/submissions/seed'
import type { Submission, SubmissionContent, SubmissionEvent } from '../domain/submissions/types'
import type { Comment, Flag, FlagEvent, Mda, ResponseDraft, User } from '../domain/types'

const KEY = 'olos.portal.v1'
const DATA_VERSION = 2

export interface PortalState {
  version: number
  seededAt: string
  syncedAt: string
  users: User[]
  mdas: Mda[]
  flags: Flag[]
  submissions: Submission[]
  obligations: Obligation[]
  sessionUserId: string | null
}

export type ActionResult = { ok: true } | { ok: false; error: string }

function freshState(now = new Date()): PortalState {
  const users = buildUsers()
  const flags = buildFlags(now, users)
  const { submissions, obligations } = buildSubmissions(now, users, MDAS, flags)
  return {
    version: DATA_VERSION,
    seededAt: now.toISOString(),
    syncedAt: now.toISOString(),
    users,
    mdas: MDAS,
    flags,
    submissions,
    obligations,
    sessionUserId: null,
  }
}

// The signed-in role is per tab (sessionStorage), so two tabs can act as two
// officers on the same shared dataset.
const SESSION_KEY = 'olos.session'

function readSession(): string | null {
  try {
    return sessionStorage.getItem(SESSION_KEY)
  } catch {
    return null
  }
}

function writeSession(userId: string | null) {
  try {
    if (userId) sessionStorage.setItem(SESSION_KEY, userId)
    else sessionStorage.removeItem(SESSION_KEY)
  } catch {
    /* session lasts until reload */
  }
}

function load(): PortalState {
  const sessionUserId = readSession()
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as PortalState
      if (parsed.version === DATA_VERSION) return { ...parsed, sessionUserId }
    }
  } catch {
    // Storage blocked or corrupt: fall back to fresh demo data.
  }
  return { ...freshState(), sessionUserId }
}

function persist(s: PortalState) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...s, sessionUserId: null }))
  } catch {
    // Non-fatal: the session continues in memory.
  }
}

type Listener = () => void

function createStore() {
  let state = load()
  const listeners = new Set<Listener>()

  const emit = () => listeners.forEach((l) => l())
  const set = (next: PortalState) => {
    state = next
    persist(state)
    emit()
  }
  const replaceFlag = (flag: Flag) => ({ ...state, flags: state.flags.map((f) => (f.id === flag.id ? flag : f)) })
  const me = () => state.users.find((u) => u.id === state.sessionUserId) ?? null

  const sweep = () => {
    const changed = sweepDeadlines(state.flags, new Date(), state.users)
    const syncedAt = new Date().toISOString()
    if (!changed.length) {
      state = { ...state, syncedAt }
      emit()
      return
    }
    const byId = new Map(changed.map((f) => [f.id, f]))
    set({ ...state, syncedAt, flags: state.flags.map((f) => byId.get(f.id) ?? f) })
  }

  if (typeof window !== 'undefined') {
    window.addEventListener('storage', (e) => {
      if (e.key !== KEY || !e.newValue) return
      try {
        const next = JSON.parse(e.newValue) as PortalState
        // Keep this tab's own sign-in; share everything else.
        state = { ...next, sessionUserId: state.sessionUserId }
        emit()
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
    sweep,
    signIn(userId: string) {
      writeSession(userId)
      state = { ...state, sessionUserId: userId }
      emit()
    },
    signOut() {
      writeSession(null)
      state = { ...state, sessionUserId: null }
      emit()
    },
    reset() {
      set({ ...freshState(), sessionUserId: state.sessionUserId })
      sweep()
    },
    dispatch(flagId: string, event: FlagEvent): ActionResult {
      const user = me()
      const flag = state.flags.find((f) => f.id === flagId)
      if (!user) return { ok: false, error: 'Your session has ended. Sign in again.' }
      if (!flag) return { ok: false, error: `Flag ${flagId} not found.` }
      const r = transition(flag, event, { actor: user, now: new Date(), users: state.users })
      if (!r.ok) return r
      set(replaceFlag(r.flag))
      return { ok: true }
    },
    /** Autosave a draft. Only the owner may edit, and only while drafting. */
    saveDraft(flagId: string, patch: Partial<ResponseDraft>): ActionResult {
      const user = me()
      const flag = state.flags.find((f) => f.id === flagId)
      if (!user || !flag) return { ok: false, error: 'Not available.' }
      if (flag.state !== 'Drafting' || flag.ownerId !== user.id)
        return { ok: false, error: 'Only the assigned owner can edit this draft.' }
      const draft = { ...flag.draft, ...patch, updatedAt: new Date().toISOString(), updatedBy: user.id }
      set(replaceFlag({ ...flag, draft }))
      return { ok: true }
    },
    addComment(flagId: string, body: string): ActionResult {
      const user = me()
      const flag = state.flags.find((f) => f.id === flagId)
      if (!user || !flag) return { ok: false, error: 'Not available.' }
      const text = body.trim()
      if (!text) return { ok: false, error: 'Write a message first.' }
      const side = isOversightRole(user.role) ? 'oversight' : 'mda'
      if (side === 'mda' && user.mdaId !== flag.mdaId) return { ok: false, error: 'You can only comment on your own MDA’s flags.' }
      const comment = { id: crypto.randomUUID(), at: new Date().toISOString(), authorId: user.id, side, body: text } as const
      set(replaceFlag({ ...flag, comments: [...flag.comments, comment] }))
      return { ok: true }
    },

    // ---- Submissions -------------------------------------------------------

    /** Create a pre-filled draft. Returns its id so the caller can open it. */
    createSubmission(params: CreateParams, obligationId?: string): { ok: true; id: string } | { ok: false; error: string } {
      const user = me()
      if (!user?.mdaId) return { ok: false, error: 'Only MDA officers can create submissions.' }
      const mda = state.mdas.find((m) => m.id === user.mdaId)!
      const ob = obligationId ? state.obligations.find((o) => o.id === obligationId) : undefined
      const r = createSubmission(params, { mda, owner: user, now: new Date(), flags: state.flags, submissions: state.submissions, dueAt: ob?.dueAt })
      if (!r.ok) return r
      set({
        ...state,
        submissions: [...state.submissions, r.submission],
        obligations: ob ? state.obligations.map((o) => (o.id === ob.id ? { ...o, submissionId: r.submission.id } : o)) : state.obligations,
      })
      return { ok: true, id: r.submission.id }
    },
    /** Autosave. Only the preparer may edit, and only while in draft. */
    saveSubmission(id: string, patch: Partial<SubmissionContent> & { step?: number }): ActionResult {
      const user = me()
      const sub = state.submissions.find((s) => s.id === id)
      if (!user || !sub) return { ok: false, error: 'Not available.' }
      if (sub.state !== 'Draft' || sub.ownerId !== user.id) return { ok: false, error: 'Only the preparer can edit this draft.' }
      replaceSubmission({ ...sub, ...patch, updatedAt: new Date().toISOString(), updatedBy: user.id })
      return { ok: true }
    },
    dispatchSubmission(id: string, event: SubmissionEvent): ActionResult {
      const user = me()
      const sub = state.submissions.find((s) => s.id === id)
      if (!user) return { ok: false, error: 'Your session has ended. Sign in again.' }
      if (!sub) return { ok: false, error: `Submission ${id} not found.` }
      const r = transitionSubmission(sub, event, { actor: user, now: new Date(), users: state.users, vendors: VENDORS })
      if (!r.ok) return r
      // An approved release updates the MDA's released funds everywhere.
      const approvedRelease = event.type === 'ACCEPT' && r.submission.data.kind === 'release_request' ? parseAmount(r.submission.data.amount) : 0
      set({
        ...state,
        submissions: state.submissions.map((s) => (s.id === id ? r.submission : s)),
        mdas: approvedRelease
          ? state.mdas.map((m) => (m.id === sub.mdaId ? { ...m, released: Math.min(m.appropriated, m.released + approvedRelease) } : m))
          : state.mdas,
      })
      return { ok: true }
    },
    addSubmissionComment(id: string, body: string): ActionResult {
      const user = me()
      const sub = state.submissions.find((s) => s.id === id)
      if (!user || !sub) return { ok: false, error: 'Not available.' }
      const text = body.trim()
      if (!text) return { ok: false, error: 'Write a message first.' }
      const side = isOversightRole(user.role) ? 'oversight' : 'mda'
      if (side === 'mda' && user.mdaId !== sub.mdaId) return { ok: false, error: 'You can only comment on your own MDA’s submissions.' }
      const comment: Comment = { id: crypto.randomUUID(), at: new Date().toISOString(), authorId: user.id, side, body: text }
      replaceSubmission({ ...sub, comments: [...sub.comments, comment] })
      return { ok: true }
    },
  }

  function replaceSubmission(sub: Submission) {
    set({ ...state, submissions: state.submissions.map((s) => (s.id === sub.id ? sub : s)) })
  }
}

export const store = createStore()

export function usePortal(): PortalState {
  return useSyncExternalStore(store.subscribe, store.getState)
}

export function useMe(): User | null {
  const s = usePortal()
  return s.users.find((u) => u.id === s.sessionUserId) ?? null
}

/** Flags visible to a user: their own MDA's, or all for oversight. Always a new array. */
export function visibleFlags(s: PortalState, user: User | null): Flag[] {
  if (!user) return []
  return user.mdaId ? s.flags.filter((f) => f.mdaId === user.mdaId) : [...s.flags]
}

/** Submissions visible to a user: their MDA's; Treasury sees release requests; the auditor sees all. */
export function visibleSubmissions(s: PortalState, user: User | null): Submission[] {
  if (!user) return []
  if (user.mdaId) return s.submissions.filter((x) => x.mdaId === user.mdaId)
  if (user.role === 'treasury') return s.submissions.filter((x) => x.kind === 'release_request')
  return [...s.submissions]
}

export function userName(s: PortalState, id: string | null | undefined): string {
  if (!id) return 'Unassigned'
  if (id === 'system') return 'System'
  return s.users.find((u) => u.id === id)?.name ?? id
}
