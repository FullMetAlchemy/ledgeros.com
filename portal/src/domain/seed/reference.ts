// Prototype reference data (FRD §6, BR-012). These are demonstration values
// for an unnamed state; they are not verified government financial records.
// Scenario figures required by the FRD:
//   Ministry of Works: appropriation ₦612B, utilization 97.8%, 3 active flags
//   Ministry of Health: allocation ₦15B, utilization ₦38B (severe overspend)
//   August return with vendor-level disbursements and TSA context
//   Geotech Survey Limited in the August return

import type { Advance, EconomicCode, FundRelease, LedgerExpenditure, Mda, Project, RevenueRecord, Transaction, TsaLine, User, Vendor } from '../types'
import { periodId } from '../periods'

const B = 1e9
const M = 1e6

export const MDAS: Mda[] = [
  { id: 'MWI', code: 'MDA-011', acronym: 'MWI', name: 'Ministry of Works and Infrastructure', sector: 'Infrastructure', accountingOfficer: 'Permanent Secretary, Works', contactEmail: 'finance@works.state.gov.ng', status: 'Active', appropriation: 612 * B },
  { id: 'MOH', code: 'MDA-021', acronym: 'MOH', name: 'Ministry of Health', sector: 'Health', accountingOfficer: 'Permanent Secretary, Health', contactEmail: 'finance@health.state.gov.ng', status: 'Active', appropriation: 15 * B },
  { id: 'MOE', code: 'MDA-031', acronym: 'MOE', name: 'Ministry of Education', sector: 'Education', accountingOfficer: 'Permanent Secretary, Education', contactEmail: 'finance@education.state.gov.ng', status: 'Active', appropriation: 240 * B },
  { id: 'MARD', code: 'MDA-041', acronym: 'MARD', name: 'Ministry of Agriculture and Rural Development', sector: 'Agriculture', accountingOfficer: 'Permanent Secretary, Agriculture', contactEmail: 'finance@agriculture.state.gov.ng', status: 'Active', appropriation: 96 * B },
  { id: 'SEMA', code: 'MDA-052', acronym: 'SEMA', name: 'State Emergency Management Agency', sector: 'Humanitarian', accountingOfficer: 'Executive Secretary, SEMA', contactEmail: 'finance@sema.state.gov.ng', status: 'Active', appropriation: 18 * B },
  { id: 'SUBEB', code: 'MDA-033', acronym: 'SUBEB', name: 'State Universal Basic Education Board', sector: 'Education', accountingOfficer: 'Executive Chairman, SUBEB', contactEmail: 'finance@subeb.state.gov.ng', status: 'Active', appropriation: 64 * B },
  { id: 'MOF', code: 'MDA-061', acronym: 'MOF', name: 'Ministry of Finance', sector: 'Governance', accountingOfficer: 'Permanent Secretary, Finance', contactEmail: 'finance@finance.state.gov.ng', status: 'Active', appropriation: 120 * B },
  { id: 'SIRS', code: 'MDA-062', acronym: 'SIRS', name: 'State Internal Revenue Service', sector: 'Governance', accountingOfficer: 'Executive Chairman, SIRS', contactEmail: 'finance@sirs.state.gov.ng', status: 'Active', appropriation: 22 * B },
]

/** Year-to-date targets (to end of August) and releases (to end of September). */
export const TARGETS: Record<string, { utilizedToAug: number; releasedToSep: number; unretired: number }> = {
  MWI: { utilizedToAug: 598.536 * B, releasedToSep: 604 * B, unretired: 41.2 * B },
  MOH: { utilizedToAug: 38 * B, releasedToSep: 15 * B, unretired: 2.1 * B },
  MOE: { utilizedToAug: 142 * B, releasedToSep: 170 * B, unretired: 3.2 * B },
  MARD: { utilizedToAug: 41 * B, releasedToSep: 58 * B, unretired: 4.8 * B },
  SEMA: { utilizedToAug: 12.2 * B, releasedToSep: 14 * B, unretired: 2.9 * B },
  SUBEB: { utilizedToAug: 22 * B, releasedToSep: 40 * B, unretired: 1.1 * B },
  MOF: { utilizedToAug: 78.5 * B, releasedToSep: 86 * B, unretired: 0.6 * B },
  SIRS: { utilizedToAug: 14.3 * B, releasedToSep: 16 * B, unretired: 0.3 * B },
}

