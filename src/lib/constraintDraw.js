/** @typedef {{ kind: string; id: string }} TargetRef */

import { drawConstraintIconOnCanvas } from './constraintIconsCanvas.js'

class UnionFind {
  constructor() {
    /** @type {Map<string, string>} */
    this.p = new Map()
  }
  /** @param {string} x */
  find(x) {
    if (!this.p.has(x)) this.p.set(x, x)
    const px = this.p.get(x)
    if (px === x) return x
    const r = this.find(px)
    this.p.set(x, r)
    return r
  }
  /** @param {string} a @param {string} b */
  union(a, b) {
    const ra = this.find(a)
    const rb = this.find(b)
    if (ra !== rb) this.p.set(ra, rb)
  }
}

/**
 * @param {{ type: string; targets?: TargetRef[] }[]} constraints
 * @param {'equal' | 'parallel'} kind
 */
function segmentGroupRanks(constraints, kind) {
  const uf = new UnionFind()
  const involved = new Set()
  for (const c of constraints) {
    if (c.type !== kind) continue
    const t = c.targets ?? []
    if (
      t.length === 2 &&
      t[0].kind === 'segment' &&
      t[1].kind === 'segment'
    ) {
      uf.union(t[0].id, t[1].id)
      involved.add(t[0].id)
      involved.add(t[1].id)
    }
  }
  const roots = new Set()
  for (const id of involved) {
    roots.add(uf.find(id))
  }
  const sortedRoots = [...roots].sort()
  /** @type {Map<string, number>} */
  const rank = new Map()
  sortedRoots.forEach((r, i) => rank.set(r, i + 1))
  /** @type {Map<string, number>} */
  const segRank = new Map()
  for (const id of involved) {
    segRank.set(id, rank.get(uf.find(id)) ?? 1)
  }
  return segRank
}

/**
 * Per-type serial: first Horizontal = 1, second = 2, etc.
 * @param {{ id?: string; type: string }[]} constraints
 */
function buildConstraintSerialById(constraints) {
  const next = new Map()
  /** @type {Map<string, number>} */
  const serialById = new Map()
  for (const co of constraints) {
    const t = co.type
    const n = (next.get(t) ?? 0) + 1
    next.set(t, n)
    if (co.id) serialById.set(co.id, n)
  }
  return serialById
}

/**
 * @param {number} ax @param {number} ay @param {number} bx @param {number} by
 * @param {number} cx @param {number} cy @param {number} dx @param {number} dy
 */
function lineIntersection(ax, ay, bx, by, cx, cy, dx, dy) {
  const r = bx - ax
  const s = by - ay
  const t = dx - cx
  const u = dy - cy
  const den = r * u - s * t
  if (Math.abs(den) < 1e-9) return null
  const qx = cx - ax
  const qy = cy - ay
  const w = (qx * u - qy * t) / den
  return { x: ax + w * r, y: ay + w * s }
}

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} z zoom (world → screen)
 * @param {string} type relation id
 * @param {number} serial
 * @param {{ relationFill: string; relationStroke: string; relationText: string }} pal
 */
function drawConstraintBadge(ctx, z, wx, wy, type, serial, pal) {
  ctx.save()
  ctx.translate(wx, wy)
  ctx.scale(1 / z, 1 / z)
  const half = 8
  ctx.fillStyle = pal.relationFill
  ctx.strokeStyle = pal.relationStroke
  ctx.lineWidth = Math.max(1, 1.2)
  ctx.fillRect(-half, -half, 2 * half, 2 * half)
  ctx.strokeRect(-half, -half, 2 * half, 2 * half)
  ctx.strokeStyle = pal.relationStroke
  ctx.fillStyle = pal.relationText
  drawConstraintIconOnCanvas(ctx, type)
  if (serial > 0) {
    ctx.fillStyle = pal.relationText
    ctx.font = '600 6.5px Inter, system-ui, sans-serif'
    ctx.textAlign = 'right'
    ctx.textBaseline = 'bottom'
    ctx.fillText(String(serial), half - 1.25, half - 0.5)
  }
  ctx.restore()
}

/**
 * ANSI-style right-angle marker: small square in the corner, edges parallel to the two segments.
 * @param {{ x: number; y: number }} I intersection (world)
 * @param {{ ux: number; uy: number }} u0 first segment unit direction
 * @param {{ ux: number; uy: number }} u1 second segment unit direction
 */
