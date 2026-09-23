// Reference data the ledger already holds, used to pre-fill submissions.
// Figures extend the prototype's seed; economic codes and parties are
// illustrative. FMW and FMH are the playable demo MDAs.

import { B } from '../money'
import type { Advance, Contract, Posting, QuarterRow, Vendor } from './types'

const M = 1e6

const p = (ref: string, date: string, payee: string, amount: number, economicCode: string, appropriationLine: string): Posting => ({
  ref,
  date,
  payee,
  amount,
  economicCode,
  appropriationLine,
})

export const POSTINGS: Record<string, Record<string, Posting[]>> = {
  FMW: {
    '2026-07': [
      p('PV-3702', '2026-07-08', 'Kanu-Doyle Construction Ltd', 2.76 * B, '23030113 · Rehabilitation of roads', 'FMW-HW-221 Abuja–Kaduna rehabilitation'),
      p('PV-3714', '2026-07-15', 'Federal Roads Maintenance Agency', 0.9 * B, '23030113 · Rehabilitation of roads', 'FMW-RM-010 Emergency road maintenance'),
      p('PV-3739', '2026-07-24', 'Geotech Survey Ltd', 188 * M, '23050103 · Engineering surveys', 'FMW-HW-230 Sokoto–Badagry route survey'),
    ],
    '2026-08': [
      p('PV-3830', '2026-08-04', 'Geotech Survey Ltd', 312 * M, '23050103 · Engineering surveys', 'FMW-HW-230 Sokoto–Badagry route survey'),
      p('PV-3844', '2026-08-07', 'Zonal Office Overheads, Kano', 86 * M, '22020101 · Local travel and transport', 'FMW-OH-001 Zonal operations'),
      p('PV-3861', '2026-08-11', 'Sokoto–Badagry Highway Partners', 5.3 * B, '23020114 · Construction of roads', 'FMW-HW-230 Sokoto–Badagry section 2'),
      p('PV-3877', '2026-08-14', 'Niger Bridge Consultants', 420 * M, '23050104 · Consultancy services', 'FMW-BR-088 Second Niger Bridge approaches'),
      p('PV-3890', '2026-08-18', 'Federal Roads Maintenance Agency', 1.1 * B, '23030113 · Rehabilitation of roads', 'FMW-RM-010 Emergency road maintenance'),
      p('PV-3912', '2026-08-21', 'Arewa Civil Works', 248.5 * M, '23030113 · Rehabilitation of roads', 'FMW-RM-014 Culvert repairs, North-West'),
      p('PV-3913', '2026-08-22', 'Arewa Civil Works', 249.1 * M, '23030113 · Rehabilitation of roads', 'FMW-RM-014 Culvert repairs, North-West'),
      p('PV-3931', '2026-08-26', 'Kanu-Doyle Construction Ltd', 3.6 * B, '23030113 · Rehabilitation of roads', 'FMW-HW-221 Abuja–Kaduna rehabilitation'),
      p('ADV-0712', '2026-08-28', 'Project Director, FCT Zone', 1.8 * B, '23030113 · Rehabilitation of roads', 'FMW-HW-221 Abuja–Kaduna rehabilitation'),
      p('PV-3950', '2026-08-29', 'Lagos–Ibadan Corridor JV', 14.2 * B, '23020114 · Construction of roads', 'FMW-HW-205 Lagos–Ibadan expressway'),
    ],
  },
  FMH: {
    '2026-08': [
      p('PV-6502', '2026-08-03', 'National Cold Chain Ltd', 1.2 * B, '23010112 · Purchase of medical equipment', 'FMH-CC-044 Cold chain expansion'),
      p('PV-6511', '2026-08-06', 'Federal Medical Centre, Owerri', 640 * M, '22020401 · Maintenance of office buildings', 'FMH-FMC-012 FMC operations'),
      p('PV-6524', '2026-08-10', 'MedEquip West Africa', 2.2 * B, '23010112 · Purchase of medical equipment', 'FMH-EQ-310 Diagnostic equipment, Lot 1'),
      p('PV-6533', '2026-08-13', 'Primary Health Care Board, Kano', 1.9 * B, '22040101 · Grants to states', 'FMH-PHC-004 Basic health care fund'),
      p('PV-6540', '2026-08-17', 'Pharma Logistics Nigeria', 380 * M, '22020301 · Drugs and medical supplies', 'FMH-DR-020 Essential medicines'),
      p('PV-6552', '2026-08-20', 'Teaching Hospital Consortium', 2.6 * B, '22040103 · Grants to institutions', 'FMH-TH-007 Teaching hospitals'),
      p('PV-6561', '2026-08-25', 'Nigerian Institute of Medical Research', 450 * M, '23050101 · Research and development', 'FMH-RD-003 Medical research'),
      p('PV-6570', '2026-08-28', 'Pharma Logistics Nigeria', 610 * M, '22020301 · Drugs and medical supplies', 'FMH-DR-020 Essential medicines'),
    ],
  },
}

export const LEDGER_CLOSING: Record<string, Record<string, number>> = {
  FMW: { '2026-07': 9_210_400_000, '2026-08': 12_480_650_000 },
  FMH: { '2026-08': 6_902_114_500 },
}

