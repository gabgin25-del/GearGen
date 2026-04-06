import { circleWithResolvedCenter } from './circleResolve.js'
import { pickAdaptiveCartesianSteps } from './gridAdaptive.js'
import { DEFAULT_GRID_STEP } from './gridSnap.js'
import {
  formatAxisTickValue,
  pickDecimalTickStep,
  pickRadiansTickStep,
} from './axisTickFormatting.js'
import { angleSweepCCW } from './geometryMetrics.js'
import {
  sampleSplinePolyline,
  splineControlSegments,
  splineVertexRole,
} from './splineMath.js'
import { drawConstraintDecorations } from './constraintDraw.js'
import {
  canonicalFaceKey,
  computeSegmentFaceRings,
} from './segmentPlanarFaces.js'
import { linearDistanceAnchorPoints } from './dimensionGeometry.js'
import {
  DEFAULT_DOCUMENT_UNITS,
  formatLengthMmForDisplay,
  worldMmToDisplay,
} from './sketchUnits.js'

function cartesianTickLabel(worldMm, step, tickFmt, docUnits) {
  if (tickFmt === 'radians_pi') {
    return formatAxisTickValue(worldMm, step, tickFmt)
  }
  if (!docUnits) return formatAxisTickValue(worldMm, step, tickFmt)
  const d = worldMmToDisplay(worldMm, docUnits)
  const ds = Math.max(1e-12, Math.abs(worldMmToDisplay(step, docUnits)))
  return formatAxisTickValue(d, ds, 'decimal')
}
import { DRIVING_DIM_OFFSET_WORLD } from './dimensionHitTest.js'
import {
  drawAngularDimension,
  drawLinearDimension,
  drawRadialDimension,
} from './DimensionRenderer.js'

const CANVAS_PALETTE = {
  dark: {
    bg: '#1e1f26',
    gridMinor: 'rgba(200, 210, 230, 0.09)',
    gridMajor: 'rgba(120, 128, 150, 0.42)',
    polar1: 'rgba(200, 210, 230, 0.07)',
    polar2: 'rgba(120, 128, 150, 0.4)',
    axisStroke: '#f8fafc',
    tickStroke: 'rgba(148, 163, 184, 0.75)',
    tickText: 'rgba(148, 163, 184, 0.88)',
    axisLetter: 'rgba(61, 141, 214, 0.92)',
    geomStroke: 'rgba(232, 234, 242, 0.88)',
    geomStrokeFixed: '#f8fafc',
    geomStrokeFree: 'rgba(96, 165, 250, 0.95)',
    closedRegionFill: 'rgba(147, 197, 253, 0.34)',
    snapGuideStroke: 'rgba(250, 204, 21, 0.75)',
    snapGuideGlow: 'rgba(250, 204, 21, 0.22)',
    angleStroke: 'rgba(250, 204, 21, 0.95)',
    angleExt: 'rgba(253, 224, 71, 0.52)',
    angleFill: 'rgba(250, 204, 21, 0.95)',
    angleLabel: 'rgba(253, 224, 71, 0.95)',
    previewStroke: 'rgba(61, 141, 214, 0.75)',
    previewAngleAux: 'rgba(250, 204, 21, 0.85)',
    splineStroke: 'rgba(232, 234, 242, 0.95)',
    splineControl: 'rgba(148, 163, 184, 0.42)',
    pointFill: '#e8e9ed',
    pointStroke: '#3d8dd6',
    pointSplineStart: '#34d399',
    pointSplineStartRing: 'rgba(52, 211, 153, 0.95)',
    pointSel: '#fbbf24',
    pointHov: '#93c5fd',
    worldText: 'rgba(226, 232, 240, 0.92)',
    relationFill: 'rgba(6, 78, 59, 0.72)',
    relationStroke: 'rgba(52, 211, 153, 1)',
    relationText: 'rgba(255, 255, 255, 0.98)',
  },
  light: {
    bg: '#ffffff',
    gridMinor: '#EDEDED',
    gridMajor: '#D1D1D1',
    polar1: '#EDEDED',
    polar2: '#D1D1D1',
    axisStroke: '#000000',
    tickStroke: 'rgba(75, 85, 99, 0.45)',
    tickText: '#1a1a1a',
    axisLetter: 'rgba(37, 99, 235, 0.92)',
    geomStroke: 'rgba(30, 34, 42, 0.88)',
    geomStrokeFixed: '#0a0a0a',
    geomStrokeFree: 'rgba(37, 99, 235, 0.92)',
    closedRegionFill: 'rgba(59, 130, 246, 0.22)',
    snapGuideStroke: 'rgba(217, 119, 6, 0.9)',
    snapGuideGlow: 'rgba(245, 158, 11, 0.2)',
    angleStroke: 'rgba(180, 83, 9, 0.95)',
    angleExt: 'rgba(217, 119, 6, 0.55)',
    angleFill: 'rgba(245, 158, 11, 0.95)',
    angleLabel: 'rgba(146, 64, 14, 0.95)',
    previewStroke: 'rgba(37, 99, 235, 0.75)',
    previewAngleAux: 'rgba(217, 119, 6, 0.85)',
    splineStroke: 'rgba(30, 34, 42, 0.95)',
    splineControl: 'rgba(75, 85, 99, 0.45)',
    pointFill: '#f8fafc',
    pointStroke: '#2563eb',
    pointSplineStart: '#059669',
    pointSplineStartRing: 'rgba(5, 150, 105, 0.92)',
    pointSel: '#d97706',
    pointHov: '#60a5fa',
    worldText: 'rgba(30, 34, 42, 0.92)',
    relationFill: 'rgba(20, 83, 45, 0.55)',
    relationStroke: 'rgba(5, 150, 105, 1)',
    relationText: 'rgba(255, 255, 255, 0.98)',
  },
}

function canvasPal(theme) {
  return theme === 'light' ? CANVAS_PALETTE.light : CANVAS_PALETTE.dark
}

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} wx
 * @param {number} wy
 * @param {number} zoom
 * @param {string} text
 * @param {{ dx?: number; dy?: number; font?: string; color?: string; align?: CanvasTextAlign; baseline?: CanvasTextBaseline }} [opts]
 */
function drawWorldText(ctx, wx, wy, zoom, text, opts = {}) {
  const z = zoom || 1
  const dx = opts.dx ?? 0
  const dy = opts.dy ?? 0
  ctx.save()
  ctx.translate(wx, wy)
  ctx.scale(1 / z, 1 / z)
  ctx.font = opts.font || '11px Inter, system-ui, sans-serif'
  ctx.fillStyle = opts.color || 'rgba(226, 232, 240, 0.92)'
  ctx.textAlign = opts.align ?? 'center'
  ctx.textBaseline = opts.baseline ?? 'middle'
  ctx.fillText(text, dx, dy)
  ctx.restore()
}

