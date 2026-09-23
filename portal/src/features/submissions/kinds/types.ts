import type { FC } from 'react'
import type { Submission, SubmissionContent, SubmissionData } from '../../../domain/submissions/types'
import type { EvidenceFile, User } from '../../../domain/types'

export interface DetailsProps<D extends SubmissionData> {
  sub: Submission
  data: D
  me: User
  update: (patch: Partial<D>) => void
  /** Blocking message for a field, once the preparer has reached the checks step. */
  error: (field: string) => string | undefined
}

export interface ViewProps<D extends SubmissionData> {
  sub: Submission
  data: D
  content: SubmissionContent
}

export interface EvidenceProps<D extends SubmissionData> {
  sub: Submission
  data: D
  me: User
  evidence: EvidenceFile[]
  addFiles: (files: EvidenceFile[]) => void
  detach: (id: string) => void
}

export interface KindModule<D extends SubmissionData> {
  /** Read-only, pre-filled context (step 1 and top of the read-only view). */
  Scope: FC<ViewProps<D>>
  Details: FC<DetailsProps<D>>
  /** Read-only rendering of the MDA's answers. */
  View: FC<ViewProps<D>>
  /** Optional custom evidence step; defaults to one slot per evidenceSlots() entry. */
  Evidence?: FC<EvidenceProps<D>>
}
