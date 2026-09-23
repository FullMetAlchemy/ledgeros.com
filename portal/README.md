# MDA Compliance Portal

The MDA-facing portal for Oversight Ledger OS, plus the matching oversight and Treasury consoles. Built so far:

- **Flag resolution (Journey A):** a Critical flag moves from *Raised* to *Resolved* through the MDA's four-step sign-off chain and oversight review.
- **Submissions:** six structured submission types, pre-filled from the ledger, checked before submission, signed off by the chain and decided by the Chief Auditor or Treasury.

Stack: Vite · React 19 · TypeScript · Tailwind CSS v4 · react-router · Vitest.

## Run

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # domain tests (vitest)
npm run lint       # oxlint
npm run build      # typecheck + production build
```

Demo sign-in lets you pick any role for the Federal Ministry of Works (FMW) or Federal Ministry of Health (FMH), the Chief Auditor, or the Treasury Officer. Sessions are per tab and data is shared across tabs, so open two tabs as two officers to watch something move. **Reset demo data** on the sign-in screen restores the seed.

### Walk Journey A: a Critical flag

1. **FMW · DFA (Halima Yusuf):** open the Critical *Velocity flag* (FLG-0231-009), acknowledge it, then assign Chinedu Eze.
2. **FMW · Finance Officer (Chinedu Eze):** draft the response in the five-step wizard. Answering "No" to "planned?" triggers a required written justification. Attach evidence; files are SHA-256 fingerprinted in the browser.
3. **DFA** approves the review, **Head of Internal Audit (Emeka Nwosu)** checks it (or returns it with a comment), then the **Accounting Officer (Olumide Bakare)** attests with a typed declaration and a security key (simulated).
4. **Chief Auditor (Adaeze Okonkwo):** from *Flag review*, accept the response, request more information, or reject it (which escalates).

### Walk Submissions

1. **FMW · Finance Officer:** *Submissions* → open the August return (RET-0231-2608). Confirm or query each GIFMIS posting, enter the TSA balance, then drop a folder of voucher packs; files are matched to postings by the voucher number in the filename. *Checks* flags possible **threshold splitting** on PV-3912/PV-3913 (the Anomaly Engine's rule, run before submission) and any TSA difference; both need a written justification.
2. The return goes DFA → Internal Audit → Accounting Officer (attests) → **Chief Auditor**, who accepts or raises a query.
3. **Treasury Officer (Fatima Bello):** *Release requests* lists the five prototype warrant requests, each with the MDA's **live** rating and open flags. Approving one updates that MDA's released funds everywhere.
4. From the **advances register** (or an unretired-advance flag), retire an advance; the totals must balance to the advance.

## Submission types

| Type | Pre-filled from | Chain | Decided by |
| --- | --- | --- | --- |
| Monthly expenditure return | GIFMIS postings, TSA ledger balance | Prepare → Review → Check → Attest | Chief Auditor |
| Advance retirement | Advances register | Prepare → Review → Check (attests) | Chief Auditor |
| Milestone / delivery certificate | Contracts register, vouchers paid | Prepare → Review → Check (attests) | Chief Auditor |
| Release (warrant) request | Appropriation, releases, open flags | Prepare (DFA) → Attest | Treasury |
| Quarterly budget performance | Figures by category | Prepare → Review → Attest | Chief Auditor |
| Vendor exception | Vendor registry (for duplicate-TIN check) | Prepare → Review (attests) | Chief Auditor |

Pre-flight checks run on the draft and use the same thresholds as the Anomaly Engine: threshold splitting (2% under ₦250M within 2 days), payment before certification, 90-day retirement window, low absorption (<65%) and open Critical/High flags on release requests, and duplicate TINs.

## Layout

```
src/
  domain/      Pure TypeScript, no React. Shared by all consoles.
    types.ts          Flag, ResponseDraft, Attestation, FlagEvent…
    chain.ts          Sign-off chain rules shared by flags and submissions (roles, SoD, attestation)
    flagMachine.ts    Flag case lifecycle + deadline sweep
    policy.ts         SLA per severity, chain per severity, roles per step
    validation.ts     Three-tier checks for flag responses
    templates.ts      Structured response template per flag type
    rating.ts         High Risk / Warning / Clear + "path to Clear"
    tasks.ts          "Needs you" for flags
    calendar.ts       Working-day deadline arithmetic
    seed.ts           Prototype MDAs/flags; seeded via the state machine itself
    submissions/
      types.ts        Submission record and per-kind data
      defs.ts         Per-kind chain, preparers, reviewer, evidence slots
      machine.ts      Draft → InChain → UnderReview → Accepted / Queried
      validation.ts   Per-kind three-tier checks and pre-flight rules
      create.ts       Pre-filled creation, statutory obligations, advances status
      reference.ts    Ledger reference data (postings, advances, contracts, vendors)
      seed.ts         Demo submissions, replayed through the machine
      tasks.ts        "Needs you" for submissions
  state/store.ts      Client-side stand-in for the ledger API (localStorage, cross-tab sync)
  ui/                 Primitives: StatusPill, SeverityTag, DueChip, Button, Field, Dialog, Facts, Toasts…
  workflow/           Shells: Wizard, SignOffRail, AttestationDialog, EvidenceSlot, CaseThread, StatusHistory, CaseBits
  features/
    flags/            Flag list, case page, response composer
    submissions/      Hub, submission page, generic composer, kinds/ (one file per submission type)
    oversight/        Flag review, submissions review, Treasury release queue
    home/ tasks/ design/
  app/                Shell, sign-in, routing, theme