const u = (id: string, name: string, email: string, role: User['role'], mdaId: string | null, title: string, status: User['status'] = 'Active'): User => ({
  id,
  name,
  initials: name
    .replace(/^(Dr\.|Hon\.)\s+/, '')
    .split(' ')
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase(),
  email,
  role,
  mdaId,
  title,
  status,
  createdAt: '2026-01-05T09:00:00.000Z',
  lastLoginAt: null,
})

export const USERS: User[] = [
  u('U-001', 'Dr. Kemi Adebayo', 'kemi.adebayo@mbep.state.gov.ng', 'executive', null, 'Honourable Commissioner, Budget and Economic Planning'),
  u('U-002', 'Tunde Bakare', 'tunde.bakare@mbep.state.gov.ng', 'oversight', null, 'Director, Budget Monitoring'),
  u('U-003', 'Maryam Sule', 'maryam.sule@mbep.state.gov.ng', 'oversight', null, 'Deputy Director, Expenditure Control'),
  u('U-004', 'Adaeze Okonkwo', 'adaeze.okonkwo@oag.state.gov.ng', 'auditor', null, 'Audit Reviewer, Office of the State Auditor-General'),
  u('U-005', 'Tunde Adeyemi', 'tunde.adeyemi@mbep.state.gov.ng', 'admin', null, 'System Administrator, ICT'),
  u('U-010', 'Chinedu Eze', 'chinedu.eze@works.state.gov.ng', 'mda_officer', 'MWI', 'Principal Accountant'),
  u('U-011', 'Halima Yusuf', 'halima.yusuf@works.state.gov.ng', 'mda_supervisor', 'MWI', 'Director of Finance and Accounts'),
  u('U-012', 'Olumide Bakare', 'olumide.bakare@works.state.gov.ng', 'mda_officer', 'MWI', 'Accountant II', 'Pending'),
  u('U-020', 'Ngozi Adeleke', 'ngozi.adeleke@health.state.gov.ng', 'mda_officer', 'MOH', 'Principal Accountant'),
  u('U-021', 'Ibrahim Sani', 'ibrahim.sani@health.state.gov.ng', 'mda_supervisor', 'MOH', 'Director of Finance and Accounts'),
  u('U-022', 'Garba Lawal', 'garba.lawal@health.state.gov.ng', 'mda_officer', 'MOH', 'Accountant I', 'Suspended'),
  u('U-030', 'Amaka Nnaji', 'amaka.nnaji@education.state.gov.ng', 'mda_officer', 'MOE', 'Principal Accountant'),
  u('U-031', 'Segun Afolabi', 'segun.afolabi@education.state.gov.ng', 'mda_supervisor', 'MOE', 'Director of Finance and Accounts'),
  u('U-040', 'Tolu Ogunleye', 'tolu.ogunleye@agriculture.state.gov.ng', 'mda_officer', 'MARD', 'Principal Accountant'),
  u('U-041', 'Hauwa Abubakar', 'hauwa.abubakar@agriculture.state.gov.ng', 'mda_supervisor', 'MARD', 'Director of Finance and Accounts'),
  u('U-050', 'Zainab Idris', 'zainab.idris@sema.state.gov.ng', 'mda_officer', 'SEMA', 'Principal Accountant'),
  u('U-051', 'Bala Usman', 'bala.usman@sema.state.gov.ng', 'mda_supervisor', 'SEMA', 'Head of Finance'),
  u('U-060', 'Aminu Garba', 'aminu.garba@subeb.state.gov.ng', 'mda_officer', 'SUBEB', 'Principal Accountant'),
  u('U-061', 'Grace Okoye', 'grace.okoye@subeb.state.gov.ng', 'mda_supervisor', 'SUBEB', 'Director of Finance'),
  u('U-070', 'Kelechi Obi', 'kelechi.obi@finance.state.gov.ng', 'mda_officer', 'MOF', 'Principal Accountant'),
  u('U-071', 'Yetunde Salami', 'yetunde.salami@finance.state.gov.ng', 'mda_supervisor', 'MOF', 'Director of Finance and Accounts'),
  u('U-080', 'Emeka Nwosu', 'emeka.nwosu@sirs.state.gov.ng', 'mda_officer', 'SIRS', 'Principal Accountant'),
  u('U-081', 'Funmilayo Ajayi', 'funmilayo.ajayi@sirs.state.gov.ng', 'mda_supervisor', 'SIRS', 'Director of Finance'),
]

