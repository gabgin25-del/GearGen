import { ChevronDown } from 'lucide-react'
import { useId, useState } from 'react'

function readPersistedOpen(persistKey, defaultOpen) {
  if (!persistKey) return defaultOpen
  try {
    const s = localStorage.getItem(persistKey)
    if (s === '0') return false
    if (s === '1') return true
  } catch {
    /* ignore */
  }
  return defaultOpen
}

function persistOpen(persistKey, open) {
  if (!persistKey) return
  try {
    localStorage.setItem(persistKey, open ? '1' : '0')
  } catch {
    /* ignore */
  }
}

/**
 * @param {{
 *   title: string
 *   defaultOpen?: boolean
 *   persistKey?: string
 *   className?: string
 *   headerClassName?: string
 *   bodyClassName?: string
 *   children: import('react').ReactNode
 * }} props
 */
export function CollapsibleSection({
  title,
  defaultOpen = true,
  persistKey,
  className = '',
  headerClassName = '',
  bodyClassName = '',
  children,
}) {
  const [open, setOpen] = useState(() =>
    readPersistedOpen(persistKey, defaultOpen),
  )
  const panelId = useId()

  const toggle = () => {
    setOpen((v) => {
      const next = !v
      persistOpen(persistKey, next)
      return next
    })
  }

  return (
    <div className={className}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={toggle}
        className={[
          'flex w-full min-w-0 items-center gap-1.5 rounded-md px-1 py-1 text-left transition-colors hover:bg-white/[0.06]',
          headerClassName,
        ].join(' ')}
      >
        <ChevronDown
          className={[
            'size-4 shrink-0 text-gg-muted transition-transform duration-150',
            open ? '' : '-rotate-90',
          ].join(' ')}
          strokeWidth={2}
          aria-hidden
        />
        <span className="text-[11px] font-medium uppercase tracking-wide text-gg-muted">
          {title}
        </span>
      </button>
      {open ? (
        <div id={panelId} className={bodyClassName}>
          {children}
        </div>
      ) : null}
    </div>
  )
}