```

### Theme

The **Soft Enterprise Palette** lives in `src/index.css` as semantic tokens mapped to Tailwind steps: slate-50/white/slate-800/slate-500/slate-200 with indigo-600 primary, rose-600 flags and emerald-600 success in light mode; slate-900/slate-800/slate-200/slate-400/slate-700 with indigo-500, rose-400 and emerald-400 in dark mode. Dark mode is class-based (`dark` on `<html>`, via `@custom-variant dark` — Tailwind v4's equivalent of `darkMode: 'class'`), starts from the OS setting, and is toggled by the sun/moon button in the header. Surfaces ease between palettes over 200 ms. Chart series colours are validated for colour-blind separation and contrast in both modes. `/design` renders every primitive in the current theme.

## Rules the code enforces

- **Separation of duties:** nobody acts at two steps of the same record, and a preparer can never attest their own work.
- **Chains:** flags by severity (Critical/High: 4 steps; Medium/Low: Prepare → DFA/AO attests); submissions by type (table above). The final step always attests.
- **Attestation** needs the declaration, a typed name match and a verified key.
- **Submitted content is a snapshot**; a return, query or info request starts a new cycle pre-filled from the last submission.
- **Deadlines:** flags auto-escalate once per reason (unacknowledged, overdue draft); submissions show overdue while with the MDA.
- **One extension per flag case**, up to 30 days.
- **Release approvals** update the MDA's released funds, which every screen reads.

## Not yet real (demo stand-ins)

- **Backend/API:** `state/store.ts` holds data in the browser. Every guard in `domain/` must also run server-side.
- **Security key:** simulated. Production uses WebAuthn with keys registered at onboarding.
- **Evidence storage:** only file metadata and SHA-256 are kept; file bytes aren't stored.
- **Reference data:** postings, advances, contracts and vendors are static demo data for FMW and FMH; economic codes are illustrative.
- **Working days:** weekends only; public holidays aren't modelled.
- **Not built yet:** medium-severity internal-audit sampling; accepted retirements don't auto-resolve their linked flag (the officer quotes the retirement ID in a "Correct" response); Funds, Evidence vault, Calendar and Organisation modules (shown as *Soon* in the nav).
- **SLA values and thresholds** are the spec's proposals and still need policy sign-off.