function drawPerpendicularCornerBox(ctx, z, I, u0, u1, pal) {
  let u0x = u0.ux
  let u0y = u0.uy
  let u1x = u1.ux
  let u1y = u1.uy
  const cross = u0x * u1y - u0y * u1x
  if (cross < 0) {
    u1x = -u1x
    u1y = -u1y
  }
  const L = 12 / (z || 1)
  const lw = Math.max(1.15, 2 / (z || 1))
  ctx.save()
  ctx.lineWidth = lw
  ctx.strokeStyle = pal.relationStroke
  ctx.fillStyle = pal.relationFill
  ctx.beginPath()
  ctx.moveTo(I.x, I.y)
  ctx.lineTo(I.x + u0x * L, I.y + u0y * L)
  ctx.lineTo(I.x + u0x * L + u1x * L, I.y + u0y * L + u1y * L)
  ctx.lineTo(I.x + u1x * L, I.y + u1y * L)
  ctx.closePath()
  ctx.fill()
  ctx.stroke()
  ctx.restore()
}

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} z zoom
 * @param {{
 *   constraints: { id?: string; type: string; targets?: TargetRef[] }[]
 *   segments: { id: string; a: string; b: string }[]
 *   points: { id: string; x: number; y: number }[]
 *   circles: { id: string; cx?: number; cy?: number; r: number; centerId?: string | null }[]
 *   resolvedCircles: { id: string; cx: number; cy: number; r: number }[]
 * }} p
 * @param {{ relationFill: string; relationStroke: string; relationText: string }} pal
 */