/** Thin rays from vertex along each arm, past the arc and arrow (SolidWorks-style). */
function drawAngleDecorations(ctx, C, aa, sweep, markR, z, pal) {
  const ab = aa + sweep
  const extend = 12 / z
  ctx.save()
  const thin = Math.max(0.4, 0.65 / z)
  ctx.strokeStyle = pal.angleExt
  ctx.lineWidth = thin
  const tipDist = markR + 8 / z
  const rayLen = Math.max(tipDist + 16 / z, markR + extend + 10 / z)
  ctx.beginPath()
  ctx.moveTo(C.x, C.y)
  ctx.lineTo(C.x + Math.cos(aa) * rayLen, C.y + Math.sin(aa) * rayLen)
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(C.x, C.y)
  ctx.lineTo(C.x + Math.cos(ab) * rayLen, C.y + Math.sin(ab) * rayLen)
  ctx.stroke()

  const endAng = ab
  const tipX = C.x + Math.cos(endAng) * tipDist
  const tipY = C.y + Math.sin(endAng) * tipDist
  const ux = Math.cos(endAng)
  const uy = Math.sin(endAng)
  const back = 7.5 / z
  const wing = 3.6 / z
  const bx = tipX - ux * back
  const by = tipY - uy * back
  const px = -uy * wing
  const py = ux * wing
  ctx.fillStyle = pal.angleFill
  ctx.beginPath()
  ctx.moveTo(tipX, tipY)
  ctx.lineTo(bx + px, by + py)
  ctx.lineTo(bx - px, by - py)
  ctx.closePath()
  ctx.fill()
  ctx.restore()
}

function splineStrokeSamples(spline, pointById) {
  const verts = spline.vertexIds
    .map((id) => pointById.get(id))
    .filter(Boolean)
  if (verts.length < 2) return verts
  return sampleSplinePolyline(verts, spline.splineType, {
    tension: spline.tension ?? 0.5,
    closed: !!spline.closed,
    segmentsPerSpan: spline.segmentsPerSpan ?? 14,
  })
}

function shapeStrokeStyle(hover, selected, id, kind, base) {
  const sel = selected?.kind === kind && selected?.id === id
  const hov = hover?.kind === kind && hover?.id === id
  if (sel) return 'rgba(251, 191, 36, 0.98)'
  if (hov) return 'rgba(147, 197, 253, 0.95)'
  return base
}

/**
 * @param {{ pointLocked?: Map<string, boolean> } | null | undefined} lock
 * @param {string} kind
 * @param {{ a: string; b: string }} [seg]
 * @param {{ vertexIds?: string[] }} [poly]
 * @param {{ centerId?: string | null }} [circ]
 * @param {{ vertexIds?: string[]; closed?: boolean }} [spl]
 * @param {{ centerId?: string }} [arc]
 */
function constraintAwareStroke(lock, kind, seg, poly, circ, spl, arc, pal) {
  if (!lock?.pointLocked) return null
  const pl = lock.pointLocked
  if (kind === 'segment' && seg) {
    if (lock.segmentStrokeConstrained?.get(seg.id) === true) {
      return pal.geomStrokeFixed
    }
    const ok = pl.get(seg.a) === true && pl.get(seg.b) === true
    return ok ? pal.geomStrokeFixed : pal.geomStrokeFree
  }
  if (kind === 'polygon' && poly?.vertexIds?.length) {
    const ok = poly.vertexIds.every((vid) => pl.get(vid) === true)
    return ok ? pal.geomStrokeFixed : pal.geomStrokeFree
  }
  if (kind === 'circle' && circ) {
    if (circ.centerId) {
      return pl.get(circ.centerId) === true
        ? pal.geomStrokeFixed
        : pal.geomStrokeFree
    }
    return pal.geomStrokeFixed
  }
  if (kind === 'spline' && spl?.vertexIds?.length) {
    const ok = spl.vertexIds.every((vid) => pl.get(vid) === true)
    return ok ? pal.geomStrokeFixed : pal.geomStrokeFree
  }
  if (kind === 'arc' && arc?.centerId) {
    return pl.get(arc.centerId) === true
      ? pal.geomStrokeFixed
      : pal.geomStrokeFree
  }
  return null
}

function shapeLineWidth(lwGeom, hover, selected, id, kind) {
  const sel = selected?.kind === kind && selected?.id === id
  const hov = hover?.kind === kind && hover?.id === id
  if (sel) return lwGeom * 2.1
  if (hov) return lwGeom * 1.55
  return lwGeom
}

function maxDistFromPoleToRect(ox, oy, minWX, maxWX, minWY, maxWY) {
  const corners = [
    [minWX, minWY],
    [maxWX, minWY],
    [maxWX, maxWY],
    [minWX, maxWY],
  ]
  let m = 0
  for (const [x, y] of corners) {
    m = Math.max(m, Math.hypot(x - ox, y - oy))
  }
  return m * 1.08
}

function drawCartesianGrid(
  ctx,
  minWX,
  maxWX,
  minWY,
  maxWY,
  minorStep,
  majorStep,
  zoom,
  pal,
  minorAlpha = 1,
) {
  const z = zoom || 1
  const x0 = Math.floor(minWX / minorStep) * minorStep
  const y0 = Math.floor(minWY / minorStep) * minorStep
  if (minorAlpha > 0.02) {
    ctx.save()
    ctx.globalAlpha = minorAlpha
    ctx.lineWidth = Math.max(0.25, 0.5 / z)
    ctx.strokeStyle = pal.gridMinor
    ctx.beginPath()
    for (let x = x0; x <= maxWX; x += minorStep) {
      ctx.moveTo(x + 0.5 / z, minWY)
      ctx.lineTo(x + 0.5 / z, maxWY)
    }
    for (let y = y0; y <= maxWY; y += minorStep) {
      ctx.moveTo(minWX, y + 0.5 / z)
      ctx.lineTo(maxWX, y + 0.5 / z)
    }
    ctx.stroke()
    ctx.restore()
  }

  ctx.strokeStyle = pal.gridMajor
  ctx.lineWidth = Math.max(0.65, 1 / z)
  const mx0 = Math.floor(minWX / majorStep) * majorStep
  const my0 = Math.floor(minWY / majorStep) * majorStep
  ctx.beginPath()
  for (let x = mx0; x <= maxWX; x += majorStep) {
    ctx.moveTo(x + 0.5 / z, minWY)
    ctx.lineTo(x + 0.5 / z, maxWY)
  }
  for (let y = my0; y <= maxWY; y += majorStep) {
    ctx.moveTo(minWX, y + 0.5 / z)
    ctx.lineTo(maxWX, y + 0.5 / z)
  }
  ctx.stroke()
}

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} z
 * @param {number} ox
 * @param {number} oy
 * @param {number} minWX
 * @param {number} maxWX
 * @param {number} minWY
 * @param {number} maxWY
 * @param {{ origin?: boolean; axisX?: boolean; axisY?: boolean; worldOrigin?: boolean } | null | undefined} hg
 * @param {typeof CANVAS_PALETTE.dark} pal
 */
