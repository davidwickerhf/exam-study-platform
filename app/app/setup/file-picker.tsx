'use client'

/**
 * Choosing a document, as a control rather than as whatever the browser draws.
 *
 * A bare `<input type="file">` put “Choose File / No file chosen” in system
 * type in the middle of the panel. This is the same input — it is still a real
 * file input, so the picker, the keyboard and assistive technology all behave
 * exactly as they do natively — moved off-screen behind a ruled target row that
 * carries the product's own button, the chosen filename, and the states the
 * rest of the system has: hover, focus, disabled, busy, and a drop target.
 *
 * The file itself never leaves the browser; the caller reads it and sends only
 * what the parser derived. See `academicWorkText` in page.tsx.
 */

import { useId, useState } from 'react'
import { UploadIcon } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'

export function FilePicker({
  label,
  hint,
  accept,
  busy = false,
  invalid = false,
  chooseLabel = 'Choose PDF',
  busyLabel = 'Reading…',
  onFile
}: {
  label: string
  hint: React.ReactNode
  accept: string
  busy?: boolean
  invalid?: boolean
  chooseLabel?: string
  busyLabel?: string
  onFile: (file: File) => void | Promise<void>
}) {
  const id = useId()
  const [name, setName] = useState<string | null>(null)
  const [over, setOver] = useState(false)

  const take = (file: File | null | undefined) => {
    if (!file || busy) return
    setName(file.name)
    void onFile(file)
  }

  return (
    <div className="flex flex-col gap-2">
      {/* Not a `<label>`: the row below is, and the input takes its name from
          `aria-label` so it is announced as the document being asked for
          rather than as “Choose PDF or drop the file here”. */}
      <p className="w-fit text-[12px] font-semibold">{label}</p>
      {/* The row is the label: a click anywhere on it opens the picker, and the
          input inside it carries the focus ring for the whole row. */}
      <label
        htmlFor={id}
        data-invalid={invalid || undefined}
        className={`group/file flex flex-wrap items-center gap-4 rounded-sm border px-4 py-3 transition-colors
          has-[input:focus-visible]:border-ring has-[input:focus-visible]:ring-ring/50 has-[input:focus-visible]:ring-2
          data-[invalid=true]:border-destructive
          has-[input:disabled]:pointer-events-none has-[input:disabled]:opacity-50
          ${over ? 'border-primary bg-primary/5' : 'hover:bg-card cursor-pointer'}`}
        onDragOver={(event) => {
          if (busy) return
          event.preventDefault()
          setOver(true)
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(event) => {
          event.preventDefault()
          setOver(false)
          take(event.dataTransfer?.files?.[0])
        }}
      >
        <input
          id={id}
          type="file"
          accept={accept}
          disabled={busy}
          aria-label={label}
          aria-describedby={`${id}-hint`}
          aria-invalid={invalid || undefined}
          className="sr-only"
          onChange={(event) => {
            const file = event.target.files?.[0]
            event.target.value = ''
            take(file)
          }}
        />
        <span className={`${buttonVariants({ variant: 'outline', size: 'sm' })} pointer-events-none group-hover/file:bg-muted text-[13.5px]`}>
          {busy ? <Spinner data-icon="inline-start" /> : <UploadIcon data-icon="inline-start" />}
          {busy ? busyLabel : chooseLabel}
        </span>
        <span className="text-muted-foreground min-w-0 flex-1 truncate text-[13.5px]">
          {name ?? 'or drop the file here'}
        </span>
      </label>
      <p id={`${id}-hint`} className="text-muted-foreground flex items-center gap-1.5 text-[12.5px] leading-relaxed">{hint}</p>
    </div>
  )
}
