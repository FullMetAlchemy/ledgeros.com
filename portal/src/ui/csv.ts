// CSV export (FR-REP-006). Values are quoted when needed; numbers are written
// as plain numerals so spreadsheets treat them as numbers.

export interface CsvColumn<T> {
  header: string
  value: (row: T) => string | number | null | undefined
}

const PROTOTYPE_NOTE = 'Prototype data: demonstration values, not verified government financial records.'

function cell(v: string | number | null | undefined): string {
  if (v === null || v === undefined) return ''
  const s = String(v)
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function toCsv<T>(rows: T[], columns: CsvColumn<T>[], title: string): string {
  const lines = [
    cell(title),
    cell(PROTOTYPE_NOTE),
    '',
    columns.map((c) => cell(c.header)).join(','),
    ...rows.map((r) => columns.map((c) => cell(c.value(r))).join(',')),
  ]
  return `﻿${lines.join('\r\n')}\r\n`
}

export function download(filename: string, text: string, type = 'text/csv;charset=utf-8') {
  const url = URL.createObjectURL(new Blob([text], { type }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
