import { snapWorldToGrid } from './gridSnap.js'
import { worldFromCanvasLocal } from './workspaceCoords.js'

/**
 * @param {{ x: number; y: number }[]} points
 * @param {number} lx
 * @param {number} ly
 * @param {{ x: number; y: number }} pan
 * @param {number} zoom
 * @param {number} snapPx
 */
export function findNearbyPoint(points, lx, ly, pan, zoom, snapPx) {
  const z = zoom || 1
  const t = snapPx * snapPx
  let best = null
  let bestD = t
  for (const p of points) {
    const sx = p.x * z + pan.x
    const sy = p.y * z + pan.y
    const dx = sx - lx
    const dy = sy - ly
    const d = dx * dx + dy * dy
    if (d <= bestD) {
      bestD = d
      best = p
    }
  }
  return best
}

/**
 * Raw world under cursor (not grid-snapped).
 */
export function rawWorldFromCanvas(lx, ly, pan, zoom = 1) {
  return worldFromCanvasLocal({ x: lx, y: ly }, pan, zoom)
}

/**
 * Resolve a click into an existing point hit or a new world position.
 * Returns null if strict mode blocks creating a new point off empty space.
 */
export function resolvePlacement(
  lx,
  ly,
  pan,
  zoom,
  points,
  snapPx,
  snapToGrid,
  gridStep,
  strictPointsOnly,
) {
  const near = findNearbyPoint(points, lx, ly, pan, zoom, snapPx)
  if (near) {
    return {
      x: near.x,
      y: near.y,
      pointId: near.id,
      isNewPoint: false,
    }
  }
  if (strictPointsOnly) return null

  let w = rawWorldFromCanvas(lx, ly, pan, zoom)
  w = snapWorldToGrid(w.x, w.y, gridStep, snapToGrid)
  return { x: w.x, y: w.y, pointId: null, isNewPoint: true }
}

/**
 * Cursor-based world pick (snaps to nearby point coords or raw world + grid).
 */
export function pickWorldAtCursor(
  lx,
  ly,
  pan,
  zoom,
  points,
  snapPx,
  snapToGrid,
  gridStep,
) {
  const near = findNearbyPoint(points, lx, ly, pan, zoom, snapPx)
  if (near) return { x: near.x, y: near.y }
  let w = rawWorldFromCanvas(lx, ly, pan, zoom)
  w = snapWorldToGrid(w.x, w.y, gridStep, snapToGrid)
  return w
}

/** Second endpoint of a segment from A toward B with optional fixed length (world units). */
export function constrainSegmentEnd(ax, ay, bx, by, fixedLength) {
  if (fixedLength == null || fixedLength <= 0) return { x: bx, y: by }
  const dx = bx - ax
  const dy = by - ay
  const d = Math.hypot(dx, dy)
  if (d < 1e-6) return { x: ax + fixedLength, y: ay }
  const ux = dx / d
  const uy = dy / d
  return { x: ax + ux * fixedLength, y: ay + uy * fixedLength }
}

export function circleRadiusFromCursor(cx, cy, wx, wy, fixedRadius) {
  if (fixedRadius != null && fixedRadius > 0) return fixedRadius
  const r = Math.hypot(wx - cx, wy - cy)
  return r
}
