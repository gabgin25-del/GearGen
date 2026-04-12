import { ChevronDown, ChevronRight } from 'lucide-react'

/**
 * Compact Drawing sidebar: registered geometry only. Primitives and relations
 * live in the canvas ribbon when the Drawing tab is active.
 *
 * @param {{
 *   ribbonSectionsOpen?: Record<string, boolean>
 *   onRibbonSectionToggle: (k: string) => void
 *   registeredShapesSlot?: import('react').ReactNode
 * }} props
 */
export function DrawingToolsPanel({
  ribbonSectionsOpen,
  onRibbonSectionToggle,
  registeredShapesSlot,
}) {
  const sections = ribbonSectionsOpen ?? { registered: true }
  const open = sections.registered !== false

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto overflow-x-hidden p-2 text-[12px] text-gg-text">
      <p className="text-[11px] leading-snug text-gg-muted">
        Use the ribbon under the canvas toolbar for sketch tools, curves, shapes,
        and relations. This panel lists shapes registered for constraints and
        fills.
      </p>
      {registeredShapesSlot ? (
        <div className="flex min-w-0 flex-col rounded-md border border-gg-border/60 bg-gg-workspace/25">
          <button
            type="button"
            title="Registered"
            onClick={() => onRibbonSectionToggle('registered')}
            className="flex w-full flex-row items-center gap-1 px-2 py-1.5 text-left text-[10px] font-semibold uppercase leading-tight tracking-wide text-gg-muted transition-colors hover:bg-white/[0.06] hover:text-gg-text"
            aria-expanded={open}
          >
            {open ? (
              <ChevronDown className="size-3 shrink-0 opacity-80" strokeWidth={2} />
            ) : (
              <ChevronRight className="size-3 shrink-0 opacity-80" strokeWidth={2} />
            )}
            <span>Registered</span>
          </button>
          {open ? (
            <div className="border-t border-gg-border/40 px-2 py-2">
              {registeredShapesSlot}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
