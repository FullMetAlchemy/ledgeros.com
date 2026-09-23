// Three-tier checks for submissions (blocking / needs justification / advisory),
// including the Anomaly Engine's rules run as pre-flight checks so problems are
// explained before submission instead of flagged after it.

import { naira } from '../money'
import { MIN_JUSTIFICATION, type Issue } from '../validation'
import { evidenceSlots, parseAmount } from './defs'
import type { SubmissionContent, Vendor } from './types'

export const APPROVAL_LIMIT = 250_000_000
export const SPLIT_MARGIN = 0.02
export const SPLIT_WINDOW_DAYS = 2
export const RETIREMENT_WINDOW_DAYS = 90
export const LOW_ABSORPTION = 0.65
export const QUARTER_COMMENT_BELOW = 0.75
const MIN_TEXT = 40

export interface CheckContext {
  now: Date
  vendors: Vendor[]
}

const DAY = 86_400_000
const days = (a: string, b: string | Date) => Math.round((new Date(b).getTime() - new Date(a).getTime()) / DAY)
const tooShort = (s: string, n = MIN_TEXT) => s.trim().length < n

export function validateSubmission(content: SubmissionContent, ctx: CheckContext): Issue[] {
  const { data, evidence, justifications } = content
  const issues: Issue[] = []
  const block = (id: string, step: number, field: string, message: string) => issues.push({ id, tier: 'blocking', step, field, message })
  const justify = (id: string, message: string) =>
    issues.push({ id, tier: 'justification', step: 3, field: `justification:${id}`, message, satisfied: (justifications[id] ?? '').trim().length >= MIN_JUSTIFICATION })
  const advise = (id: string, step: number, field: string, message: string) => issues.push({ id, tier: 'advisory', step, field, message })

  switch (data.kind) {
    case 'monthly_return': {
      const pending = data.lines.filter((l) => l.status === 'pending')
      if (pending.length) block('lines-pending', 1, 'lines', `${pending.length} of ${data.lines.length} postings still need to be confirmed or queried.`)
      for (const l of data.lines.filter((x) => x.status === 'queried' && tooShort(x.note, 20)))
        block(`note:${l.ref}`, 1, `line:${l.ref}`, `Explain the query on ${l.ref} (at least 20 characters).`)
      const tsa = parseAmount(data.tsaStatementBalance)
      if (!data.tsaStatementBalance.trim() || Number.isNaN(tsa)) {
        block('tsa', 1, 'tsaStatementBalance', 'Enter the closing balance from the TSA statement, in naira.')
      } else if (Math.abs(tsa - data.ledgerClosingBalance) >= 1) {
        justify('recon-diff', `The TSA statement differs from the ledger by ${naira(tsa - data.ledgerClosingBalance)}. List the reconciling items.`)
      }
      // Pre-flight: threshold splitting (same rule as the Anomaly Engine).
      const near = data.lines.filter((l) => l.amount < APPROVAL_LIMIT && l.amount >= APPROVAL_LIMIT * (1 - SPLIT_MARGIN))
      const byPayee = new Map<string, typeof near>()
      near.forEach((l) => byPayee.set(l.payee, [...(byPayee.get(l.payee) ?? []), l]))
      for (const [payee, list] of byPayee) {
        const sorted = [...list].sort((a, b) => a.date.localeCompare(b.date))
        const clustered = sorted.some((l, i) => i > 0 && days(sorted[i - 1].date, l.date) <= SPLIT_WINDOW_DAYS)
        if (clustered)
          justify(
            `split:${payee}`,
            `Possible threshold splitting: ${list.map((l) => l.ref).join(' and ')} to ${payee} within ${SPLIT_WINDOW_DAYS} days, each within ${SPLIT_MARGIN * 100}% of the ${naira(APPROVAL_LIMIT)} limit. Explain the lot division.`,
          )
      }
      const confirmed = data.lines.filter((l) => l.status === 'confirmed')
      const unevidenced = confirmed.filter((l) => !evidence.some((e) => e.slotId === `line:${l.ref}`))
      if (unevidenced.length)
        block('lines-evidence', 2, 'evidence:lines', `${unevidenced.length} confirmed voucher${unevidenced.length === 1 ? ' has' : 's have'} no evidence: ${unevidenced.slice(0, 4).map((l) => l.ref).join(', ')}${unevidenced.length > 4 ? '…' : ''}.`)
      if (!evidence.some((e) => e.slotId === 'tsa_statement')) block('evidence:tsa_statement', 2, 'evidence:tsa_statement', 'Attach: TSA sub-account statement.')
      const queried = data.lines.filter((l) => l.status === 'queried').length
      if (queried) advise('queried', 1, 'lines', `${queried} posting${queried === 1 ? ' is' : 's are'} queried. Your notes go to oversight with the return.`)
      break
    }

    case 'advance_retirement': {
      if (!data.items.length) block('items', 1, 'items', 'Add at least one line of spend.')
      let spent = 0
      for (const it of data.items) {
        const amt = parseAmount(it.amount)
        if (tooShort(it.description, 3) || !(amt > 0)) block(`item:${it.id}`, 1, `item:${it.id}`, `Each line needs a description and an amount (line “${it.description || 'untitled'}”).`)
        else spent += amt
      }
      const remitted = parseAmount(data.remitted)
      if (Number.isNaN(remitted)) block('remitted', 1, 'remitted', 'Enter the unspent cash remitted, in naira (0 if none).')
      else {
        const diff = spent + remitted - data.advanceAmount
        if (Math.abs(diff) >= 1)
          block('totals', 1, 'totals', `Spend ${naira(spent)} + remitted ${naira(remitted)} must equal the advance of ${naira(data.advanceAmount)} (off by ${naira(diff)}).`)
        if (remitted > 0 && tooShort(data.remittanceRef, 4)) block('remittanceRef', 1, 'remittanceRef', 'Enter the TSA remittance reference for the unspent cash.')
      }
      const age = days(data.disbursedOn, ctx.now)
      if (age > RETIREMENT_WINDOW_DAYS)
        justify('late-retirement', `Retired ${age} days after disbursement, past the ${RETIREMENT_WINDOW_DAYS}-day window. Explain the delay.`)
      const noReceipt = data.items.filter((i) => !i.receiptRef.trim()).length
      if (noReceipt) advise('receipt-refs', 1, 'items', `${noReceipt} line${noReceipt === 1 ? ' has' : 's have'} no receipt reference. Adding them lets reviewers match receipts to lines.`)
      break
    }

    case 'milestone_certificate': {
      const cert = data.certDate ? new Date(`${data.certDate}T12:00:00`) : null
      if (!cert || Number.isNaN(cert.getTime())) block('certDate', 1, 'certDate', 'Enter the date the certificate was signed.')
      else if (cert > ctx.now) block('certDate', 1, 'certDate', 'The certificate date cannot be in the future.')
      if (tooShort(data.engineer, 3)) block('engineer', 1, 'engineer', 'Enter the name of the certifying engineer or receiving officer.')
      const pc = Number(data.percentComplete)
      if (!data.percentComplete.trim() || Number.isNaN(pc) || pc < 0 || pc > 100) block('percentComplete', 1, 'percentComplete', 'Enter percent complete (0–100).')
      if (cert && !Number.isNaN(cert.getTime())) {
        const early = data.vouchers.filter((v) => new Date(`${v.date}T12:00:00`) < cert)
        if (early.length)
          justify(
            'paid-before-cert',
            `${early.map((v) => v.ref).join(', ')} ${early.length === 1 ? 'was' : 'were'} paid before this certificate was signed. Explain who authorised payment ahead of certification.`,
          )
      }
      const pdfPhotos = evidence.filter((e) => e.slotId === 'site_photos' && e.mime === 'application/pdf').length
      if (pdfPhotos) advise('photo-format', 2, 'evidence:site_photos', 'Photos uploaded as PDF lose their timestamp and location. Upload the original JPGs if you have them.')
      break
    }

    case 'release_request': {
      const amt = parseAmount(data.amount)
      const headroom = data.snapshot.appropriated - data.snapshot.released
      if (!(amt > 0)) block('amount', 1, 'amount', 'Enter the amount requested, in naira.')
      else if (amt > headroom) block('amount', 1, 'amount', `The request exceeds unreleased appropriation of ${naira(headroom)}.`)
      if (tooShort(data.purpose)) block('purpose', 1, 'purpose', `Describe the purpose (at least ${MIN_TEXT} characters).`)
      if (tooShort(data.obligations, 20)) block('obligations', 1, 'obligations', 'List the contracts or obligations this release will fund.')
      const absorption = data.snapshot.released ? data.snapshot.utilized / data.snapshot.released : 1
      if (absorption < LOW_ABSORPTION)
        justify('low-absorption', `Only ${(absorption * 100).toFixed(0)}% of funds already released have been used. Explain why more is needed now.`)
      if (data.snapshot.openCriticalHigh > 0)
        justify(
          'open-flags',
          `Treasury will see ${data.snapshot.openCriticalHigh} open Critical/High flag${data.snapshot.openCriticalHigh === 1 ? '' : 's'} alongside this request. Explain why the release should not wait for them.`,
        )
      break
    }

    case 'quarterly_performance': {
      let flagged = 0
      for (const r of data.rows) {
        const abs = r.released ? r.utilized / r.released : 1
        if (abs < QUARTER_COMMENT_BELOW) {
          flagged++
          if (tooShort(r.commentary)) block(`row:${r.category}`, 1, `row:${r.category}`, `${r.category}: absorption is ${(abs * 100).toFixed(0)}%. Explain the variance (at least ${MIN_TEXT} characters).`)
        }
      }
      if (flagged && tooShort(data.correctiveActions)) block('correctiveActions', 1, 'correctiveActions', 'Describe corrective actions with dates.')
      const appr = data.rows.reduce((a, r) => a + r.appropriated, 0)
      const rel = data.rows.reduce((a, r) => a + r.released, 0)
      if (appr && rel / appr < 0.5) advise('release-rate', 1, 'rows', `Only ${((rel / appr) * 100).toFixed(0)}% of appropriation has been released. Mention any pending release requests.`)
      break
    }

    case 'vendor_exception': {
      if (tooShort(data.vendorName, 3)) block('vendorName', 1, 'vendorName', 'Enter the vendor’s registered name.')
      if (!/^RC\s?\d{5,8}$/i.test(data.rcNumber.trim())) block('rcNumber', 1, 'rcNumber', 'CAC registration number must look like RC 1234567.')
      if (!/^\d{8}-\d{4}$/.test(data.tin.trim())) block('tin', 1, 'tin', 'TIN must look like 12345678-0001.')
      if (!data.failedLookup) block('failedLookup', 1, 'failedLookup', 'Choose which lookup failed.')
      if (tooShort(data.reason)) block('reason', 1, 'reason', `Explain why the lookup failed (at least ${MIN_TEXT} characters).`)
      const tin = data.tin.trim()
      const clash = ctx.vendors.find((v) => v.tin === tin && v.name.toLowerCase() !== data.vendorName.trim().toLowerCase())
      if (tin && clash) justify('tin-duplicate', `TIN ${tin} is already registered to ${clash.name}. Explain how the two vendors are related.`)
      const sameName = ctx.vendors.find((v) => v.name.toLowerCase() === data.vendorName.trim().toLowerCase())
      if (sameName) advise('name-exists', 1, 'vendorName', `${sameName.name} is already in the registry (${sameName.tin}). Check this isn’t a duplicate.`)
      break
    }
  }

  // Required evidence slots (monthly return lines and the TSA statement are handled above).
  if (data.kind !== 'monthly_return') {
    for (const slot of evidenceSlots(data)) {
      if (slot.required && !evidence.some((e) => e.slotId === slot.id)) block(`evidence:${slot.id}`, 2, `evidence:${slot.id}`, `Attach: ${slot.label}.`)
    }
  }

  return issues
}
