# Oversight Ledger OS: portal prototype

A front-end prototype of Oversight Ledger OS for a **State Ministry of Budget and Economic Planning**, built to the FRD and PRD (`Oversight_Ledger_OS_FRD.md`, `Oversight_Ledger_OS_PRD.md`). It covers the state control tower, MDA workspaces, monthly expenditure returns, the anomaly engine and compliance centre, reconciliation, the audit ledger, reports and administration.

> **Prototype.** Every figure is demonstration data. There is no backend: the ledger lives in the browser, and sign-in/MFA, GIFMIS and TSA are mock adapters. Each is labelled in the UI.

Stack: Vite · React 19 · TypeScript · Tailwind CSS v4 · react-router · recharts · lucide · Vitest.

## Run

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # domain tests (vitest)
npm run lint       # oxlint
npm run build      # typecheck + production build
```

## Sign in

Every account uses the password **`Demo#2026`**. The sign-in page lists them all. Executives, oversight officers, MDA supervisors, auditors and administrators also need MFA; the code appears in a simulated authenticator. Sessions time out after 15 minutes of inactivity, with a warning one minute before. U-012 is *Pending* and U-022 is *Suspended*, so neither can sign in. **Reset demo data** on the sign-in page restores the seed.

| Role (FRD §3) | Demo account | Lands on |
| --- | --- | --- |
| Ministry Executive | Dr. Kemi Adebayo | Control tower |
| Ministry Oversight Officer | Tunde Bakare, Maryam Sule | Control tower |
| MDA Finance Officer | Chinedu Eze (MWI), Ngozi Adeleke (MOH) | MDA home |
| MDA Supervisor | Halima Yusuf (MWI), Ibrahim Sani (MOH) | MDA home |
| Auditor / Reviewer (read-only) | Adaeze Okonkwo | Control tower |
| System Administrator | Tunde Adeyemi | Administration |

Sessions are per tab and data is shared across tabs, so you can open two tabs as two people and watch a record move.

## Scenario (FY2026, as at September)

- **Ministry of Works and Infrastructure:** ₦612B appropriation, 97.8% utilized, *High Risk* with three active flags: Velocity (High), Milestone mismatch (High) and a Potential duplication (Medium) for two ₦312M payments to Geotech Survey Limited. Its August TSA reconciliation shows a variance: PV-3852 is missing from the statement and there is a bank charge.
- **Ministry of Health:** ₦15B allocation against ₦38B utilized, giving a *Critical* overspend flag that is assigned and overdue.
- The other six MDAs have returns at every stage: accepted, under review, returned, submitted and draft.

## Walkthroughs

1. **Executive (Kemi Adebayo):** Control tower. Change the period (month / QTD / YTD), drill into an MDA and open a flag's evidence.
2. **MDA officer (Chinedu Eze):** *Start September 2026 return* → **Import from GIFMIS (mock)** or **Import CSV** (template provided) → attach the TSA statement → submit. The anomaly rules run on submission and the preview shows what will be flagged.
3. **MDA supervisor (Halima Yusuf):** approve the return; assign and approve flag responses.
4. **Oversight (Tunde Bakare):** accept or return the return; open detected flags; review MDA responses (resolve, reject, return or escalate); close flags. In *Reconciliation*, run matching against the mock TSA statement, explain unmatched lines and mark it reviewed.
5. **Auditor (Adaeze Okonkwo):** read-only view of everything, plus the *Audit ledger*: filter events, see before and after values, and **Verify chain**.
6. **Administrator (Tunde Adeyemi):** users (create → Pending, activate, suspend, disable, change role or MDA scope), the role matrix, anomaly thresholds, security, financial periods, MDA master data and integration status. Every change needs a reason and is audited.

## Workflows (FRD §8)

- **Return:** Draft → Submitted → Under Review → Returned / Accepted → Closed. Corrections create a new version linked to the original.
- **Flag:** Detected → Open → Assigned → MDA Response → Under Review → Resolved / Rejected / Escalated → Closed.
- **Reconciliation:** Open → In Progress → Matched / Variance → Reviewed → Closed.
- **User:** Pending → Active → Suspended / Disabled.

## Layout

```
src/
  domain/          Pure TypeScript, no React. The rules every screen and action obey.
    types.ts         Entities (FRD §4)
    roles.ts         Six roles, permission matrix, data scope (BR-009/010)
    periods.ts       FY2026 monthly periods; month / QTD / YTD scopes
    metrics.ts       Release, utilization and variance calculations; risk rating
    rules.ts         Anomaly engine: overspend, velocity, milestone, duplication (+ dedupe, BR-006)
    returns.ts       Return validation, CSV import, state machine, versions
    flags.ts         Flag state machine, response rules, overdue escalation
    reconciliation.ts TSA and vendor matching, variance, review
    access.ts        Prototype auth, users, thresholds, security, periods, MDA master data
    audit.ts         Append-only event log with chained checksums
    services.ts      Actions: domain rule + audit event + rule runs, in one step
    work.ts          "Needs you" per role
    seed/            Reference data and the scenario, replayed through the services
  state/store.ts     Client stand-in for the API (localStorage ledger, per-tab session, cross-tab sync)
  ui/ workflow/      Primitives and workflow shells
  features/          dashboard, mdas, home, returns, flags, reconciliation, audit, reports, admin, profile, design
  app/               Shell, sign-in, guards, routing, theme
```

## Not real yet

- **Backend:** everything in `domain/` must also run server-side. The browser store is not tamper-proof: the audit checksum (FNV-1a) demonstrates chaining and is not cryptographic.
- **Integrations:** the GIFMIS and TSA adapters return fixed sample data with simulated latency. OCDS is not connected. Sign-in and MFA stand in for the government identity provider.
- **Evidence files:** only metadata and a fingerprint are kept, not the file contents.
- **Thresholds, SLAs and the variance sign convention** are drafts pending stakeholder approval (FRD §10). Working days count weekends only; public holidays are not modelled.
