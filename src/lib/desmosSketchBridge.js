/**
 * Maps a fully-resolved GearGen workspace into Desmos calculator expressions.
 * Uses tables and segment polylines so the graph matches sketch coordinates (world units).
 */

const PREFIX = 'gg_'

/** @type {string[]} */
let lastPushedIds = []

/**
 * @param {object} data workspace snapshot
 * @returns {{ expressions: object[], mathBounds?: { left: number; right: number; bottom: number; top: number } } | null}
 */
export function buildDesmosExpressionsFromWorkspace(data) {
  const diag = data?.solverDiagnostics
  const fullyDefined =
    diag?.engine === 'planegcs' &&
    diag?.fullyDefined === true &&
    diag?.solveFailed !== true

  if (!fullyDefined) return null

  const points = data?.points ?? []
  if (points.length === 0) return null

  const pmap = new Map(points.map((p) => [p.id, p]))
  const segments = data?.segments ?? []

  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const p of points) {
    if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) continue
    minX = Math.min(minX, p.x)
    minY = Math.min(minY, p.y)
    maxX = Math.max(maxX, p.x)
    maxY = Math.max(maxY, p.y)
  }
  if (!Number.isFinite(minX)) return null

  const pad = Math.max(8, 0.08 * Math.max(maxX - minX, maxY - minY, 1))
  const bounds = {
    left: minX - pad,
    right: maxX + pad,
    bottom: minY - pad,
    top: maxY + pad,
  }

  const xs = []
  const ys = []
  for (const p of points) {
    if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) continue
    xs.push(p.x)
    ys.push(p.y)
  }
  if (xs.length === 0) return null

  /** @type {object[]} */
  const expressions = [
    {
      id: `${PREFIX}title`,
      type: 'text',
      text: 'GearGen sketch (fully defined, PlaneGCS)',
    },
    {
      id: `${PREFIX}points`,
      type: 'table',
      columns: [
        { latex: 'x_1', values: xs },
        { latex: 'y_1', values: ys },
      ],
    },
  ]

  let segIdx = 0
  for (const s of segments) {
    const pa = pmap.get(s.a)
    const pb = pmap.get(s.b)
    if (
      !pa ||
      !pb ||
      !Number.isFinite(pa.x) ||
      !Number.isFinite(pa.y) ||
      !Number.isFinite(pb.x) ||
      !Number.isFinite(pb.y)
    ) {
      continue
    }
    const dx = pb.x - pa.x
    const dy = pb.y - pa.y
    if (Math.hypot(dx, dy) < 1e-9) continue
    const m = dy / dx
    const latex =
      Math.abs(dx) < 1e-9
        ? `x=${pa.x.toFixed(6)}\\left\\{${Math.min(pa.y, pb.y).toFixed(6)}\\le y \\le ${Math.max(pa.y, pb.y).toFixed(6)}\\right\\}`
        : `y-${pa.y.toFixed(6)}=${m.toFixed(9)}\\left(x-${pa.x.toFixed(6)}\\right)\\left\\{${Math.min(pa.x, pb.x).toFixed(6)}\\le x \\le ${Math.max(pa.x, pb.x).toFixed(6)}\\right\\}`
    expressions.push({
      id: `${PREFIX}seg_${segIdx}`,
      latex,
    })
    segIdx += 1
  }

  return { expressions, mathBounds: bounds }
}

/**
 * @param {any} calculator Desmos.GraphingCalculator
 * @param {object} data workspace
 */
export function applyWorkspaceToDesmosCalculator(calculator, data) {
  if (!calculator?.setExpression) return
  if (lastPushedIds.length && calculator.removeExpressions) {
    try {
      calculator.removeExpressions([...lastPushedIds])
    } catch {
      /* ignore */
    }
  }
  lastPushedIds = []
  const built = buildDesmosExpressionsFromWorkspace(data)
  if (!built) return
  for (const ex of built.expressions) {
    if (ex.id) lastPushedIds.push(ex.id)
    try {
      calculator.setExpression(ex)
    } catch {
      /* ignore malformed latex on edge cases */
    }
  }
  if (built.mathBounds && calculator.setMathBounds) {
    try {
      calculator.setMathBounds(built.mathBounds)
    } catch {
      /* ignore */
    }
  }
}
