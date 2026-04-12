/**
 * ANSI Y14.5–style dimension graphics (extension lines, 3:1 arrowheads, gap from geometry).
 * World-space drawing; caller sets ctx transform (pan/zoom) already applied.
 *
 * Gap / overshoot per typical inch–metric lecture conversions (~1/16" ≈ 1.5 mm, ~1/8" ≈ 3 mm),
 * expressed in sketch world units (treat 1 unit ≈ 1 mm for readable prints).
 * Horizontal dimensions use horizontal leader shoulders between extension and dimension line.
 */

/** Visible gap from object to extension line start. */
export const ANSI_EXT_GAP_WORLD = 1.5
/** Extension line extends past the dimension line. */
export const ANSI_EXT_OVERSHOOT_WORLD = 3

const ARROW_LEN = 9
const ARROW_WIDTH = ARROW_LEN / 3

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x1
 * @param {number} y1
 * @param {number} x2
 * @param {number} y2
 * @param {number} zoom
 */
function drawArrowHead(ctx, x1, y1, x2, y2, zoom) {
  const dx = x2 - x1
  const dy = y2 - y1
  const len = Math.hypot(dx, dy) || 1
  const ux = dx / len
  const uy = dy / len
  const px = -uy
  const py = ux
  const L = ARROW_LEN / zoom
  const W = ARROW_WIDTH / zoom
  const bx = x2 - ux * L
  const by = y2 - uy * L
  ctx.beginPath()
  ctx.moveTo(x2, y2)
  ctx.lineTo(bx + px * W, by + py * W)
  ctx.lineTo(bx - px * W, by - py * W)
  ctx.closePath()
  ctx.fill()
}

/**
 * Linear dimension between two world points; dimension line offset along normal.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {{
 *   ax: number; ay: number; bx: number; by: number
 *   zoom: number
 *   label: string
 *   theme?: 'light' | 'dark'
 *   offsetWorld?: number
 *   projection?: 'aligned' | 'horizontal' | 'vertical'
 * }} o
 */