export const ECONOMIC_CODES: EconomicCode[] = [
  { code: '21010101', label: 'Salaries and wages', category: 'Personnel' },
  { code: '22020101', label: 'Local travel and transport', category: 'Overhead' },
  { code: '22020301', label: 'Drugs and medical supplies', category: 'Overhead' },
  { code: '22020401', label: 'Maintenance of buildings', category: 'Overhead' },
  { code: '22021001', label: 'General services and supplies', category: 'Overhead' },
  { code: '23010112', label: 'Purchase of medical equipment', category: 'Capital' },
  { code: '23020114', label: 'Construction of roads', category: 'Capital' },
  { code: '23020118', label: 'Construction of classrooms', category: 'Capital' },
  { code: '23030113', label: 'Rehabilitation of roads', category: 'Capital' },
  { code: '23030121', label: 'Rehabilitation of irrigation works', category: 'Capital' },
  { code: '23050103', label: 'Engineering surveys', category: 'Capital' },
  { code: '23050104', label: 'Consultancy services', category: 'Capital' },
]

export const VENDORS: Vendor[] = [
  { id: 'V01', name: 'Geotech Survey Limited', tin: '10667788-0001', category: 'Engineering survey' },
  { id: 'V02', name: 'Kanu-Doyle Construction Ltd', tin: '10223344-0001', category: 'Civil works' },
  { id: 'V03', name: 'Coastal Highway Partners Ltd', tin: '10445566-0001', category: 'Civil works' },
  { id: 'V04', name: 'Delta Bridge Consultants', tin: '10556677-0001', category: 'Consultancy' },
  { id: 'V05', name: 'State Roads Maintenance Agency', tin: '90000011-0001', category: 'Government agency' },
  { id: 'V06', name: 'Arewa Civil Works', tin: '10987654-0001', category: 'Civil works' },
  { id: 'V07', name: 'Metro Asphalt Supplies', tin: '10778899-0001', category: 'Materials' },
  { id: 'V08', name: 'State Works Zonal Office', tin: '90000012-0001', category: 'Government imprest' },
  { id: 'V09', name: 'National Cold Chain Ltd', tin: '30556677-0001', category: 'Medical equipment' },
  { id: 'V10', name: 'MedEquip West Africa', tin: '30112233-0001', category: 'Medical equipment' },
  { id: 'V11', name: 'Pharma Logistics Nigeria', tin: '30998877-0001', category: 'Pharmaceuticals' },
  { id: 'V12', name: 'State General Hospital, Central', tin: '90000021-0001', category: 'Government facility' },
  { id: 'V13', name: 'Classic Builders and Allied', tin: '40112233-0001', category: 'Civil works' },
  { id: 'V14', name: 'Learning Materials Ltd', tin: '40223344-0001', category: 'Educational supplies' },
  { id: 'V15', name: 'Agro-Input Supplies Ltd', tin: '40778899-0001', category: 'Agricultural inputs' },
  { id: 'V16', name: 'Irrigation Works Nigeria', tin: '40889900-0001', category: 'Civil works' },
  { id: 'V17', name: 'Relief Logistics Partners', tin: '50112233-0001', category: 'Logistics' },
  { id: 'V18', name: 'Sahel Relief Supplies', tin: '50223344-0001', category: 'Relief materials' },
  { id: 'V19', name: 'BluePrint ICT Services', tin: '60112233-0001', category: 'ICT' },
  { id: 'V20', name: 'Revenue Systems Integrators Ltd', tin: '60223344-0001', category: 'ICT' },
  { id: 'V21', name: 'Office Mart Ltd', tin: '60334455-0001', category: 'Office supplies' },
]

export const PROJECTS: Project[] = [
  { id: 'PRJ-MWI-01', mdaId: 'MWI', name: 'Ring Road Phase II', vendorId: 'V02', contractValue: 120 * B, paidToDate: 84 * B, completionPct: 38, lastInspection: '2026-08-30', paymentRefs: ['PV-3931', 'PV-3944'] },
  { id: 'PRJ-MWI-02', mdaId: 'MWI', name: 'Coastal Highway, section 2', vendorId: 'V03', contractValue: 150 * B, paidToDate: 60 * B, completionPct: 36, lastInspection: '2026-08-15', paymentRefs: ['PV-3861'] },
  { id: 'PRJ-MWI-03', mdaId: 'MWI', name: 'Bridge approach roads: design', vendorId: 'V04', contractValue: 1.26 * B, paidToDate: 0.42 * B, completionPct: 33, lastInspection: '2026-08-10', paymentRefs: ['PV-3877'] },
  { id: 'PRJ-MOH-01', mdaId: 'MOH', name: 'Diagnostic imaging equipment, lot 1', vendorId: 'V10', contractValue: 10.8 * B, paidToDate: 4.4 * B, completionPct: 45, lastInspection: '2026-08-22', paymentRefs: ['PV-6524'] },
  { id: 'PRJ-MOE-01', mdaId: 'MOE', name: 'Classroom blocks, phase 3', vendorId: 'V13', contractValue: 48 * B, paidToDate: 18.4 * B, completionPct: 36, lastInspection: '2026-08-18', paymentRefs: ['PV-2110', 'PV-2201'] },
  { id: 'PRJ-MARD-01', mdaId: 'MARD', name: 'Irrigation canal rehabilitation', vendorId: 'V16', contractValue: 12 * B, paidToDate: 2.75 * B, completionPct: 25, lastInspection: '2026-08-20', paymentRefs: ['PV-5118'] },
]