export const ADVANCES: Record<string, Advance[]> = {
  FMW: [
    { ref: 'ADV-0712', holder: 'Project Director, FCT Zone', amount: 1.8 * B, disbursedOn: '2026-08-28', purpose: 'Site mobilisation, Abuja–Kaduna sections 1–2' },
    { ref: 'ADV-0744', holder: 'Zonal Engineer, Kano', amount: 420 * M, disbursedOn: '2026-07-02', purpose: 'Emergency culvert works, Kano–Katsina road' },
    { ref: 'ADV-0698', holder: 'Director, Highways (South)', amount: 95 * M, disbursedOn: '2026-05-20', purpose: 'Inspection tour, South-South corridor' },
  ],
  FMH: [
    { ref: 'ADV-3301', holder: 'Director, Hospital Services', amount: 2.1 * B, disbursedOn: '2026-06-30', purpose: 'Emergency equipment for federal medical centres' },
    { ref: 'ADV-3350', holder: 'Head, Port Health Services', amount: 900 * M, disbursedOn: '2026-08-14', purpose: 'Outbreak response logistics' },
  ],
}

export const CONTRACTS: Contract[] = [
  {
    ref: 'FMW/HW/221',
    mdaId: 'FMW',
    title: 'Abuja–Kaduna dual carriageway rehabilitation, sections 1–5',
    contractor: 'Kanu-Doyle Construction Ltd',
    value: 18.4 * B,
    milestones: [
      { no: 1, title: 'Mobilisation', value: 2.76 * B, vouchers: [{ ref: 'PV-3702', date: '2026-07-08', amount: 2.76 * B }] },
      { no: 2, title: 'Earthworks, sections 1–5', value: 2.5 * B, vouchers: [{ ref: 'PV-4029', date: '2026-09-12', amount: 2.5 * B }] },
      { no: 3, title: 'Pavement, sections 1–3', value: 2.5 * B, vouchers: [{ ref: 'PV-4031', date: '2026-09-12', amount: 2.5 * B }] },
      { no: 4, title: 'Drainage and culverts', value: 3.1 * B, vouchers: [] },
    ],
  },
  {
    ref: 'FMW/BR/088',
    mdaId: 'FMW',
    title: 'Second Niger Bridge approach roads: design consultancy',
    contractor: 'Niger Bridge Consultants',
    value: 1.26 * B,
    milestones: [
      { no: 1, title: 'Inception report', value: 420 * M, vouchers: [{ ref: 'PV-3877', date: '2026-08-14', amount: 420 * M }] },
      { no: 2, title: 'Design review', value: 420 * M, vouchers: [] },
    ],
  },
  {
    ref: 'FMH/EQ/310',
    mdaId: 'FMH',
    title: 'Diagnostic equipment, Lot 1 (12 federal medical centres)',
    contractor: 'MedEquip West Africa',
    value: 10.8 * B,
    milestones: [
      { no: 1, title: 'Delivery and installation, Lot 1', value: 5.4 * B, vouchers: [{ ref: 'PV-6610', date: '2026-09-11', amount: 5.4 * B }] },
      { no: 2, title: 'Commissioning and training', value: 5.4 * B, vouchers: [] },
    ],
  },
  {
    ref: 'FMH/CC/044',
    mdaId: 'FMH',
    title: 'National cold chain expansion',
    contractor: 'National Cold Chain Ltd',
    value: 6.6 * B,
    milestones: [{ no: 1, title: 'Supply of solar freezers', value: 3.3 * B, vouchers: [{ ref: 'PV-6588', date: '2026-09-03', amount: 3.3 * B }] }],
  },
]

export const VENDORS: Vendor[] = [
  { name: 'Kanu-Doyle Construction Ltd', rc: 'RC 1180234', tin: '10223344-0001' },
  { name: 'Arewa Civil Works', rc: 'RC 845521', tin: '10987654-0001' },
  { name: 'Geotech Survey Ltd', rc: 'RC 702211', tin: '10667788-0001' },
  { name: 'Lagos–Ibadan Corridor JV', rc: 'RC 1623344', tin: '10445566-0001' },
  { name: 'Voltline Energy Services', rc: 'RC 1502277', tin: '20456611-0001' },
  { name: 'Voltline Nigeria Ltd', rc: 'RC 1502290', tin: '20456622-0001' },
  { name: 'MedEquip West Africa', rc: 'RC 998812', tin: '30112233-0001' },
  { name: 'National Cold Chain Ltd', rc: 'RC 1044567', tin: '30556677-0001' },
  { name: 'Agro-Input Supplies Ltd', rc: 'RC 1311009', tin: '40778899-0001' },
]

/** Q3 figures by category; totals match each MDA's prototype figures. */
export const QUARTER_ROWS: Record<string, Omit<QuarterRow, 'commentary'>[]> = {
  FMW: [
    { category: 'Personnel', appropriated: 306 * B, released: 229.5 * B, utilized: 228.9 * B },
    { category: 'Overhead', appropriated: 122.4 * B, released: 73.4 * B, utilized: 70.1 * B },
    { category: 'Capital', appropriated: 591.6 * B, released: 309.1 * B, utilized: 299.4 * B },
  ],
  FMH: [
    { category: 'Personnel', appropriated: 259 * B, released: 194.3 * B, utilized: 192.8 * B },
    { category: 'Overhead', appropriated: 88.8 * B, released: 58.6 * B, utilized: 51.2 * B },
    { category: 'Capital', appropriated: 392.2 * B, released: 235.1 * B, utilized: 158.5 * B },
  ],
}

export const PERIOD_LABEL = (period: string) => {
  const [y, m] = period.split('-').map(Number)
  return `${['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'][m - 1]} ${y}`
}
