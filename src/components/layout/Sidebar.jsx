import {
  Box,
  ClipboardList,
  FileJson,
  FolderOpen,
  Layers,
  Shapes,
} from 'lucide-react'

const NAV_IDS = {
  gears: 'gears',
  stacks: 'stacks',
  projects: 'projects',
  library: 'library',
  registered: 'registered',
  sketches: 'sketches',
}

const navItems = [
  { id: NAV_IDS.gears, icon: Shapes, label: 'Gears' },
  { id: NAV_IDS.stacks, icon: Layers, label: 'Stacks' },
  { id: NAV_IDS.projects, icon: FolderOpen, label: 'Projects' },
  { id: NAV_IDS.library, icon: Box, label: 'Library' },
  { id: NAV_IDS.sketches, icon: FileJson, label: 'Sketches' },
  { id: NAV_IDS.registered, icon: ClipboardList, label: 'Registered' },
]

/**
 * @param {{
 *   activeTab: string
 *   onTabChange: (id: string) => void
 *   registeredPanel: import('react').ReactNode
 *   sketchesPanel: import('react').ReactNode
 * }} props
 */
export function Sidebar({ activeTab, onTabChange, registeredPanel, sketchesPanel }) {
  return (
    <aside className="flex h-full w-[220px] shrink-0 flex-col border-r border-gg-border bg-gg-sidebar">
      <div className="flex items-center gap-2 border-b border-gg-border px-4 py-3.5">
        <div className="flex size-8 items-center justify-center rounded-md bg-gg-accent-soft text-gg-accent">
          <Shapes className="size-[18px]" strokeWidth={2} />
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
        {activeTab === NAV_IDS.sketches ? (
          <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
            {sketchesPanel}
          </div>
        ) : activeTab === NAV_IDS.registered ? (
          <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden p-2">
            {registeredPanel}
          </div>
        ) : (
          <div className="overflow-y-auto overflow-x-hidden p-3 text-[12px] leading-relaxed text-gg-muted">
            {activeTab === NAV_IDS.gears && (
              <span>
                Gear and mechanism tools will live here. Use the canvas to sketch
                geometry.
              </span>
            )}
            {activeTab === NAV_IDS.stacks && (
              <span>Stack presets and ordering — coming soon.</span>
            )}
            {activeTab === NAV_IDS.projects && (
              <span>Save and open projects — coming soon.</span>
            )}
            {activeTab === NAV_IDS.library && (
              <span>Reusable parts library — coming soon.</span>
            )}
          </div>
        )}
      </div>
    </aside>
  )
}