type Line = Omit<Transaction, 'id' | 'source'>
const line = (date: string, reference: string, vendorId: string, description: string, economicCode: string, amount: number, projectId = ''): Line => {
  const v = VENDORS.find((x) => x.id === vendorId)!
  return { date, reference, vendorName: v.name, vendorTin: v.tin, description, economicCode, amount, projectId }
}

/** Lines each MDA will enter in its seeded returns, keyed `${mdaId}:${periodId}`. */
export const RETURN_LINES: Record<string, Line[]> = {
  'MWI:2026-08': [
    line('2026-08-04', 'PV-3830', 'V01', 'Topographic survey - Ring Road Phase II', '23050103', 312 * M, 'PRJ-MWI-01'),
    line('2026-08-11', 'PV-3861', 'V03', 'Coastal highway section 2 - interim certificate 4', '23020114', 21.3 * B, 'PRJ-MWI-02'),
    line('2026-08-14', 'PV-3877', 'V04', 'Bridge approach design review', '23050104', 420 * M, 'PRJ-MWI-03'),
    line('2026-08-18', 'PV-3890', 'V05', 'Emergency pothole repairs, northern zone', '23030113', 1.1 * B),
    line('2026-08-19', 'PV-3852', 'V01', 'Topographic survey - Ring Road Phase II', '23050103', 312 * M, 'PRJ-MWI-01'),
    line('2026-08-21', 'PV-3905', 'V06', 'Culvert repairs, western zone', '23030113', 248.5 * M),
    line('2026-08-26', 'PV-3931', 'V02', 'Ring Road Phase II - payment certificate 6', '23020114', 18.6 * B, 'PRJ-MWI-01'),
    line('2026-08-27', 'PV-3944', 'V07', 'Asphalt supply - Ring Road Phase II', '23020114', 12.4 * B, 'PRJ-MWI-01'),
    line('2026-08-29', 'PV-3950', 'V08', 'Zonal works office running costs', '22020101', 86 * M),
  ],
  'MOH:2026-08': [
    line('2026-08-03', 'PV-6502', 'V09', 'Solar vaccine refrigerators', '23010112', 1.2 * B),
    line('2026-08-06', 'PV-6511', 'V12', 'Hospital running costs', '22020401', 640 * M),
    line('2026-08-10', 'PV-6524', 'V10', 'Diagnostic imaging equipment, lot 1', '23010112', 2.2 * B, 'PRJ-MOH-01'),
    line('2026-08-17', 'PV-6540', 'V11', 'Essential medicines distribution', '22020301', 380 * M),
    line('2026-08-28', 'PV-6570', 'V11', 'Essential medicines, quarter 3 restock', '22020301', 410 * M),
  ],
  'MOH:2026-09': [line('2026-09-08', 'PV-6601', 'V11', 'Essential medicines distribution', '22020301', 390 * M)],
  'MOE:2026-07': [
    line('2026-07-08', 'PV-2101', 'V14', 'Exercise books, term 1 supply', '22021001', 420 * M),
    line('2026-07-15', 'PV-2110', 'V13', 'Classroom blocks, phase 3 - certificate 1', '23020118', 8.8 * B, 'PRJ-MOE-01'),
    line('2026-07-22', 'PV-2102', 'V14', 'Exercise books, term 1 supply', '22021001', 420 * M),
  ],
  'MOE:2026-08': [
    line('2026-08-05', 'PV-2201', 'V13', 'Classroom blocks, phase 3 - certificate 2', '23020118', 9.6 * B, 'PRJ-MOE-01'),
    line('2026-08-12', 'PV-2214', 'V14', 'Textbooks for public secondary schools', '22021001', 2.4 * B),
    line('2026-08-20', 'PV-2230', 'V13', 'Laboratory refurbishment', '22020401', 1.15 * B),
    line('2026-08-27', 'PV-2245', 'V19', 'School ICT centres', '23050104', 780 * M),
  ],
  'MARD:2026-08': [
    line('2026-08-06', 'PV-5101', 'V15', 'Fertiliser for the wet season', '22021001', 3.9 * B),
    line('2026-08-14', 'PV-5118', 'V16', 'Irrigation canal rehabilitation - certificate 1', '23030121', 2.75 * B, 'PRJ-MARD-01'),
    line('2026-08-25', 'PV-5127', 'V15', 'Tractor hire services', '22021001', 640 * M),
  ],
  'SEMA:2026-08': [
    line('2026-08-04', 'PV-7201', 'V17', 'Flood relief logistics, riverine LGAs', '22021001', 1.25 * B),
    line('2026-08-16', 'PV-7215', 'V18', 'Relief materials: mattresses and food', '22021001', 980 * M),
  ],
  'SUBEB:2026-08': [line('2026-08-12', 'PV-8101', 'V13', 'Primary school renovation, cluster 4', '22020401', 5.2 * B)],
  'MOF:2026-08': [
    line('2026-08-03', 'PV-1101', 'V19', 'IFMIS support and licences', '23050104', 1.42 * B),
    line('2026-08-19', 'PV-1118', 'V21', 'Office consumables', '22021001', 96 * M),
    line('2026-08-28', 'PV-1130', 'V20', 'Treasury single account integration', '23050104', 2.1 * B),
  ],
  'SIRS:2026-08': [
    line('2026-08-07', 'PV-9101', 'V20', 'Tax administration platform - phase 2', '23050104', 1.85 * B),
    line('2026-08-21', 'PV-9120', 'V21', 'Enforcement field kits', '22021001', 140 * M),
  ],
}

