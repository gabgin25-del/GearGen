import { circleWithResolvedCenter } from './circleResolve.js'
import { linearDistanceAnchorPoints } from './dimensionGeometry.js'
import { ANSI_EXT_GAP_WORLD } from './DimensionRenderer.js'

/** Default offset of dimension line from measured chord (world). */
export const DRIVING_DIM_OFFSET_WORLD = 14

const ARROW_LEN = 9

/**
 * @param {object} dim
 * @param {object} data
 * @param {number} zoom
 * @returns {{ x: number; y: number } | null}
 */
export function drivingDimensionLabelWorld(dim, data, zoom) {
  const z = zoom || 1
  const segments = data.segments ?? []
  const pointById = new Map((data.points ?? []).map((p) => [p.id, p]))
  const circles = data.circles ?? []

  if (dim.type === 'distance') {
    const anchors = linearDistanceAnchorPoints(dim, data)
    if (!anchors) return null
    const { ax, ay, bx, by } = anchors
    const mx = (ax + bx) / 2
    const my = (ay + by) / 2
    const dx = bx - ax
    const dy = by - ay
    const len = Math.hypot(dx, dy)
    if (len < 1e-12) return null
    const nx = -dy / len
    const ny = dx / len
    const off = dim.offsetWorld ?? DRIVING_DIM_OFFSET_WORLD
    return {
      x: mx + nx * off,
      y: my + ny * off,
    }
  }

  if (
    (dim.type === 'radius' || dim.type === 'diameter') &&
    dim.targets?.[0]
  ) {
    const c = circles.find((x) => x.id === dim.targets[0])
    if (!c) return null
    const rc = circleWithResolvedCenter(c, pointById)
    if (rc.r < 1e-9) return null
    const { cx, cy, r } = rc
    const gap = ANSI_EXT_GAP_WORLD
    const p0x = cx + (r + gap)
    const p0y = cy
    const p1x = cx + (r + gap + ARROW_LEN / z + 22 / z)
    const midX = (p0x + p1x) / 2
    return { x: midX, y: cy - 8 / z }
  }

  if (dim.type === 'angle' && dim.targets?.length === 3) {
    const [idC, idA, idB] = dim.targets
    const C = pointById.get(idC)
    const A = pointById.get(idA)
    const B = pointById.get(idB)
    if (!C || !A || !B) return null
    const a0 = Math.atan2(A.y - C.y, A.x - C.x)
    const a1 = Math.atan2(B.y - C.y, B.x - C.x)
    const da = Math.hypot(A.x - C.x, A.y - C.y)
    const db = Math.hypot(B.x - C.x, B.y - C.y)
    const rr = Math.min(da, db, 48) * 0.35
    const r = Math.max(12 / z, rr)
    const mid =
      (a0 + a1) / 2 + (Math.abs(a1 - a0) > Math.PI ? Math.PI : 0)
    return {
      x: C.x + Math.cos(mid) * (r + 10 / z),
      y: C.y + Math.sin(mid) * (r + 10 / z),
    }
  }

  if (
    dim.type === 'angle' &&
    dim.targets?.length === 2 &&
    typeof dim.targets[0] === 'object'
  ) {
    const s0 = segments.find((s) => s.id === dim.targets[0].id)
    const s1 = segments.find((s) => s.id === dim.targets[1].id)
    if (!s0 || !s1) return null
    const p00 = pointById.get(s0.a)
    const p01 = pointById.get(s0.b)
    const p10 = pointById.get(s1.a)
    const p11 = pointById.get(s1.b)
    if (!p00 || !p01 || !p10 || !p11) return null
    const vx = (p00.x + p01.x + p10.x + p11.x) / 4
    const vy = (p00.y + p01.y + p10.y + p11.y) / 4
    const u0x = p01.x - p00.x
    const u0y = p01.y - p00.y
    const u1x = p11.x - p10.x
    const u1y = p11.y - p10.y
    const L0 = Math.hypot(u0x, u0y) || 1
    const L1 = Math.hypot(u1x, u1y) || 1
    const aa0 = Math.atan2(u0y / L0, u0x / L0)
    const aa1 = Math.atan2(u1y / L1, u1x / L1)
    const r = 28 / z
    const mid =
      (aa0 + aa1) / 2 + (Math.abs(aa1 - aa0) > Math.PI ? Math.PI : 0)
    return {
      x: vx + Math.cos(mid) * (r + 10 / z),
      y: vy + Math.sin(mid) * (r + 10 / z),
    }
  }

  return null
}

/**
 * @param {number} wx
 * @param {number} wy
 * @param {object} data
 * @param {number} tolWorld
 * @param {number} zoom
 * @returns {string | null} dimension id
 */
export function hitDrivingDimension(wx, wy, data, tolWorld, zoom) {
  const dims = data.dimensions ?? []
  let bestId = null
  let bestD = Infinity
  for (const dim of dims) {
    const p = drivingDimensionLabelWorld(dim, data, zoom)
    if (!p) continue
    const d = Math.hypot(wx - p.x, wy - p.y)
    if (d <= tolWorld && d < bestD) {
      bestD = d
      bestId = dim.id
    }
  }
  return bestId
}

/**
 * @deprecated Prefer {@link hitDrivingDimension} (all driving dimension types).
 */
export function hitDrivingDistanceDimension(wx, wy, data, tolWorld, zoom = 1) {
  return hitDrivingDimension(wx, wy, data, tolWorld, zoom)
}
