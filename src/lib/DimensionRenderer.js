/**
 * ANSI-style dimension graphics (extension lines, 3:1 arrowheads, gap from geometry).
 * World-space drawing; caller sets ctx transform (pan/zoom) already applied.
 *
 * Gap / overshoot per typical inch–metric lecture conversions (~1/16" ≈ 1.5 mm, ~1/8" ≈ 3 mm),
 * expressed in sketch world units (treat 1 unit ≈ 1 mm for readable prints).
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
  } = o
  const z = zoom || 1
  const dx = bx - ax
  const dy = by - ay
  const len = Math.hypot(dx, dy)
  if (len < 1e-9) return
  const nx = (-dy / len) * offsetWorld
  const ny = (dx / len) * offsetWorld

  const ux = dx / len
  const uy = dy / len
  const gap = ANSI_EXT_GAP_WORLD
  const ext = ANSI_EXT_OVERSHOOT_WORLD

  const a1x = ax + ux * gap + nx
  const a1y = ay + uy * gap + ny
  const a2x = ax + ux * (len - gap) + nx
  const a2y = ay + uy * (len - gap) + ny

  const extAx = ax + ux * gap - ux * ext + nx
  const extAy = ay + uy * gap - uy * ext + ny
  const extBx = bx - ux * gap + ux * ext + nx
  const extBy = by - uy * gap + uy * ext + ny

  const dimTint =
    theme === 'light' ? 'rgba(30, 41, 59, 0.92)' : 'rgba(226, 232, 240, 0.92)'
  const extTint =
    theme === 'light' ? 'rgba(71, 85, 105, 0.75)' : 'rgba(148, 163, 184, 0.78)'

  ctx.save()
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

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
 * Radial dimension (radius) from center toward rim.
 */
export function drawRadialDimension(ctx, o) {
  const { cx, cy, r, zoom, label, theme = 'dark' } = o
  const z = zoom || 1
  if (r < 1e-6) return
  const ux = 1
  const uy = 0
  const gap = ANSI_EXT_GAP_WORLD
  const p0x = cx + ux * (r + gap)
  const p0y = cy + uy * (r + gap)
  const p1x = cx + ux * (r + gap + ARROW_LEN / z + 22 / z)
  const p1y = cy

  ctx.save()
  ctx.lineCap = 'round'
  const extTint =
    theme === 'light' ? 'rgba(71, 85, 105, 0.75)' : 'rgba(148, 163, 184, 0.78)'
  ctx.strokeStyle = extTint
  ctx.lineWidth = Math.max(0.35, 0.55 / z)
  ctx.beginPath()
  ctx.moveTo(cx + ux * gap, cy)
  ctx.lineTo(p0x, p0y)
  ctx.stroke()

  const dimTint =
    theme === 'light' ? 'rgba(30, 41, 59, 0.92)' : 'rgba(226, 232, 240, 0.92)'
  ctx.strokeStyle = dimTint
  ctx.lineWidth = Math.max(0.5, 0.75 / z)
  ctx.fillStyle = dimTint
  ctx.beginPath()
  ctx.moveTo(p0x, p0y)
  ctx.lineTo(p1x, p1y)
  ctx.stroke()
  drawArrowHead(ctx, p1x, p1y, p0x, p0y, z)

  ctx.save()
  ctx.translate((p0x + p1x) / 2, p0y)
  ctx.scale(1 / z, 1 / z)
  ctx.font = `600 11px Inter, system-ui, sans-serif`
  const isLight = theme === 'light'
  ctx.lineWidth = 3
  ctx.strokeStyle = isLight ? 'rgba(255,255,255,0.9)' : 'rgba(15,17,23,0.85)'
  ctx.fillStyle = isLight ? 'rgba(30, 64, 175, 0.98)' : 'rgba(253, 224, 71, 0.98)'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.strokeText(label, 0, -8)
  ctx.fillText(label, 0, -8)
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
