import type { SubmissionData, SubmissionKind } from '../../../domain/submissions/types'
import { MilestoneDetails, MilestoneScope, MilestoneView } from './MilestoneForms'
import { QuarterlyDetails, QuarterlyScope, QuarterlyView } from './QuarterlyForms'
import { ReleaseDetails, ReleaseScope, ReleaseView } from './ReleaseForms'
import { RetirementDetails, RetirementScope, RetirementView } from './RetirementForms'
import { ReturnDetails, ReturnEvidence, ReturnScope, ReturnView } from './ReturnForms'
import type { KindModule } from './types'
import { VendorDetails, VendorScope, VendorView } from './VendorForms'

// Each module is typed to its own data; the registry is indexed by kind and the
// data passed in always matches (sub.data.kind === sub.kind).
export const KIND_MODULES = {
  monthly_return: { Scope: ReturnScope, Details: ReturnDetails, View: ReturnView, Evidence: ReturnEvidence },
  advance_retirement: { Scope: RetirementScope, Details: RetirementDetails, View: RetirementView },
  milestone_certificate: { Scope: MilestoneScope, Details: MilestoneDetails, View: MilestoneView },
  release_request: { Scope: ReleaseScope, Details: ReleaseDetails, View: ReleaseView },
  quarterly_performance: { Scope: QuarterlyScope, Details: QuarterlyDetails, View: QuarterlyView },
  vendor_exception: { Scope: VendorScope, Details: VendorDetails, View: VendorView },
} as unknown as Record<SubmissionKind, KindModule<SubmissionData>>