export function drawLinearDimension(ctx, o) {
  const {
    ax,
    ay,
    bx,
    by,
    zoom,
    label,
    theme = 'dark',
    offsetWorld = 18,
    projection = 'aligned',
  } = o
  const z = zoom || 1
  const gap = ANSI_EXT_GAP_WORLD
  const ext = ANSI_EXT_OVERSHOOT_WORLD

  const dimTint =
    theme === 'light' ? 'rgba(30, 41, 59, 0.92)' : 'rgba(226, 232, 240, 0.92)'
  const extTint =
    theme === 'light' ? 'rgba(71, 85, 105, 0.75)' : 'rgba(148, 163, 184, 0.78)'

  ctx.save()
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  if (projection === 'horizontal') {
    const my = (ay + by) / 2
    const yDim = my + offsetWorld
    const syA = Math.sign(yDim - ay) || 1
    const syB = Math.sign(yDim - by) || 1
    const aExt0x = ax
    const aExt0y = ay + syA * gap
    const aExt1x = ax
    const aExt1y = yDim + syA * ext
    const bExt0x = bx
    const bExt0y = by + syB * gap
    const bExt1x = bx
    const bExt1y = yDim + syB * ext

    ctx.strokeStyle = extTint
    ctx.lineWidth = Math.max(0.35, 0.55 / z)
    ctx.beginPath()
    ctx.moveTo(ax, ay)
    ctx.lineTo(aExt0x, aExt0y)
    ctx.lineTo(aExt1x, aExt1y)
    ctx.moveTo(bx, by)
    ctx.lineTo(bExt0x, bExt0y)
    ctx.lineTo(bExt1x, bExt1y)
    ctx.stroke()

    const x1 = Math.min(ax, bx)
    const x2 = Math.max(ax, bx)
    const dimLen = x2 - x1
    const midx = (x1 + x2) / 2
    ctx.strokeStyle = dimTint
    ctx.lineWidth = Math.max(0.5, 0.75 / z)
    ctx.fillStyle = dimTint
    if (dimLen > 12 / z) {
      const hg = Math.min(dimLen * 0.2, 28 / z)
      ctx.beginPath()
      ctx.moveTo(x1, yDim)
      ctx.lineTo(midx - hg, yDim)
      ctx.moveTo(midx + hg, yDim)
      ctx.lineTo(x2, yDim)
      ctx.stroke()
      drawArrowHead(ctx, midx - hg, yDim, x1, yDim, z)
      drawArrowHead(ctx, midx + hg, yDim, x2, yDim, z)
    } else {
      ctx.beginPath()
      ctx.moveTo(x1, yDim)
      ctx.lineTo(x2, yDim)
      ctx.stroke()
      drawArrowHead(ctx, x2, yDim, x1, yDim, z)
      drawArrowHead(ctx, x1, yDim, x2, yDim, z)
    }

    ctx.save()
    ctx.translate(midx, yDim)
    ctx.scale(1 / z, 1 / z)
    const isLight = theme === 'light'
    ctx.lineWidth = 3
    ctx.strokeStyle = isLight ? 'rgba(255,255,255,0.9)' : 'rgba(15,17,23,0.85)'
    ctx.fillStyle = isLight ? 'rgba(30, 64, 175, 0.98)' : 'rgba(253, 224, 71, 0.98)'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.strokeText(label, 0, -10)
    ctx.fillText(label, 0, -10)
    ctx.restore()
    ctx.restore()
    return
  }

  if (projection === 'vertical') {
    const mx = (ax + bx) / 2
    const xDim = mx + offsetWorld
    const sxA = Math.sign(xDim - ax) || 1
    const sxB = Math.sign(xDim - bx) || 1
    ctx.strokeStyle = extTint
    ctx.lineWidth = Math.max(0.35, 0.55 / z)
    ctx.beginPath()
    ctx.moveTo(ax, ay)
    ctx.lineTo(ax + sxA * gap, ay)
    ctx.lineTo(xDim + sxA * ext, ay)
    ctx.moveTo(bx, by)
    ctx.lineTo(bx + sxB * gap, by)
    ctx.lineTo(xDim + sxB * ext, by)
    ctx.stroke()

    const y1 = Math.min(ay, by)
    const y2 = Math.max(ay, by)
    const dimLen = y2 - y1
    const midy = (y1 + y2) / 2
    ctx.strokeStyle = dimTint
    ctx.lineWidth = Math.max(0.5, 0.75 / z)
    ctx.fillStyle = dimTint
    if (dimLen > 12 / z) {
      const hg = Math.min(dimLen * 0.2, 28 / z)
      ctx.beginPath()
      ctx.moveTo(xDim, y1)
      ctx.lineTo(xDim, midy - hg)
      ctx.moveTo(xDim, midy + hg)
      ctx.lineTo(xDim, y2)
      ctx.stroke()
      drawArrowHead(ctx, xDim, midy - hg, xDim, y1, z)
      drawArrowHead(ctx, xDim, midy + hg, xDim, y2, z)
    } else {
      ctx.beginPath()
      ctx.moveTo(xDim, y1)
      ctx.lineTo(xDim, y2)
      ctx.stroke()
      drawArrowHead(ctx, xDim, y2, xDim, y1, z)
      drawArrowHead(ctx, xDim, y1, xDim, y2, z)
    }

    ctx.save()
    ctx.translate(xDim, midy)
    ctx.scale(1 / z, 1 / z)
    const isLight = theme === 'light'
    ctx.lineWidth = 3
    ctx.strokeStyle = isLight ? 'rgba(255,255,255,0.9)' : 'rgba(15,17,23,0.85)'
    ctx.fillStyle = isLight ? 'rgba(30, 64, 175, 0.98)' : 'rgba(253, 224, 71, 0.98)'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.strokeText(label, 10, 0)
    ctx.fillText(label, 10, 0)
    ctx.restore()
    ctx.restore()
    return
  }

  const dx = bx - ax
  const dy = by - ay
  const len = Math.hypot(dx, dy)
  if (len < 1e-9) {
    ctx.restore()
    return
  }
  const nx = (-dy / len) * offsetWorld
  const ny = (dx / len) * offsetWorld

  const ux = dx / len
  const uy = dy / len

  const a1x = ax + ux * gap + nx
  const a1y = ay + uy * gap + ny
  const a2x = ax + ux * (len - gap) + nx
  const a2y = ay + uy * (len - gap) + ny

  const extAx = ax + ux * gap - ux * ext + nx
  const extAy = ay + uy * gap - uy * ext + ny
  const extBx = bx - ux * gap + ux * ext + nx
  const extBy = by - uy * gap + uy * ext + ny

  ctx.strokeStyle = extTint
  ctx.lineWidth = Math.max(0.35, 0.55 / z)
  ctx.beginPath()
  ctx.moveTo(extAx, extAy)
  ctx.lineTo(a1x, a1y)
  ctx.moveTo(extBx, extBy)
  ctx.lineTo(a2x, a2y)
  ctx.stroke()

  const midx = (a1x + a2x) / 2
  const midy = (a1y + a2y) / 2
  const needBreak = len > 12 / z

  ctx.strokeStyle = dimTint
  ctx.lineWidth = Math.max(0.5, 0.75 / z)
  ctx.fillStyle = dimTint

  if (needBreak) {
    const halfGap = Math.min(len * 0.2, 28 / z)
    const c1x = midx - ux * halfGap
    const c1y = midy - uy * halfGap
    const c2x = midx + ux * halfGap
    const c2y = midy + uy * halfGap
    ctx.beginPath()
    ctx.moveTo(a1x, a1y)
    ctx.lineTo(c1x, c1y)
    ctx.moveTo(c2x, c2y)
    ctx.lineTo(a2x, a2y)
    ctx.stroke()
    drawArrowHead(ctx, c1x, c1y, a1x, a1y, z)
    drawArrowHead(ctx, c2x, c2y, a2x, a2y, z)
  } else {
    ctx.beginPath()
    ctx.moveTo(a1x, a1y)
    ctx.lineTo(a2x, a2y)
    ctx.stroke()
    drawArrowHead(ctx, a2x, a2y, a1x, a1y, z)
    drawArrowHead(ctx, a1x, a1y, a2x, a2y, z)
  }

  ctx.save()
  ctx.translate(midx, midy)
  ctx.scale(1 / z, 1 / z)
  const isLight = theme === 'light'
  ctx.lineWidth = 3
  ctx.strokeStyle = isLight ? 'rgba(255,255,255,0.9)' : 'rgba(15,17,23,0.85)'
  ctx.fillStyle = isLight ? 'rgba(30, 64, 175, 0.98)' : 'rgba(253, 224, 71, 0.98)'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.strokeText(label, 0, 0)
  ctx.fillText(label, 0, 0)
  ctx.restore()

  ctx.restore()
}

