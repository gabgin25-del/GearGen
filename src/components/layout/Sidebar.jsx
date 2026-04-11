import { FolderOpen, FunctionSquare, PenTool, Settings2 } from 'lucide-react'
import { NAV_IDS } from './sidebarNav.js'

const navItems = [
  { id: NAV_IDS.drawing, icon: PenTool, label: 'Drawing' },
  { id: NAV_IDS.savedSketches, icon: FolderOpen, label: 'Saved Sketches' },
  { id: NAV_IDS.desmos, icon: FunctionSquare, label: 'Desmos' },
  { id: NAV_IDS.gearMaking, icon: Settings2, label: 'Gear Making' },
]

/**
 * @param {{
 *   activeTab: string
 *   onTabChange: (id: string) => void
 *   drawingPanel: import('react').ReactNode
 *   savedSketchesPanel: import('react').ReactNode
 *   desmosPanel: import('react').ReactNode
 *   gearMakingPanel: import('react').ReactNode
 * }} props
 */
export function Sidebar({
  activeTab,
  onTabChange,
  drawingPanel,
  savedSketchesPanel,
  desmosPanel,
  gearMakingPanel,
}) {
  return (
    <aside className="flex h-full w-[232px] shrink-0 flex-col border-r border-gg-border bg-gg-sidebar">
      <div className="flex items-center gap-2 border-b border-gg-border px-4 py-3.5">
        <div className="flex size-8 items-center justify-center rounded-md bg-gg-accent-soft text-gg-accent">
          <PenTool className="size-[18px]" strokeWidth={2} />
        </div>
        <div className="text-left">
          <div className="text-[13px] font-semibold tracking-tight text-gg-text">
            GearGen
          </div>
          <div className="text-[11px] text-gg-muted">Graph workspace</div>
        </div>
      </div>

      <nav className="flex shrink-0 flex-col gap-0.5 p-2" aria-label="Main">
        {navItems.map((item) => {
          const Icon = item.icon
          const active = activeTab === item.id
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onTabChange(item.id)}
              className={[
                'flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-[13px] transition-colors',
                active
                  ? 'bg-white/[0.08] text-gg-text'
                  : 'text-gg-muted hover:bg-gg-sidebar-hover hover:text-gg-text',
              ].join(' ')}
            >
              <Icon className="size-4 shrink-0 opacity-90" strokeWidth={1.75} />
              {item.label}
            </button>
          )
        })}
      </nav>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden border-t border-gg-border/80">
        {activeTab === NAV_IDS.drawing ? (
          <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
            {drawingPanel}
          </div>
        ) : activeTab === NAV_IDS.savedSketches ? (
          <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
            {savedSketchesPanel}
          </div>
        ) : activeTab === NAV_IDS.desmos ? (
          <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
            {desmosPanel}
          </div>
        ) : activeTab === NAV_IDS.gearMaking ? (
          <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
            {gearMakingPanel}
          </div>
        ) : null}
      </div>
    </aside>
  )
}
