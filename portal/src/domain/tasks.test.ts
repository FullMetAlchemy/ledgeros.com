import { describe, expect, it } from 'vitest'
import { buildFlags, buildUsers } from './seed'
import { taskFor, tasksFor } from './tasks'

const now = new Date()
const users = buildUsers()
const flags = buildFlags(now, users)
const u = (id: string) => users.find((x) => x.id === id)!
const byId = (id: string) => flags.find((f) => f.id === id)!

describe('tasks', () => {
  it('asks the DFA to acknowledge a fresh Critical flag, not the Finance Officer', () => {
    expect(taskFor(byId('FLG-0231-009'), u('u-fmw-dfa'))?.kind).toBe('acknowledge')
    expect(taskFor(byId('FLG-0231-009'), u('u-fmw-fo'))).toBeNull()
  })

  it('gives the owner their draft', () => {
    expect(taskFor(byId('FLG-0231-008'), u('u-fmw-fo'))?.kind).toBe('draft')
  })

  it('gives the FMAFS DFA the review step and nobody else', () => {
    const f = byId('FLG-0344-003')
    expect(taskFor(f, u('u-fmafs-dfa'))?.action).toBe('Review')
    expect(taskFor(f, u('u-fmafs-ia'))).toBeNull()
    expect(taskFor(f, u('u-fmafs-fo'))).toBeNull()
  })

  it('never shows another MDA’s flags', () => {
    expect(tasksFor(flags, u('u-fmh-dfa')).every((t) => t.flag.mdaId === 'FMH')).toBe(true)
  })

  it('gives oversight the responses awaiting review', () => {
    const ids = tasksFor(flags, u('u-auditor')).map((t) => t.flag.id).sort()
    expect(ids).toEqual(['FLG-0231-006', 'FLG-0517-012'])
  })
})