/**
 * Geometry for radial Ø/R leaders (world space, matches drawRadialDimension).
 *
 * @param {{
 *   cx: number; cy: number; r: number; zoom: number
 *   leaderAngle?: number
 *   leaderShoulderWorld?: number | null
 * }} o
 */
export function radialLeaderGeometry(o) {
  const { cx, cy, r, zoom, leaderAngle = 0, leaderShoulderWorld } = o
  const z = zoom || 1
  const ca = Math.cos(leaderAngle)
  const sa = Math.sin(leaderAngle)
  const gap = ANSI_EXT_GAP_WORLD
  const pIn = { x: cx + ca * gap, y: cy + sa * gap }
  const pRim = { x: cx + ca * r, y: cy + sa * r }
  const pOut = { x: cx + ca * (r + gap), y: cy + sa * (r + gap) }
  const radStub = 14 / z
  const pBend = { x: pOut.x + ca * radStub, y: pOut.y + sa * radStub }
  const shoulderDefault = 42 / z
  const shoulder =
    leaderShoulderWorld != null &&
    Number.isFinite(leaderShoulderWorld) &&
    leaderShoulderWorld > 0
      ? leaderShoulderWorld
      : shoulderDefault
  const hSign = ca >= 0 ? 1 : -1
  const pLand = { x: pBend.x + hSign * shoulder, y: pBend.y }
  return {
    pIn,
    pRim,
    pOut,
    pBend,
    pLand,
    shoulder,
    hSign,
    ca,
    sa,
    radStub,
  }
}