/** Mock GIFMIS postings the MDA can import instead of keying (September). */
export const GIFMIS_POSTINGS: Record<string, Line[]> = {
  'MWI:2026-09': [
    line('2026-09-03', 'PV-4011', 'V02', 'Ring Road Phase II - payment certificate 7', '23020114', 9.8 * B, 'PRJ-MWI-01'),
    line('2026-09-07', 'PV-4020', 'V05', 'Emergency pothole repairs, southern zone', '23030113', 760 * M),
    line('2026-09-10', 'PV-4034', 'V07', 'Asphalt supply - Ring Road Phase II', '23020114', 3.1 * B, 'PRJ-MWI-01'),
    line('2026-09-14', 'PV-4041', 'V08', 'Zonal works office running costs', '22020101', 82 * M),
  ],
  'MOH:2026-09': [
    line('2026-09-08', 'PV-6601', 'V11', 'Essential medicines distribution', '22020301', 390 * M),
    line('2026-09-12', 'PV-6612', 'V12', 'Hospital running costs', '22020401', 610 * M),
  ],
  'SUBEB:2026-08': [
    line('2026-08-12', 'PV-8101', 'V13', 'Primary school renovation, cluster 4', '22020401', 5.2 * B),
    line('2026-08-22', 'PV-8115', 'V14', 'Pupil learning kits', '22021001', 1.3 * B),
  ],
}

/**
 * Mock TSA statements. They mirror the returns except where the scenario
 * needs a variance: Works' second Geotech payment (PV-3852) never cleared the
 * TSA and a bank charge appears only on the statement; one Health payment
 * cleared for a different amount.
 */
export function tsaStatement(k: string): TsaLine[] {
  const lines = RETURN_LINES[k] ?? []
  let out: TsaLine[] = lines.map((l) => ({ reference: l.reference, date: l.date, payee: l.vendorName, amount: l.amount }))
  if (k === 'MWI:2026-08') {
    out = out.filter((l) => l.reference !== 'PV-3852')
    out.push({ reference: 'TSA-CHG-0831', date: '2026-08-31', payee: 'CBN TSA charges', amount: 2.5 * M })
  }
  if (k === 'MOH:2026-08') out = out.map((l) => (l.reference === 'PV-6524' ? { ...l, amount: 2.18 * B } : l))
  return out
}

// ---- Monthly baselines -----------------------------------------------------------

const round = (n: number) => Math.round(n / 1000) * 1000

/** Split a total over months by weight, putting the rounding remainder in the last month. */
function spread(total: number, weights: number[]): number[] {
  const w = weights.reduce((a, x) => a + x, 0)
  const parts = weights.map((x) => round((total * x) / w))
  parts[parts.length - 1] += total - parts.reduce((a, x) => a + x, 0)
  return parts
}

