import { useId, useState, type DragEvent } from 'react'
import { dateTime } from '../domain/calendar'
import type { EvidenceSlotDef } from '../domain/templates'
import type { EvidenceFile } from '../domain/types'
import { ACCEPTED_TYPES as ACCEPTED, fileSize as size, MAX_FILE_BYTES, sha256Hex } from './evidence'

/**
 * A typed evidence slot. Files are fingerprinted (SHA-256) in the browser as they
 * are added. The fingerprint is what reviewers and oversight see, so a file
 * swapped later is detectable. Only metadata is kept in this demo.
 */
export function EvidenceSlot({
  slot,
  files,
  required,
  editable,
  userId,
  onAdd,
  onDetach,
}: {
  slot: Pick<EvidenceSlotDef, 'id' | 'label' | 'help'>
  files: EvidenceFile[]
  required: boolean
  editable: boolean
  userId: string
  onAdd?: (files: EvidenceFile[]) => void
  onDetach?: (id: string) => void
}) {
  const inputId = useId()
  const [over, setOver] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function accept(list: FileList | null) {
    if (!list?.length || !onAdd) return
    setError(null)
    const rejected = [...list].filter((f) => !ACCEPTED.includes(f.type) || f.size > MAX_FILE_BYTES)
    if (rejected.length) {
      setError(`${rejected.map((f) => f.name).join(', ')}: only PDF, JPG or PNG up to 25 MB.`)
    }
    const ok = [...list].filter((f) => !rejected.includes(f))
    if (!ok.length) return
    setBusy(true)
    try {
      const out: EvidenceFile[] = []
      for (const f of ok) {
        out.push({
          id: crypto.randomUUID(),
          slotId: slot.id,
          name: f.name,
          size: f.size,
          mime: f.type,
          sha256: await sha256Hex(f),
          uploadedBy: userId,
          uploadedAt: new Date().toISOString(),
        })
      }
      onAdd(out)
    } catch {
      setError('Could not read the file. Try again, or save it to this computer first.')
    } finally {
      setBusy(false)
    }
  }

  const onDrop = (e: DragEvent) => {
    e.preventDefault()
    setOver(false)
    void accept(e.dataTransfer.files)
  }

  const missing = required && files.length === 0

  return (
    <div className={`flex flex-col gap-2 rounded-lg border p-3.5 ${missing ? 'border-warn-bd' : 'border-line'}`} data-field={`evidence:${slot.id}`}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="text-[13px] font-semibold">
          {slot.label}{' '}
          {required ? (
            <span className="font-mono text-[10.5px] font-medium text-warn-fg">REQUIRED</span>
          ) : (
            <span className="font-mono text-[10.5px] font-medium text-muted">OPTIONAL</span>
          )}
        </div>
        <span className="font-mono text-[11px] text-muted">{files.length} file{files.length === 1 ? '' : 's'}</span>
      </div>
      <p className="-mt-1 text-xs text-muted">{slot.help}</p>

      {files.length > 0 && (
        <ul className="flex flex-col divide-y divide-line rounded-md border border-line">
          {files.map((f) => (
            <li key={f.id} className="flex flex-wrap items-center gap-x-3 gap-y-0.5 px-3 py-2 text-[13px]">
              <span className="min-w-0 flex-1 truncate font-medium">{f.name}</span>
              <span className="font-mono text-[11px] text-muted" title={`SHA-256 ${f.sha256}`}>
                SHA-256 {f.sha256.slice(0, 8)}…{f.sha256.slice(-4)}
              </span>
              <span className="font-mono text-[11px] text-muted">{size(f.size)}</span>
              <span className="w-full font-mono text-[10.5px] text-faint">Added {dateTime(f.uploadedAt)}</span>
              {editable && onDetach && (
                <button type="button" className="cursor-pointer text-xs text-accent hover:underline" onClick={() => onDetach(f.id)}>
                  Detach
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {editable && (
        <label
          htmlFor={inputId}
          onDragOver={(e) => {
            e.preventDefault()
            setOver(true)
          }}
          onDragLeave={() => setOver(false)}
          onDrop={onDrop}
          className={`flex cursor-pointer flex-col items-center gap-1 rounded-md border border-dashed px-4 py-4 text-center text-[13px] ${over ? 'border-accent bg-accent-soft' : 'border-line-2 hover:bg-sunk'}`}
        >
          <span className="font-medium">{busy ? 'Fingerprinting…' : 'Drop files here or choose files'}</span>
          <span className="text-xs text-muted">PDF, JPG or PNG · up to 25 MB each</span>
          <input
            id={inputId}
            type="file"
            multiple
            accept={ACCEPTED.join(',')}
            className="sr-only"
            onChange={(e) => {
              void accept(e.target.files)
              e.target.value = ''
            }}
          />
        </label>
      )}
      {error && <p className="text-xs font-medium text-crit-fg">{error}</p>}
    </div>
  )
}
