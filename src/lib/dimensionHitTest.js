/** World-space offset from segment midpoint (matches drawWorkspace driving dimensions). */
export const DRIVING_DIM_OFFSET_WORLD = 14

/**
 * @param {object} dim
 * @param {object} data
 * @returns {{ x: number; y: number } | null}
 */
export function drivingDistanceLabelWorld(dim, data) {
  if (dim.type !== 'distance' || !dim.targets?.[0]) return null
  const seg = (data.segments ?? []).find((s) => s.id === dim.targets[0])
  if (!seg) return null
  const pmap = new Map((data.points ?? []).map((p) => [p.id, p]))
  const a = pmap.get(seg.a)
  const b = pmap.get(seg.b)
  if (!a || !b) return null
  const mx = (a.x + b.x) / 2
  const my = (a.y + b.y) / 2
  const dx = b.x - a.x
  const dy = b.y - a.y
  const len = Math.hypot(dx, dy)
  if (len < 1e-12) return null
  const nx = -dy / len
  const ny = dx / len
  return {
    x: mx + nx * DRIVING_DIM_OFFSET_WORLD,
    y: my + ny * DRIVING_DIM_OFFSET_WORLD,
  }
}

/**
 * @param {number} wx
 * @param {number} wy
 * @param {object} data
 * @param {number} tolWorld hit radius in world units
 * @returns {string | null} dimension id
 */
export function hitDrivingDistanceDimension(wx, wy, data, tolWorld) {
  const dims = data.dimensions ?? []
  let bestId = null
  let bestD = Infinity
  for (const dim of dims) {
    if (dim.type !== 'distance') continue
    const p = drivingDistanceLabelWorld(dim, data)
    if (!p) continue
    const d = Math.hypot(wx - p.x, wy - p.y)
    if (d <= tolWorld && d < bestD) {
      bestD = d
      bestId = dim.id
    }
  }
  return bestId
}