/** Months (1-based) with detailed returns; other months come from the ledger baseline. */
const RETURN_MONTHS: Record<string, number[]> = { MWI: [8], MOH: [8], MOE: [7, 8], MARD: [8], SEMA: [8], SUBEB: [], MOF: [8], SIRS: [8] }

export function ledgerBaseline(): LedgerExpenditure[] {
  const out: LedgerExpenditure[] = []
  for (const mda of MDAS) {
    const t = TARGETS[mda.id]
    const detailed = RETURN_MONTHS[mda.id]
    const detailedTotal = detailed.reduce((a, m) => a + (RETURN_LINES[`${mda.id}:${periodId(m)}`] ?? []).reduce((s, l) => s + l.amount, 0), 0)
    const months = Array.from({ length: 7 }, (_, i) => i + 1).filter((m) => !detailed.includes(m))
    const weights = months.map((m) => 0.8 + m * 0.07)
    const amounts = spread(t.utilizedToAug - detailedTotal, weights)
    months.forEach((m, i) => out.push({ mdaId: mda.id, periodId: periodId(m), amount: amounts[i], source: 'Mock GIFMIS ledger' }))
  }
  return out
}

export function releases(): FundRelease[] {
  const out: FundRelease[] = []
  let n = 0
  for (const mda of MDAS) {
    const total = TARGETS[mda.id].releasedToSep
    const weights = mda.id === 'MOH' ? [1, 1, 1, 1, 1, 1, 0, 0, 0] : mda.id === 'MWI' ? [1, 1, 1, 1, 1, 1, 1, 1, 0.0533] : [1, 1, 1.05, 1.05, 1.1, 1.1, 1.1, 1.1, 0.6]
    spread(total, weights).forEach((amount, i) => {
      if (!amount) return
      n++
      out.push({ id: `WR-${String(n).padStart(4, '0')}`, mdaId: mda.id, periodId: periodId(i + 1), amount, reference: `WR/2026/${mda.acronym}/${String(i + 1).padStart(2, '0')}` })
    })
  }
  return out
}

export function revenue(): RevenueRecord[] {
  const sources: { source: string; expected: number; rate: (m: number) => number }[] = [
    { source: 'FAAC statutory allocation', expected: 38 * B, rate: (m) => [0.97, 1.02, 0.99, 0.95, 1.01, 0.98, 0.96, 1.0, 0.72][m - 1] },
    { source: 'VAT share', expected: 22 * B, rate: (m) => [0.98, 0.99, 1.02, 0.97, 0.99, 1.0, 0.98, 0.99, 0.7][m - 1] },
    { source: 'Internally generated revenue', expected: 30 * B, rate: (m) => [0.78, 0.84, 0.88, 0.8, 0.86, 0.9, 0.83, 0.87, 0.55][m - 1] },
    { source: 'Grants and capital receipts', expected: 6 * B, rate: (m) => [0, 0.4, 1.8, 0, 0.5, 1.6, 0, 0.3, 0][m - 1] },
  ]
  const out: RevenueRecord[] = []
  for (let m = 1; m <= 12; m++) {
    for (const s of sources) {
      out.push({ id: `REV-${periodId(m)}-${s.source.slice(0, 4).toUpperCase()}`, periodId: periodId(m), source: s.source, expected: s.expected, collected: m <= 9 ? round(s.expected * s.rate(m)) : 0 })
    }
  }
  return out
}

export function advances(): Advance[] {
  const out: Advance[] = []
  const holders = ['Project Director', 'Zonal Coordinator', 'Head of Procurement', 'Director, Administration']
  let n = 0
  for (const mda of MDAS) {
    const total = TARGETS[mda.id].unretired
    const parts = spread(total, [0.5, 0.3, 0.2])
    parts.forEach((amount, i) => {
      n++
      out.push({ id: `ADV-${String(n).padStart(4, '0')}`, mdaId: mda.id, holder: `${holders[i]}, ${mda.acronym}`, amount, disbursedOn: `2026-0${4 + i * 2}-1${i}`, retiredOn: null })
    })
    n++
    out.push({ id: `ADV-${String(n).padStart(4, '0')}`, mdaId: mda.id, holder: `${holders[3]}, ${mda.acronym}`, amount: round(total * 0.15), disbursedOn: '2026-02-12', retiredOn: '2026-04-30' })
  }
  return out
}