export function drawConstraintDecorations(ctx, z, p, pal) {
  const { constraints, segments, points, resolvedCircles } = p
  const pointById = new Map(points.map((pt) => [pt.id, pt]))
  const equalRank = segmentGroupRanks(constraints, 'equal')
  const parallelRank = segmentGroupRanks(constraints, 'parallel')
  const serialById = buildConstraintSerialById(constraints)

  const lw = Math.max(1.15, 2 / z)
  const tickLen = 11 / z
  const spread = 16 / z

  function segGeom(segId) {
    const seg = segments.find((s) => s.id === segId)
    if (!seg) return null
    const pa = pointById.get(seg.a)
    const pb = pointById.get(seg.b)
    if (!pa || !pb) return null
    const dx = pb.x - pa.x
    const dy = pb.y - pa.y
    const L = Math.hypot(dx, dy)
    if (L < 1e-9) return null
    const ux = dx / L
    const uy = dy / L
    const vx = -uy
    const vy = ux
    const mx = (pa.x + pb.x) / 2
    const my = (pa.y + pb.y) / 2
    return { pa, pb, ux, uy, vx, vy, mx, my, L }
  }

  /** @type {Set<string>} */
  const drawnPerp = new Set()

  for (const co of constraints) {
    const serial = (co.id && serialById.get(co.id)) || 0
    const targets = co.targets ?? []

    if (co.type === 'fixOrigin' && targets.length === 1 && targets[0].kind === 'point') {
      const pA = pointById.get(targets[0].id)
      if (pA) drawConstraintBadge(ctx, z, pA.x, pA.y, co.type, serial, pal)
      continue
    }

    if (
      co.type === 'similar' &&
      targets.length === 2 &&
      targets[0].kind === 'segment' &&
      targets[1].kind === 'segment'
    ) {
      const g = segGeom(targets[1].id)
      if (g) drawConstraintBadge(ctx, z, g.mx, g.my, co.type, serial, pal)
      continue
    }

    if (
      co.type === 'tangent' &&
      targets.length === 2 &&
      targets[0].kind === 'segment' &&
      targets[1].kind === 'circle'
    ) {
      const g = segGeom(targets[0].id)
      if (g) drawConstraintBadge(ctx, z, g.mx, g.my, co.type, serial, pal)
      continue
    }

    if (co.type === 'perpendicular' && targets.length === 2) {
      const k = [targets[0].id, targets[1].id].sort().join('|')
      if (drawnPerp.has(k)) continue
      drawnPerp.add(k)
      if (targets[0].kind !== 'segment' || targets[1].kind !== 'segment')
        continue
      const g0 = segGeom(targets[0].id)
      const g1 = segGeom(targets[1].id)
      if (!g0 || !g1) continue
      const I = lineIntersection(
        g0.pa.x,
        g0.pa.y,
        g0.pb.x,
        g0.pb.y,
        g1.pa.x,
        g1.pa.y,
        g1.pb.x,
        g1.pb.y,
      )
      if (!I) continue
      drawPerpendicularCornerBox(ctx, z, I, g0, g1, pal)
      continue
    }

    if (
      co.type === 'collinear' &&
      targets.length === 2 &&
      targets[0].kind === 'segment' &&
      targets[1].kind === 'segment'
    ) {
      const g0 = segGeom(targets[0].id)
      const g1 = segGeom(targets[1].id)
      if (!g0 || !g1) continue
      const I = lineIntersection(
        g0.pa.x,
        g0.pa.y,
        g0.pb.x,
        g0.pb.y,
        g1.pa.x,
        g1.pa.y,
        g1.pb.x,
        g1.pb.y,
      )
      if (!I) continue
      drawConstraintBadge(ctx, z, I.x, I.y, co.type, serial, pal)
      continue
    }

    if (
      (co.type === 'tangent' || co.type === 'symmetric') &&
      targets.length >= 2 &&
      targets[0].kind === 'segment'
    ) {
      const g = segGeom(targets[0].id)
      if (g) drawConstraintBadge(ctx, z, g.mx, g.my, co.type, serial, pal)
      continue
    }

    if (
      (co.type === 'horizontal' || co.type === 'vertical') &&
      targets.length >= 2 &&
      targets.every((t) => t.kind === 'point')
    ) {
      let sx = 0
      let sy = 0
      let n = 0
      for (const t of targets) {
        const pA = pointById.get(t.id)
        if (pA) {
          sx += pA.x
          sy += pA.y
          n += 1
        }
      }
      if (n > 0) {
        drawConstraintBadge(ctx, z, sx / n, sy / n, co.type, serial, pal)
      }
      continue
    }

    if (
      (co.type === 'horizontal' || co.type === 'vertical') &&
      targets.length === 1 &&
      targets[0].kind === 'segment'
    ) {
      const g = segGeom(targets[0].id)
      if (g) drawConstraintBadge(ctx, z, g.mx, g.my, co.type, serial, pal)
      continue
    }

    if (
      co.type === 'coincident' &&
      targets.length === 2 &&
      targets[0].kind === 'point' &&
      targets[1].kind === 'point'
    ) {
      const pA = pointById.get(targets[0].id)
      const pB = pointById.get(targets[1].id)
      if (pA && pB) {
        drawConstraintBadge(
          ctx,
          z,
          (pA.x + pB.x) / 2,
          (pA.y + pB.y) / 2,
          co.type,
          serial,
          pal,
        )
      }
      continue
    }

    if (co.type === 'coincident' && targets.length === 2) {
      const curveKinds = new Set(['segment', 'circle', 'arc'])
      if (targets[0].kind === 'point' && curveKinds.has(targets[1].kind)) {
        const pA = pointById.get(targets[0].id)
        if (pA) drawConstraintBadge(ctx, z, pA.x, pA.y, co.type, serial, pal)
        continue
      }
      if (targets[1].kind === 'point' && curveKinds.has(targets[0].kind)) {
        const pA = pointById.get(targets[1].id)
        if (pA) drawConstraintBadge(ctx, z, pA.x, pA.y, co.type, serial, pal)
        continue
      }
    }

    if (
      co.type === 'concentric' &&
      targets.length === 2 &&
      targets[0].kind === 'circle'
    ) {
      const c0 = resolvedCircles.find((c) => c.id === targets[0].id)
      const c1 = resolvedCircles.find((c) => c.id === targets[1].id)
      if (!c0 || !c1) continue
      drawConstraintBadge(
        ctx,
        z,
        (c0.cx + c1.cx) / 2,
        (c0.cy + c1.cy) / 2,
        co.type,
        serial,
        pal,
      )
      continue
    }

    if (
      co.type === 'equal' &&
      targets.length === 2 &&
      targets[0].kind === 'circle' &&
      targets[1].kind === 'circle'
    ) {
      const c0 = resolvedCircles.find((c) => c.id === targets[0].id)
      const c1 = resolvedCircles.find((c) => c.id === targets[1].id)
      if (!c0 || !c1) continue
      drawConstraintBadge(
        ctx,
        z,
        (c0.cx + c1.cx) / 2,
        (c0.cy + c1.cy) / 2,
        co.type,
        serial,
        pal,
      )
      continue
    }
  }

  for (const seg of segments) {
    const g = segGeom(seg.id)
    if (!g) continue
    const eN = equalRank.get(seg.id) ?? 0
    const pN = parallelRank.get(seg.id) ?? 0
    if (eN === 0 && pN === 0) continue
    const total = eN + pN
    const u = { x: g.ux, y: g.uy }
    const v = { x: g.vx, y: g.vy }
    ctx.strokeStyle = pal.relationStroke
    ctx.lineWidth = lw
    let idx = 0
    for (let i = 0; i < eN; i++) {
      const t = total === 1 ? 0 : (idx / (total - 1) - 0.5) * 2 * spread
      idx++
      const ox = g.mx + u.x * t
      const oy = g.my + u.y * t
      ctx.beginPath()
      ctx.moveTo(ox - v.x * tickLen * 0.5, oy - v.y * tickLen * 0.5)
      ctx.lineTo(ox + v.x * tickLen * 0.5, oy + v.y * tickLen * 0.5)
      ctx.stroke()
    }
    ctx.fillStyle = pal.relationStroke
    const ah = 6.2 / z
    const aw = 4 / z
    for (let i = 0; i < pN; i++) {
      const t = total === 1 ? 0 : (idx / (total - 1) - 0.5) * 2 * spread
      idx++
      const ox = g.mx + u.x * t
      const oy = g.my + u.y * t
      ctx.beginPath()
      ctx.moveTo(ox + u.x * ah, oy + u.y * ah)
      ctx.lineTo(ox - u.x * ah * 0.35 + v.x * aw, oy - u.y * ah * 0.35 + v.y * aw)
      ctx.lineTo(ox - u.x * ah * 0.35 - v.x * aw, oy - u.y * ah * 0.35 - v.y * aw)
      ctx.closePath()
      ctx.fill()
    }
  }
}
