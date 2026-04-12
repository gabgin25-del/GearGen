/**
 * Desmos sidebar slot: graph and export actions live in the main Desmos view.
 */
export function DesmosPanel() {
  return (
    <div
      className="flex min-h-0 flex-1 flex-col p-2"
      role="note"
      aria-label="Use the graph area to enter expressions. Right-click a filled region to export it to Saved Sketches."
    />
  )
}