function drawSnapGuideHighlights(
  ctx,
  z,
  ox,
  oy,
  minWX,
  maxWX,
  minWY,
  maxWY,
  hg,
  pal,
) {
  if (!hg) return
  ctx.save()
  ctx.setLineDash([])
  const lw = Math.max(1.2, 2.2 / z)
  if (hg.axisX) {
    ctx.strokeStyle = pal.snapGuideStroke
    ctx.lineWidth = lw
    ctx.globalAlpha = 0.85
    ctx.beginPath()
    ctx.moveTo(minWX, oy)
    ctx.lineTo(maxWX, oy)
    ctx.stroke()
  }
  if (hg.axisY) {
    ctx.strokeStyle = pal.snapGuideStroke
    ctx.lineWidth = lw
    ctx.globalAlpha = 0.85
    ctx.beginPath()
    ctx.moveTo(ox, minWY)
    ctx.lineTo(ox, maxWY)
    ctx.stroke()
  }
  if (hg.worldOrigin) {
    ctx.strokeStyle = pal.snapGuideStroke
    ctx.lineWidth = lw * 0.85
    ctx.globalAlpha = 0.55
    ctx.beginPath()
    ctx.moveTo(minWX, 0)
    ctx.lineTo(maxWX, 0)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(0, minWY)
    ctx.lineTo(0, maxWY)
    ctx.stroke()
  }
  const mark = (px, py) => {
    ctx.fillStyle = pal.snapGuideGlow
    ctx.globalAlpha = 1
    ctx.beginPath()
    ctx.arc(px, py, 14 / z, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = pal.snapGuideStroke
    ctx.lineWidth = Math.max(1, 1.6 / z)
    ctx.globalAlpha = 1
    ctx.beginPath()
    ctx.arc(px, py, 5 / z, 0, Math.PI * 2)
    ctx.stroke()
  }
  if (hg.worldOrigin) mark(0, 0)
  else if (hg.origin) mark(ox, oy)
  ctx.restore()
}

function drawPolarGrid(
  ctx,
  ox,
  oy,
  minWX,
  maxWX,
  minWY,
  maxWY,
  rStep,
  angleStep,
  zoom,
  pal,
  radialAlpha = 1,
) {
  const maxR = maxDistFromPoleToRect(ox, oy, minWX, maxWX, minWY, maxWY)
  const z = zoom || 1
  ctx.save()
  ctx.globalAlpha = radialAlpha
  ctx.strokeStyle = pal.polar1
  let ringIndex = 0
  for (let r = rStep; r <= maxR; r += rStep, ringIndex++) {
    const major = ringIndex % 6 === 0
    ctx.lineWidth = major
      ? Math.max(1.15, 1.85 / z)
      : Math.max(0.35, 0.72 / z)
    ctx.globalAlpha = major ? Math.min(1, radialAlpha + 0.08) : radialAlpha
    ctx.beginPath()
    ctx.arc(ox, oy, r, 0, Math.PI * 2)
    ctx.stroke()
  }
  ctx.restore()
  ctx.strokeStyle = pal.polar2
  ctx.lineWidth = Math.max(0.65, 1 / z)
  const spokes = Math.ceil((Math.PI * 2) / angleStep)
  for (let i = 0; i < spokes; i++) {
    const a = i * angleStep
    ctx.beginPath()
    ctx.moveTo(ox, oy)
    ctx.lineTo(ox + Math.cos(a) * maxR, oy + Math.sin(a) * maxR)
    ctx.stroke()
  }
}

function gcd(a, b) {
  let x = Math.abs(a)
  let y = Math.abs(b)
  while (y) {
    const t = y
    y = x % y
    x = t
  }
  return x || 1
}

/** Spoke index k → label "0", "π/6", … "11π/6" (radians, π/6 steps). */
function polarRadianSpokeLabel(k) {
  if (k === 0) return '0'
  if (k === 6) return 'π'
  if (k === 3) return 'π/2'
  if (k === 9) return '3π/2'
  const g = gcd(k, 6)
  const n = k / g
  const d = 6 / g
  if (d === 1) return `${n}π`
  return `${n}π/${d}`
}

function drawPendingCuts(ctx, pendingCuts, z) {
  const list = pendingCuts ?? []
  if (!list.length) return
  const zz = z || 1
  ctx.save()
  ctx.fillStyle = 'rgba(239, 68, 68, 0.3)'
  ctx.strokeStyle = 'rgba(220, 38, 38, 0.65)'
  ctx.lineWidth = Math.max(0.5, 1 / zz)
  for (const c of list) {
    if (c.kind === 'circle' && Number.isFinite(c.cx) && Number.isFinite(c.cy) && Number.isFinite(c.r) && c.r > 0) {
      ctx.beginPath()
      ctx.arc(c.cx, c.cy, c.r, 0, Math.PI * 2)
      ctx.fill()
      ctx.stroke()
    } else if (
      c.kind === 'rect' &&
      Number.isFinite(c.minx) &&
      Number.isFinite(c.miny) &&
      Number.isFinite(c.maxx) &&
      Number.isFinite(c.maxy)
    ) {
      const w = c.maxx - c.minx
      const h = c.maxy - c.miny
      if (w > 0 && h > 0) {
        ctx.fillRect(c.minx, c.miny, w, h)
        ctx.strokeRect(c.minx, c.miny, w, h)
      }
    }
  }
  ctx.restore()
}

function drawPolarSpokeLabels(
  ctx,
  ox,
  oy,
  minWX,
  maxWX,
  minWY,
  maxWY,
  _angleStep,
  zoom,
  labelOpts,
  pal,
) {
  const showTicks = labelOpts?.showAxisTickValues !== false
  if (!showTicks) return
  const z = zoom || 1
  const maxR = maxDistFromPoleToRect(ox, oy, minWX, maxWX, minWY, maxWY)
  if (maxR < 3 / z) return
  const pad = 14 / z
  const labelR = Math.max(maxR * 0.88, maxR - pad)
  const labelStep = Math.PI / 6
  const fontPx = Math.max(10, Math.min(13, 11 * Math.sqrt(z)))
  for (let k = 0; k < 12; k++) {
    const a = k * labelStep
    const lx = ox + Math.cos(a) * labelR
    const ly = oy + Math.sin(a) * labelR
    const text = polarRadianSpokeLabel(k)
    ctx.save()
    ctx.translate(lx, ly)
    ctx.rotate(a + Math.PI / 2)
    ctx.scale(1 / z, 1 / z)
    ctx.font = `${fontPx}px Inter, system-ui, sans-serif`
    ctx.fillStyle = pal.tickText
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(text, 0, 0)
    ctx.restore()
  }
}

/** World mm → canvas CSS px (same as drawWorkspaceScene transform stack). */
function worldToCanvasCss(wx, wy, pan, zoom) {
  const z = zoom || 1
  return { x: wx * z + pan.x, y: wy * z + pan.y }
}

/**
 * Axes and tick marks in **device-independent CSS pixels** so stroke width stays ~1–2px at any zoom.
 */
function drawAxes(
  ctx,
  ox,
  oy,
  minWX,
  maxWX,
  minWY,
  maxWY,
  zoom,
  labelOpts,
  pal,
  viewportWidth,
  gridMode,
  pan,
  dpr,
) {
  const z = zoom || 1
  const unit = labelOpts?.worldUnit ?? 'mm'
  const docUnits = labelOpts?.documentUnits
  const showTicks = labelOpts?.showAxisTickValues !== false
  const showNames = labelOpts?.showAxisNameLabels !== false
  const tickFmt = labelOpts?.axisNumberFormat ?? 'decimal'
  const vw = Math.max(120, viewportWidth || 400)
  const skipCartesianTicks =
    gridMode === 'polar' && tickFmt === 'radians_pi'

  const axisLinePx = 1.75
  const tickLinePx = 1.25
  const tickHalfLen = 4

  const toC = (wx, wy) => worldToCanvasCss(wx, wy, pan, z)

  ctx.save()
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.strokeStyle = pal.axisStroke
  ctx.lineWidth = axisLinePx
  ctx.lineCap = 'square'

  const v0 = toC(ox, minWY)
  const v1 = toC(ox, maxWY)
  ctx.beginPath()
  ctx.moveTo(v0.x, v0.y)
  ctx.lineTo(v1.x, v1.y)
  ctx.stroke()

  const h0 = toC(minWX, oy)
  const h1 = toC(maxWX, oy)
  ctx.beginPath()
  ctx.moveTo(h0.x, h0.y)
  ctx.lineTo(h1.x, h1.y)
  ctx.stroke()

  if (showTicks && !skipCartesianTicks) {
    const col = pal.tickStroke
    const spanX = maxWX - minWX
    const spanY = maxWY - minWY
    const span = Math.max(spanX, spanY)
    const step =
      tickFmt === 'radians_pi'
        ? pickRadiansTickStep(0, span, vw, z)
        : pickDecimalTickStep(0, span, vw)

    ctx.lineWidth = tickLinePx
    let x0 = Math.ceil(minWX / step) * step
    for (let x = x0; x <= maxWX; x += step) {
      if (Math.abs(x - ox) < 1e-9 * Math.max(1, Math.abs(step))) continue
      const c = toC(x, oy)
      ctx.strokeStyle = col
      ctx.beginPath()
      ctx.moveTo(c.x, c.y - tickHalfLen)
      ctx.lineTo(c.x, c.y + tickHalfLen)
      ctx.stroke()
      const lx = cartesianTickLabel(x, step, tickFmt, docUnits)
      ctx.fillStyle = pal.tickText
      ctx.font = '11px Inter, system-ui, sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'top'
      ctx.fillText(lx, c.x, c.y + tickHalfLen + 2)
    }
    let y0 = Math.ceil(minWY / step) * step
    for (let y = y0; y <= maxWY; y += step) {
      if (Math.abs(y - oy) < 1e-9 * Math.max(1, Math.abs(step))) continue
      const c = toC(ox, y)
      ctx.strokeStyle = col
      ctx.beginPath()
      ctx.moveTo(c.x - tickHalfLen, c.y)
      ctx.lineTo(c.x + tickHalfLen, c.y)
      ctx.stroke()
      const ly = cartesianTickLabel(y, step, tickFmt, docUnits)
      ctx.fillStyle = pal.tickText
      ctx.font = '11px Inter, system-ui, sans-serif'
      ctx.textAlign = 'left'
      ctx.textBaseline = 'middle'
      ctx.fillText(ly, c.x + tickHalfLen + 3, c.y)
    }
  }

  if (showNames) {
    const xLabelPos = toC(maxWX, oy)
    const yLabelPos = toC(ox, minWY)
    ctx.fillStyle = pal.axisLetter
    ctx.font = '11px Inter, system-ui, sans-serif'
    ctx.textAlign = 'right'
    ctx.textBaseline = 'top'
    ctx.fillText(`x (${unit})`, xLabelPos.x - 6, xLabelPos.y + 4)
    ctx.textAlign = 'left'
    ctx.fillText(`y (${unit})`, yLabelPos.x + 4, yLabelPos.y + 6)
  }
  ctx.restore()
}

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {{
 *   width: number
 *   height: number
 *   dpr: number
 *   pan: { x: number; y: number }
 *   zoom: number
 *   gridMode?: 'cartesian' | 'polar'
 *   gridMinor?: number
 *   polarRStep?: number
 *   polarAngleStep?: number
 *   showAxes?: boolean
 *   axisOrigin?: { x: number; y: number }
 *   strokes: { id: string; points: { x: number; y: number }[] }[]
 *   points: { id: string; x: number; y: number }[]
 *   segments: { id: string; a: string; b: string }[]
 *   circles: { id: string; cx: number; cy: number; r: number; fill?: string | null }[]
 *   polygons: { id: string; vertexIds: string[]; fill?: string | null }[]
 *   arcs?: { id: string; cx: number; cy: number; r: number; a0: number; sweep: number; fill?: string | null }[]
 *   angles?: { id: string; centerId: string; arm1Id: string; arm2Id: string }[]
 *   splines?: { id: string; vertexIds: string[]; splineType: string; tension?: number; closed?: boolean; segmentsPerSpan?: number; fill?: string | null }[]
 *   pendingCuts?: { kind: string; cx?: number; cy?: number; r?: number; minx?: number; miny?: number; maxx?: number; maxy?: number }[]
 *   preview: null | object
 *   selectedPointId?: string | null
 *   hoverHighlight?: null | { kind: string; id: string }
 *   selectedShape?: null | { kind: string; id: string }
 *   labelDrawOptions?: {
 *     worldUnit?: string
 *     documentUnits?: import('./sketchUnits.js').DocumentUnits
 *     showAxisTickValues?: boolean
 *     showAxisNameLabels?: boolean
 *     axisNumberFormat?: 'decimal' | 'radians_pi'
 *     showAngleDegrees?: boolean
 *   }
 *   theme?: 'light' | 'dark'
 * }} p
 */
export function drawWorkspaceScene(ctx, p) {
  const {
    width,
    height,
    dpr,
    pan,
    zoom,
    gridMode = 'cartesian',
    gridMinor = DEFAULT_GRID_STEP,
    polarRStep,
    polarAngleStep = Math.PI / 12,
    showAxes = true,
    axisOrigin = { x: 0, y: 0 },
    strokes,
    points,
    segments,
    circles,
    polygons,
    arcs = [],
    angles = [],
    splines = [],
    pendingCuts = [],
    preview,
    selectedPointId,
    hoverHighlight = null,
    selectedShape = null,
    splineAnchorPointId = null,
    constraints = [],
    showDimensions = false,
    showRelations = true,
    sketchSelection = [],
    labelDrawOptions = {},
    theme = 'dark',
    allowRegionFill = true,
    sketchLockState = null,
    snapGuideHighlight = null,
    dimensions = [],
  } = p

  const fillRegions = allowRegionFill !== false

  const pal = canvasPal(theme)
  const z = zoom || 1
  const ox = axisOrigin.x
  const oy = axisOrigin.y

  ctx.save()
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.fillStyle = pal.bg
  ctx.fillRect(0, 0, width, height)

  ctx.translate(pan.x, pan.y)
  ctx.scale(z, z)

  const minWX = -pan.x / z
  const maxWX = (width - pan.x) / z
  const minWY = -pan.y / z
  const maxWY = (height - pan.y) / z

  const adaptive = pickAdaptiveCartesianSteps(
    minWX,
    maxWX,
    minWY,
    maxWY,
    z,
    gridMinor,
  )
  const rStep = polarRStep ?? adaptive.minor

  if (gridMode === 'polar') {
    drawPolarGrid(
      ctx,
      ox,
      oy,
      minWX,
      maxWX,
      minWY,
      maxWY,
      rStep,
      polarAngleStep,
      z,
      pal,
      adaptive.minorAlpha,
    )
  } else {
    drawCartesianGrid(
      ctx,
      minWX,
      maxWX,
      minWY,
      maxWY,
      adaptive.minor,
      adaptive.major,
      z,
      pal,
      adaptive.minorAlpha,
    )
  }

  if (showAxes) {
    drawAxes(
      ctx,
      ox,
      oy,
      minWX,
      maxWX,
      minWY,
      maxWY,
      z,
      labelDrawOptions,
      pal,
      width,
      gridMode,
      pan,
      dpr,
    )
  }

  drawSnapGuideHighlights(
    ctx,
    z,
    ox,
    oy,
    minWX,
    maxWX,
    minWY,
    maxWY,
    snapGuideHighlight,
    pal,
  )
  drawPendingCuts(ctx, pendingCuts, z)
  if (
    gridMode === 'polar' &&
    labelDrawOptions.showAxisTickValues !== false
  ) {
    drawPolarSpokeLabels(
      ctx,
      ox,
      oy,
      minWX,
      maxWX,
      minWY,
      maxWY,
      polarAngleStep,
      z,
      labelDrawOptions,
      pal,
    )
  }

  const lwGeom = Math.max(0.75, 2 / z)

  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  for (const s of strokes) {
    if (s.points.length < 2) continue
    ctx.strokeStyle = pal.geomStroke
    ctx.lineWidth = lwGeom
    ctx.beginPath()
    const p0 = s.points[0]
    ctx.moveTo(p0.x, p0.y)
    for (let i = 1; i < s.points.length; i++) {
      const q = s.points[i]
      ctx.lineTo(q.x, q.y)
    }
    ctx.stroke()
  }

  const pointById = new Map(points.map((pt) => [pt.id, pt]))
  const resolvedCircles = circles.map((c) =>
    circleWithResolvedCenter(c, pointById),
  )

  if (fillRegions) {
    const filledPolyKeys = new Set()
    for (const poly of polygons) {
      if (poly.fill && (poly.vertexIds?.length ?? 0) >= 3) {
        filledPolyKeys.add(canonicalFaceKey(poly.vertexIds))
      }
    }
    const segRings = computeSegmentFaceRings(points, segments)
    ctx.fillStyle = pal.closedRegionFill
    for (const ring of segRings) {
      if (filledPolyKeys.has(canonicalFaceKey(ring))) continue
      const v0 = pointById.get(ring[0])
      if (!v0) continue
      ctx.beginPath()
      ctx.moveTo(v0.x, v0.y)
      for (let i = 1; i < ring.length; i++) {
        const v = pointById.get(ring[i])
        if (!v) continue
        ctx.lineTo(v.x, v.y)
      }
      ctx.closePath()
      ctx.fill()
    }
  }

  for (const poly of polygons) {
    if (poly.vertexIds.length < 2) continue
    const first = pointById.get(poly.vertexIds[0])
    if (!first) continue
    ctx.beginPath()
    ctx.moveTo(first.x, first.y)
    for (let i = 1; i < poly.vertexIds.length; i++) {
      const v = pointById.get(poly.vertexIds[i])
      if (!v) continue
      ctx.lineTo(v.x, v.y)
    }
    ctx.closePath()
    for (const holeRing of poly.holes ?? []) {
      const h0 = pointById.get(holeRing[0])
      if (!h0 || holeRing.length < 2) continue
      ctx.moveTo(h0.x, h0.y)
      for (let i = 1; i < holeRing.length; i++) {
        const hv = pointById.get(holeRing[i])
        if (!hv) continue
        ctx.lineTo(hv.x, hv.y)
      }
      ctx.closePath()
    }
    if (poly.fill && fillRegions) {
      ctx.fillStyle = pal.closedRegionFill
      ctx.fill('evenodd')
    }
  }

  for (const c of resolvedCircles) {
    if (c.fill && fillRegions) {
      ctx.beginPath()
      ctx.arc(c.cx, c.cy, c.r, 0, Math.PI * 2, false)
      for (const h of c.holes ?? []) {
        if (h?.r > 1e-9) {
          ctx.moveTo(h.cx + h.r, h.cy)
          ctx.arc(h.cx, h.cy, h.r, 0, Math.PI * 2, true)
        }
      }
      ctx.fillStyle = pal.closedRegionFill
      ctx.fill('evenodd')
    }
  }

  const baseStroke = pal.geomStroke

  for (const seg of segments) {
    const a = pointById.get(seg.a)
    const b = pointById.get(seg.b)
    if (!a || !b) continue
    const segBase =
      constraintAwareStroke(
        sketchLockState,
        'segment',
        seg,
        null,
        null,
        null,
        null,
        pal,
      ) ?? baseStroke
    ctx.strokeStyle = shapeStrokeStyle(
      hoverHighlight,
      selectedShape,
      seg.id,
      'segment',
      segBase,
    )
    ctx.lineWidth = shapeLineWidth(
      lwGeom,
      hoverHighlight,
      selectedShape,
      seg.id,
      'segment',
    )
    if (seg.construction) {
      const dash = Math.max(3.5 / z, 1.2)
      ctx.setLineDash([dash * 1.7, dash * 1.15])
    } else {
      ctx.setLineDash([])
    }
    ctx.beginPath()
    ctx.moveTo(a.x, a.y)
    ctx.lineTo(b.x, b.y)
    ctx.stroke()
  }
  ctx.setLineDash([])

  const selKey = new Set(
    sketchSelection.map((s) => `${s.kind}:${s.id}`),
  )
  const sketchSel = (kind, id) => selKey.has(`${kind}:${id}`)
  if (selKey.size > 0) {
    ctx.save()
    ctx.strokeStyle =
      theme === 'light'
        ? 'rgba(5, 150, 105, 0.95)'
        : 'rgba(110, 231, 183, 0.98)'
    ctx.lineWidth = Math.max(lwGeom * 2.2, 2.8 / z)
    ctx.setLineDash([])
    for (const seg of segments) {
      if (!sketchSel('segment', seg.id)) continue
      const a = pointById.get(seg.a)
      const b = pointById.get(seg.b)
      if (!a || !b) continue
      if (seg.construction) {
        const dash = Math.max(3.5 / z, 1.2)
        ctx.setLineDash([dash * 1.7, dash * 1.15])
      } else {
        ctx.setLineDash([])
      }
      ctx.beginPath()
      ctx.moveTo(a.x, a.y)
      ctx.lineTo(b.x, b.y)
      ctx.stroke()
    }
    ctx.setLineDash([])
    for (const c of resolvedCircles) {
      if (!sketchSel('circle', c.id)) continue
      ctx.beginPath()
      ctx.arc(c.cx, c.cy, c.r + 3 / z, 0, Math.PI * 2)
      ctx.stroke()
    }
    for (const pt of points) {
      if (!sketchSel('point', pt.id)) continue
      ctx.beginPath()
      ctx.arc(pt.x, pt.y, 6 / z, 0, Math.PI * 2)
      ctx.stroke()
    }
    for (const poly of polygons) {
      if (!sketchSel('polygon', poly.id)) continue
      const v0 = pointById.get(poly.vertexIds[0])
      if (!v0) continue
      ctx.beginPath()
      ctx.moveTo(v0.x, v0.y)
      for (let i = 1; i < poly.vertexIds.length; i++) {
        const v = pointById.get(poly.vertexIds[i])
        if (!v) continue
        ctx.lineTo(v.x, v.y)
      }
      ctx.closePath()
      ctx.stroke()
    }
    for (const a of arcs) {
      if (!sketchSel('arc', a.id)) continue
      ctx.beginPath()
      ctx.arc(a.cx, a.cy, a.r, a.a0, a.a0 + a.sweep, a.sweep < 0)
      ctx.stroke()
    }
    for (const sp of splines) {
      if (!sketchSel('spline', sp.id)) continue
      const samples = splineStrokeSamples(sp, pointById)
      if (samples.length < 2) continue
      ctx.beginPath()
      ctx.moveTo(samples[0].x, samples[0].y)
      for (let i = 1; i < samples.length; i++) {
        ctx.lineTo(samples[i].x, samples[i].y)
      }
      if (sp.closed) ctx.closePath()
      ctx.stroke()
    }
    ctx.restore()
  }

  if (showDimensions) {
    const unit = labelDrawOptions.worldUnit || 'mm'
    const du =
      labelDrawOptions.documentUnits != null
        ? labelDrawOptions.documentUnits
        : DEFAULT_DOCUMENT_UNITS
    for (const seg of segments) {
      const a = pointById.get(seg.a)
      const b = pointById.get(seg.b)
      if (!a || !b) continue
      const len = Math.hypot(b.x - a.x, b.y - a.y)
      const mx = (a.x + b.x) / 2
      const my = (a.y + b.y) / 2
      drawWorldText(ctx, mx, my, z, `${formatLengthMmForDisplay(len, du, 1)} ${unit}`, {
        font: '10px Inter, system-ui, sans-serif',
        color: pal.tickText,
        align: 'center',
        baseline: 'middle',
        dy: -8,
      })
    }
    for (const c of resolvedCircles) {
      const txt = `Ø ${formatLengthMmForDisplay(2 * c.r, du, 1)} ${unit}`
      drawWorldText(ctx, c.cx, c.cy, z, txt, {
        font: '10px Inter, system-ui, sans-serif',
        color: pal.tickText,
        align: 'center',
        baseline: 'middle',
        dy: -c.r - 10 / z,
      })
    }
  }

  if (dimensions.length > 0) {
    const unit = labelDrawOptions.worldUnit || 'mm'
    const du =
      labelDrawOptions.documentUnits != null
        ? labelDrawOptions.documentUnits
        : DEFAULT_DOCUMENT_UNITS
    const showDeg = labelDrawOptions.showAngleDegrees !== false
    for (const dim of dimensions) {
      const v = dim.value
      if (dim.type === 'distance') {
        const anchors = linearDistanceAnchorPoints(dim, {
          points,
          segments,
          circles,
        })
        if (!anchors) continue
        const label =
          v != null && Number.isFinite(v)
            ? `${formatLengthMmForDisplay(v, du)} ${unit}`
            : `— ${unit}`
        drawLinearDimension(ctx, {
          ax: anchors.ax,
          ay: anchors.ay,
          bx: anchors.bx,
          by: anchors.by,
          zoom: z,
          label,
          theme,
          offsetWorld: dim.offsetWorld ?? DRIVING_DIM_OFFSET_WORLD,
          projection: dim.linearProjection ?? 'aligned',
        })
      } else if (dim.type === 'radius' && dim.targets?.[0]) {
        const tid = dim.targets[0]
        const arc = (arcs ?? []).find((a) => a.id === tid)
        const c = circles.find((x) => x.id === tid)
        let rc = null
        if (dim.splineCurvature) {
          if (
            dim.dimCx != null &&
            dim.dimCy != null &&
            dim.dimR != null &&
            dim.dimR > 1e-9
          ) {
            rc = { cx: dim.dimCx, cy: dim.dimCy, r: dim.dimR }
          }
        } else if (arc || c) {
          rc = circleWithResolvedCenter(arc ?? c, pointById)
        }
        if (!rc || rc.r < 1e-9) continue
        const isArc = !!arc
        const isCirc = !!c && !arc
        const label =
          v != null && Number.isFinite(v)
            ? isCirc
              ? `Ø ${formatLengthMmForDisplay(2 * v, du)} ${unit}`
              : `R ${formatLengthMmForDisplay(v, du)} ${unit}`
            : isCirc
              ? `Ø — ${unit}`
              : `R — ${unit}`
        drawRadialDimension(ctx, {
          cx: rc.cx,
          cy: rc.cy,
          r: rc.r,
          zoom: z,
          label,
          theme,
          leaderAngle: dim.leaderAngle ?? 0,
          leaderShoulderWorld: dim.leaderShoulderWorld,
        })
      } else if (dim.type === 'diameter' && dim.targets?.[0]) {
        const c = circles.find((x) => x.id === dim.targets[0])
        if (!c) continue
        const rc = circleWithResolvedCenter(c, pointById)
        const label =
          v != null && Number.isFinite(v)
            ? `Ø ${formatLengthMmForDisplay(v, du)} ${unit}`
            : `Ø — ${unit}`
        drawRadialDimension(ctx, {
          cx: rc.cx,
          cy: rc.cy,
          r: rc.r,
          zoom: z,
          label,
          theme,
          leaderAngle: dim.leaderAngle ?? 0,
          leaderShoulderWorld: dim.leaderShoulderWorld,
        })
      } else if (dim.type === 'angle' && dim.targets?.length === 3) {
        const [idC, idA, idB] = dim.targets
        const C = pointById.get(idC)
        const A = pointById.get(idA)
        const B = pointById.get(idB)
        if (!C || !A || !B) continue
        let label = '—'
        if (v != null && Number.isFinite(v)) {
          label = showDeg
            ? `${((v * 180) / Math.PI).toFixed(1)}°`
            : `${v.toFixed(3)} rad`
        }
        const a0 = Math.atan2(A.y - C.y, A.x - C.x)
        const a1 = Math.atan2(B.y - C.y, B.x - C.x)
        const da = Math.hypot(A.x - C.x, A.y - C.y)
        const db = Math.hypot(B.x - C.x, B.y - C.y)
        const rr = Math.min(da, db, 48) * 0.35
        drawAngularDimension(ctx, {
          vx: C.x,
          vy: C.y,
          r: Math.max(12 / z, rr),
          a0,
          a1,
          zoom: z,
          label,
          theme,
        })
      } else if (
        dim.type === 'angle' &&
        dim.targets?.length === 2 &&
        typeof dim.targets[0] === 'object'
      ) {
        const s0 = segments.find((s) => s.id === dim.targets[0].id)
        const s1 = segments.find((s) => s.id === dim.targets[1].id)
        if (!s0 || !s1) continue
        const p00 = pointById.get(s0.a)
        const p01 = pointById.get(s0.b)
        const p10 = pointById.get(s1.a)
        const p11 = pointById.get(s1.b)
        if (!p00 || !p01 || !p10 || !p11) continue
        const vx = (p00.x + p01.x + p10.x + p11.x) / 4
        const vy = (p00.y + p01.y + p10.y + p11.y) / 4
        const u0x = p01.x - p00.x
        const u0y = p01.y - p00.y
        const u1x = p11.x - p10.x
        const u1y = p11.y - p10.y
        const L0 = Math.hypot(u0x, u0y) || 1
        const L1 = Math.hypot(u1x, u1y) || 1
        const a0 = Math.atan2(u0y / L0, u0x / L0)
        const a1 = Math.atan2(u1y / L1, u1x / L1)
        let label = '—'
        if (v != null && Number.isFinite(v)) {
          label = showDeg
            ? `${((v * 180) / Math.PI).toFixed(1)}°`
            : `${v.toFixed(3)} rad`
        }
        drawAngularDimension(ctx, {
          vx,
          vy,
          r: 28 / z,
          a0,
          a1,
          zoom: z,
          label,
          theme,
        })
      }
    }
  }

  for (const poly of polygons) {
    if (poly.vertexIds.length < 2) continue
    if (poly.outlineViaSegments) continue
    const first = pointById.get(poly.vertexIds[0])
    if (!first) continue
    const polyBase =
      constraintAwareStroke(
        sketchLockState,
        'polygon',
        null,
        poly,
        null,
        null,
        null,
        pal,
      ) ?? baseStroke
    ctx.strokeStyle = shapeStrokeStyle(
      hoverHighlight,
      selectedShape,
      poly.id,
      'polygon',
      polyBase,
    )
    ctx.lineWidth = shapeLineWidth(
      lwGeom,
      hoverHighlight,
      selectedShape,
      poly.id,
      'polygon',
    )
    ctx.beginPath()
    ctx.moveTo(first.x, first.y)
    for (let i = 1; i < poly.vertexIds.length; i++) {
      const v = pointById.get(poly.vertexIds[i])
      if (!v) continue
      ctx.lineTo(v.x, v.y)
    }
    ctx.closePath()
    ctx.stroke()
  }

  for (const c of resolvedCircles) {
    const orig = circles.find((x) => x.id === c.id)
    const circBase =
      constraintAwareStroke(
        sketchLockState,
        'circle',
        null,
        null,
        orig ?? c,
        null,
        null,
        pal,
      ) ?? baseStroke
    ctx.strokeStyle = shapeStrokeStyle(
      hoverHighlight,
      selectedShape,
      c.id,
      'circle',
      circBase,
    )
    ctx.lineWidth = shapeLineWidth(
      lwGeom,
      hoverHighlight,
      selectedShape,
      c.id,
      'circle',
    )
    ctx.beginPath()
    ctx.arc(c.cx, c.cy, c.r, 0, Math.PI * 2)
    ctx.stroke()
  }

  for (const a of arcs) {
    const arcBase =
      constraintAwareStroke(
        sketchLockState,
        'arc',
        null,
        null,
        null,
        null,
        a,
        pal,
      ) ?? baseStroke
    ctx.strokeStyle = shapeStrokeStyle(
      hoverHighlight,
      selectedShape,
      a.id,
      'arc',
      arcBase,
    )
    ctx.lineWidth = shapeLineWidth(
      lwGeom,
      hoverHighlight,
      selectedShape,
      a.id,
      'arc',
    )
    ctx.beginPath()
    ctx.arc(a.cx, a.cy, a.r, a.a0, a.a0 + a.sweep, a.sweep < 0)
    ctx.stroke()
  }

  for (const sp of splines) {
    const verts = sp.vertexIds
      .map((id) => pointById.get(id))
      .filter(Boolean)
    const samples = splineStrokeSamples(sp, pointById)
    const ctrl =
      verts.length >= 2
        ? splineControlSegments(verts, sp.splineType ?? 'catmullRom')
        : []

    if (sp.closed && sp.fill && samples.length >= 3 && fillRegions) {
      ctx.beginPath()
      ctx.moveTo(samples[0].x, samples[0].y)
      for (let i = 1; i < samples.length; i++) {
        ctx.lineTo(samples[i].x, samples[i].y)
      }
      ctx.closePath()
      ctx.fillStyle = pal.closedRegionFill
      ctx.fill()
    }

    if (ctrl.length) {
      ctx.save()
      ctx.setLineDash([5 / z, 4 / z])
      ctx.strokeStyle = pal.splineControl
      ctx.lineWidth = Math.max(0.45, 0.85 / z)
      for (const seg of ctrl) {
        ctx.beginPath()
        ctx.moveTo(seg.ax, seg.ay)
        ctx.lineTo(seg.bx, seg.by)
        ctx.stroke()
      }
      ctx.setLineDash([])
      ctx.restore()
    }

    if (samples.length < 2) continue
    const splineLw = lwGeom * 1.38
    const splBase =
      constraintAwareStroke(
        sketchLockState,
        'spline',
        null,
        null,
        null,
        sp,
        null,
        pal,
      ) ?? pal.splineStroke
    ctx.strokeStyle = shapeStrokeStyle(
      hoverHighlight,
      selectedShape,
      sp.id,
      'spline',
      splBase,
    )
    ctx.lineWidth = shapeLineWidth(
      splineLw,
      hoverHighlight,
      selectedShape,
      sp.id,
      'spline',
    )
    ctx.beginPath()
    ctx.moveTo(samples[0].x, samples[0].y)
    for (let i = 1; i < samples.length; i++) {
      ctx.lineTo(samples[i].x, samples[i].y)
    }
    ctx.stroke()
  }

  const showAngleLabels = labelDrawOptions.showAngleDegrees !== false

  for (const ang of angles) {
    const C = pointById.get(ang.centerId)
    const A = pointById.get(ang.arm1Id)
    const B = pointById.get(ang.arm2Id)
    if (!C || !A || !B) continue
    const aa = Math.atan2(A.y - C.y, A.x - C.x)
    const ab = Math.atan2(B.y - C.y, B.x - C.x)
    const sweep = angleSweepCCW(aa, ab)
    const distA = Math.hypot(A.x - C.x, A.y - C.y)
    const distB = Math.hypot(B.x - C.x, B.y - C.y)
    const markR = Math.min(28, Math.max(10, 0.32 * Math.min(distA, distB)))
    ctx.save()
    ctx.strokeStyle = pal.angleStroke
    ctx.lineWidth = lwGeom
    ctx.beginPath()
    ctx.arc(C.x, C.y, markR, aa, aa + sweep, false)
    ctx.stroke()
    drawAngleDecorations(ctx, C, aa, sweep, markR, z, pal)
    ctx.restore()
    if (showAngleLabels) {
      const mid = aa + sweep / 2
      const lx = C.x + Math.cos(mid) * (markR + 22 / z)
      const ly = C.y + Math.sin(mid) * (markR + 22 / z)
      const deg = ((sweep * 180) / Math.PI).toFixed(1)
      drawWorldText(ctx, lx, ly, z, `${deg}°`, {
        font: '11px Inter, system-ui, sans-serif',
        color: pal.angleLabel,
        align: 'center',
        baseline: 'middle',
      })
    }
  }

  if (showRelations && constraints.length > 0) {
    ctx.save()
    drawConstraintDecorations(
      ctx,
      z,
      {
        constraints,
        segments,
        points,
        circles,
        resolvedCircles,
      },
      {
        relationFill: pal.relationFill,
        relationStroke: pal.relationStroke,
        relationText: pal.relationText,
      },
    )
    ctx.restore()
  }

  if (preview) {
    ctx.save()
    ctx.setLineDash([6 / z, 6 / z])
    ctx.strokeStyle = pal.previewStroke
    ctx.lineWidth = lwGeom
    if (preview.kind === 'segment') {
      ctx.beginPath()
      ctx.moveTo(preview.ax, preview.ay)
      ctx.lineTo(preview.bx, preview.by)
      ctx.stroke()
    } else if (preview.kind === 'circle') {
      ctx.beginPath()
      ctx.arc(preview.cx, preview.cy, preview.r, 0, Math.PI * 2)
      ctx.stroke()
    } else if (preview.kind === 'rect') {
      const w = preview.maxx - preview.minx
      const h = preview.maxy - preview.miny
      ctx.strokeRect(preview.minx, preview.miny, w, h)
    } else if (preview.kind === 'polygon' && preview.verts.length > 0) {
      ctx.beginPath()
      const v0 = preview.verts[0]
      ctx.moveTo(v0.x, v0.y)
      for (let i = 1; i < preview.verts.length; i++) {
        const v = preview.verts[i]
        ctx.lineTo(v.x, v.y)
      }
      if (preview.verts.length >= 3) {
        ctx.closePath()
      }
      ctx.stroke()
    } else if (preview.kind === 'arc') {
      ctx.beginPath()
      ctx.arc(
        preview.cx,
        preview.cy,
        preview.r,
        preview.a0,
        preview.a0 + preview.sweep,
        preview.sweep < 0,
      )
      ctx.stroke()
    } else if (preview.kind === 'spline' && preview.samples?.length > 1) {
      if (preview.showControlHull && preview.hullVerts?.length >= 2) {
        ctx.save()
        ctx.setLineDash([4 / z, 5 / z])
        ctx.strokeStyle = pal.splineControl
        ctx.lineWidth = Math.max(0.85 / z, lwGeom * 0.85)
        ctx.beginPath()
        const h0 = preview.hullVerts[0]
        ctx.moveTo(h0.x, h0.y)
        for (let i = 1; i < preview.hullVerts.length; i++) {
          const hv = preview.hullVerts[i]
          ctx.lineTo(hv.x, hv.y)
        }
        if (preview.hullToCursor) {
          ctx.lineTo(preview.hullToCursor.x, preview.hullToCursor.y)
        }
        ctx.stroke()
        ctx.restore()
      }
      ctx.save()
      ctx.setLineDash([6 / z, 6 / z])
      ctx.strokeStyle = pal.previewStroke
      ctx.lineWidth = Math.max(lwGeom * 1.35, 1.35)
      ctx.beginPath()
      const s0 = preview.samples[0]
      ctx.moveTo(s0.x, s0.y)
      for (let i = 1; i < preview.samples.length; i++) {
        const q = preview.samples[i]
        ctx.lineTo(q.x, q.y)
      }
      ctx.stroke()
      ctx.restore()
    } else if (preview.kind === 'angle' && preview.C && preview.A && preview.B) {
      const { C, A, B } = preview
      const distA = Math.hypot(A.x - C.x, A.y - C.y)
      const distB = Math.hypot(B.x - C.x, B.y - C.y)
      if (distA < 1e-9 && distB < 1e-9) {
        /* skip degenerate preview */
      } else {
      const aa = Math.atan2(A.y - C.y, A.x - C.x)
      const ab = Math.atan2(B.y - C.y, B.x - C.x)
      const sweep = angleSweepCCW(aa, ab)
      const markR = Math.min(28, Math.max(10, 0.32 * Math.min(distA, distB)))
      ctx.beginPath()
      ctx.moveTo(C.x, C.y)
      ctx.lineTo(C.x + Math.cos(aa) * (markR + 40), C.y + Math.sin(aa) * (markR + 40))
      ctx.stroke()
      ctx.beginPath()
      ctx.moveTo(C.x, C.y)
      ctx.lineTo(C.x + Math.cos(ab) * (markR + 40), C.y + Math.sin(ab) * (markR + 40))
      ctx.stroke()
      ctx.strokeStyle = pal.previewAngleAux
      ctx.beginPath()
      ctx.arc(C.x, C.y, markR, aa, aa + sweep, false)
      ctx.stroke()
      drawAngleDecorations(ctx, C, aa, sweep, markR, z, pal)
      }
    } else if (preview.kind === 'linearDimension') {
      ctx.save()
      ctx.globalAlpha = 0.78
      ctx.setLineDash([4 / z, 5 / z])
      drawLinearDimension(ctx, {
        ax: preview.ax,
        ay: preview.ay,
        bx: preview.bx,
        by: preview.by,
        zoom: z,
        label: preview.label ?? '',
        theme,
        offsetWorld:
          preview.offsetWorld != null
            ? preview.offsetWorld
            : DRIVING_DIM_OFFSET_WORLD,
        projection: preview.projection ?? 'aligned',
      })
      ctx.restore()
    } else if (preview.kind === 'angularDimension') {
      ctx.save()
      ctx.globalAlpha = 0.78
      ctx.setLineDash([4 / z, 5 / z])
      drawAngularDimension(ctx, {
        vx: preview.vx,
        vy: preview.vy,
        r: preview.r,
        a0: preview.a0,
        a1: preview.a1,
        zoom: z,
        label: preview.label ?? '—',
        theme,
      })
      ctx.restore()
    } else if (preview.kind === 'radialDimension') {
      ctx.save()
      ctx.globalAlpha = 0.78
      ctx.setLineDash([4 / z, 5 / z])
      drawRadialDimension(ctx, {
        cx: preview.cx,
        cy: preview.cy,
        r: preview.r,
        zoom: z,
        label: preview.label ?? '',
        theme,
        leaderAngle: preview.leaderAngle ?? 0,
        leaderShoulderWorld: preview.leaderShoulderWorld,
      })
      ctx.restore()
    }
    ctx.restore()
  }

  ctx.restore()

  ctx.save()
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  for (const pt of points) {
    let anchorRef = false
    let controlOnSelected = false
    let controlElsewhere = false
    for (const sp of splines) {
      const ids = sp.vertexIds ?? []
      const ix = ids.indexOf(pt.id)
      if (ix < 0) continue
      const role = splineVertexRole(
        sp.splineType ?? 'catmullRom',
        ids.length,
        ix,
        !!sp.closed,
      )
      if (role === 'anchor') anchorRef = true
      else {
        const spSel =
          selectedShape?.kind === 'spline' && selectedShape.id === sp.id
        if (spSel) controlOnSelected = true
        else controlElsewhere = true
      }
    }
    if (!anchorRef && !controlOnSelected && controlElsewhere) continue

    const sel = pt.id === selectedPointId
    const hov = hoverHighlight?.kind === 'point' && hoverHighlight.id === pt.id
    const splineStart =
      splineAnchorPointId != null && pt.id === splineAnchorPointId
    const sx = pt.x * z + pan.x
    const sy = pt.y * z + pan.y
    const smallHandle = controlOnSelected && !anchorRef
    const pr = smallHandle
      ? sel
        ? 4.5
        : hov
          ? 5
          : 3.25
      : sel
        ? 6
        : hov
          ? 7
          : splineStart
            ? 6
            : 5
    ctx.fillStyle = splineStart ? pal.pointSplineStart : pal.pointFill
    ctx.strokeStyle = sel
      ? pal.pointSel
      : hov
        ? pal.pointHov
        : pt.isLocked
          ? 'rgba(52, 211, 153, 0.92)'
          : splineStart
            ? pal.pointSplineStartRing
            : pal.pointStroke
    ctx.lineWidth = sel ? 3 : hov ? 2.5 : splineStart ? 2.75 : 2
    ctx.beginPath()
    ctx.arc(sx, sy, pr, 0, Math.PI * 2)
    ctx.fill()
    ctx.stroke()
  }
  ctx.restore()
}