/**
 * Radial / diameter dimension: leader from center through the curve, radial stub,
 * horizontal shoulder (landing), then text.
 *
 * @param {{
 *   cx: number; cy: number; r: number; zoom: number; label: string
 *   theme?: 'light' | 'dark'
 *   leaderAngle?: number
 *   leaderShoulderWorld?: number | null
 * }} o
 */
export function drawRadialDimension(ctx, o) {
  const { cx, cy, r, zoom, label, theme = 'dark', leaderAngle = 0 } = o
  const z = zoom || 1
  if (r < 1e-6) return
  const dimTint =
    theme === 'light' ? 'rgba(30, 41, 59, 0.92)' : 'rgba(226, 232, 240, 0.92)'
  const extTint =
    theme === 'light' ? 'rgba(71, 85, 105, 0.75)' : 'rgba(148, 163, 184, 0.78)'

  const { pIn, pRim, pOut, pBend, pLand } = radialLeaderGeometry({
    cx,
    cy,
    r,
    zoom,
    leaderAngle,
    leaderShoulderWorld: o.leaderShoulderWorld,
  })

  ctx.save()
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  ctx.strokeStyle = extTint
  ctx.lineWidth = Math.max(0.35, 0.55 / z)
  ctx.beginPath()
  ctx.moveTo(pIn.x, pIn.y)
  ctx.lineTo(pRim.x, pRim.y)
  ctx.stroke()

  ctx.strokeStyle = dimTint
  ctx.lineWidth = Math.max(0.5, 0.75 / z)
  ctx.fillStyle = dimTint
  ctx.beginPath()
  ctx.moveTo(pOut.x, pOut.y)
  ctx.lineTo(pBend.x, pBend.y)
  ctx.lineTo(pLand.x, pLand.y)
  ctx.stroke()
  drawArrowHead(ctx, pBend.x, pBend.y, pOut.x, pOut.y, z)

  const textWorldX = (pBend.x + pLand.x) / 2
  const textWorldY = pLand.y
  ctx.save()
  ctx.translate(textWorldX, textWorldY)
  ctx.scale(1 / z, 1 / z)
  ctx.font = `600 11px Inter, system-ui, sans-serif`
  const isLight = theme === 'light'
  ctx.lineWidth = 3
  ctx.strokeStyle = isLight ? 'rgba(255,255,255,0.9)' : 'rgba(15,17,23,0.85)'
  ctx.fillStyle = isLight ? 'rgba(30, 64, 175, 0.98)' : 'rgba(253, 224, 71, 0.98)'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'bottom'
  ctx.strokeText(label, 0, -6)
  ctx.fillText(label, 0, -6)
  ctx.restore()
  ctx.restore()
}

/**
 * Angular dimension between two segment directions (simplified arc + label).
 */
export function drawAngularDimension(ctx, o) {
  const {
    vx,
    vy,
    r,
    a0,
    a1,
    zoom,
    label,
    theme = 'dark',
  } = o
  const z = zoom || 1
  ctx.save()
  ctx.strokeStyle =
    theme === 'light' ? 'rgba(30, 41, 59, 0.88)' : 'rgba(226, 232, 240, 0.88)'
  ctx.lineWidth = Math.max(0.5, 0.75 / z)
  ctx.beginPath()
  ctx.arc(vx, vy, r, a0, a1, a1 < a0)
  ctx.stroke()

  const mid = (a0 + a1) / 2 + (Math.abs(a1 - a0) > Math.PI ? Math.PI : 0)
  const tx = vx + Math.cos(mid) * (r + 10 / z)
  const ty = vy + Math.sin(mid) * (r + 10 / z)
  ctx.translate(tx, ty)
  ctx.scale(1 / z, 1 / z)
  ctx.font = `600 11px Inter, system-ui, sans-serif`
  const isLight = theme === 'light'
  ctx.lineWidth = 3
  ctx.strokeStyle = isLight ? 'rgba(255,255,255,0.9)' : 'rgba(15,17,23,0.85)'
  ctx.fillStyle = isLight ? 'rgba(30, 64, 175, 0.98)' : 'rgba(253, 224, 71, 0.98)'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.strokeText(label, 0, 0)
  ctx.fillText(label, 0, 0)
  ctx.restore()
}
