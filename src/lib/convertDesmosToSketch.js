/**
 * Samples Desmos graph expressions into polylines and builds workspace patches
 * (points, segments, optional filled polygon when closed).
 */

const SAMPLE_COUNT = 96

/**
 * Replace standalone variable x in RHS LaTeX with numeric literal for HelperExpression.
 * @param {string} rhs
 * @param {number} xv
 */
function substituteXSimple(rhs, xv) {
  const lit = Number.isFinite(xv) ? xv : 0
  return rhs.replace(/(?<!\\)\bx\b/g, `{${lit}}`)
}

/**
 * @param {object} calculator Desmos.GraphingCalculator
 * @param {string} latex
 * @returns {Promise<number | null>}
 */
function helperNumeric(calculator, latex) {
  const Desmos = window.Desmos
  if (!Desmos?.HelperExpression) return Promise.resolve(null)
  return new Promise((resolve) => {
    try {
      const h = Desmos.HelperExpression({ calculator, latex })
      let settled = false
      const finish = () => {
        if (settled) return
        const v = h.numericValue
        if (v != null && Number.isFinite(v)) {
          settled = true
          try {
            h.unobserve?.('numericValue', finish)
          } catch {
            /* ignore */
          }
          resolve(v)
        }
      }
      h.observe?.('numericValue', finish)
      finish()
      window.setTimeout(() => {
        if (!settled) {
          settled = true
          resolve(h.numericValue != null && Number.isFinite(h.numericValue) ? h.numericValue : null)
        }
      }, 80)
    } catch {
      resolve(null)
    }
  })
}

/**
 * @param {object} calculator
 * @returns {{ left: number; right: number; bottom: number; top: number }}
 */
export function getCalculatorMathBounds(calculator) {
  try {
    const m = calculator?.graphpaperBounds ?? calculator?.getMathBounds?.()
    if (m && Number.isFinite(m.left ?? m.xmin)) {
      return {
        left: m.left ?? m.xmin ?? -10,
        right: m.right ?? m.xmax ?? 10,
        bottom: m.bottom ?? m.ymin ?? -10,
        top: m.top ?? m.ymax ?? 10,
      }
    }
  } catch {
    /* ignore */
  }
  return { left: -12, right: 12, bottom: -12, top: 12 }
}

/**
 * Parse `y = ...` style expression latex.
 * @param {string} latex
 * @returns {string | null} RHS latex
 */
export function extractYEqualsRhs(latex) {
  if (!latex || typeof latex !== 'string') return null
  const t = latex.trim()
  const m = t.match(/^\s*y\s*=\s*(.+)$/is)
  return m ? m[1].trim() : null
}

/**
 * Sample one explicit y=f(x) curve.
 * @param {object} calculator
 * @param {string} rhsLatex
 * @param {{ left: number; right: number }} bounds
 * @returns {Promise<{ x: number; y: number }[]>}
 */
async function sampleExplicitCurve(calculator, rhsLatex, bounds) {
  const pts = []
  const { left, right } = bounds
  if (!Number.isFinite(left) || !Number.isFinite(right) || right <= left) return pts
  for (let i = 0; i <= SAMPLE_COUNT; i++) {
    const t = i / SAMPLE_COUNT
    const x = left + t * (right - left)
    if (!Number.isFinite(x)) continue
    const sub = substituteXSimple(rhsLatex, x)
    const y = await helperNumeric(calculator, sub)
    if (y != null && Number.isFinite(y)) {
      pts.push({ x, y })
    }
  }
  return pts
}

/**
 * Sample a table expression into polylines (one per row pair of columns).
 * @param {object} ex Desmos expression object
 * @returns {{ x: number; y: number }[][]}
 */
function polylinesFromTable(ex) {
  const cols = ex.columns ?? []
  if (cols.length < 2) return []
  let xCol = cols.find((c) => /x/i.test(String(c.latex ?? c.name ?? '')))
  let yCol = cols.find((c) => /y/i.test(String(c.latex ?? c.name ?? '')))
  if (!xCol?.values || !yCol?.values) {
    xCol = cols[0]
    yCol = cols[1]
  }
  if (!xCol?.values || !yCol?.values) return []
  const n = Math.min(xCol.values.length, yCol.values.length)
  const pts = []
  for (let i = 0; i < n; i++) {
    const x = Number(xCol.values[i])
    const y = Number(yCol.values[i])
    if (Number.isFinite(x) && Number.isFinite(y)) pts.push({ x, y })
  }
  return pts.length ? [pts] : []
}

/**
 * Extract drawable expression list from calculator.
 * @param {object} calculator
 * @returns {object[]}
 */
export function getDrawableExpressions(calculator) {
  try {
    const list = calculator.getExpressions?.() ?? []
    return list.filter((e) => {
      if (!e || e.hidden) return false
      if (e.type === 'folder') return false
      return e.type === 'expression' || e.type === 'table'
    })
  } catch {
    return []
  }
}

/**
 * Build workspace updater: append points, segments, and optional filled polygon.
 *
 * @param {object} data current workspace
 * @param {{ x: number; y: number }[][]} polylines
 * @param {(p: string) => string} nextId
 * @param {{ defaultFillRgba?: string }} [opts]
 * @returns {object} new workspace data
 */
export function mergePolylinesIntoWorkspace(data, polylines, nextId, opts = {}) {
  const fill = opts.defaultFillRgba ?? 'rgba(59, 130, 246, 0.22)'
  let next = { ...data }
  const constraints = [...(next.constraints ?? [])]

  for (const line of polylines) {
    if (!line || line.length < 2) continue
    const ids = []
    const newPts = []
    for (const v of line) {
      if (!Number.isFinite(v.x) || !Number.isFinite(v.y)) continue
      const id = nextId('p')
      ids.push(id)
      newPts.push({ id, x: v.x, y: v.y })
    }
    if (ids.length < 2) continue

    const newSegs = []
    const boundarySegmentIds = []
    for (let i = 0; i < ids.length - 1; i++) {
      const sid = nextId('seg')
      boundarySegmentIds.push(sid)
      newSegs.push({ id: sid, a: ids[i], b: ids[i + 1], geoRegistered: true })
    }

    const first = line[0]
    const last = line[line.length - 1]
    const closed =
      Math.hypot(first.x - last.x, first.y - last.y) <
      Math.max(1e-3, 1e-4 * (Math.abs(first.x) + Math.abs(first.y) + 1))

    if (closed && ids.length >= 3) {
      const sid = nextId('seg')
      boundarySegmentIds.push(sid)
      newSegs.push({
        id: sid,
        a: ids[ids.length - 1],
        b: ids[0],
        geoRegistered: true,
      })
    }

    const polyChunk =
      closed && ids.length >= 3
        ? [
            {
              id: nextId('poly'),
              vertexIds: ids,
              fill,
              geoRegistered: true,
              outlineViaSegments: true,
              boundarySegmentIds,
            },
          ]
        : []

    next = {
      ...next,
      points: [...next.points, ...newPts],
      segments: [...next.segments, ...newSegs],
      polygons: [...(next.polygons ?? []), ...polyChunk],
      constraints,
    }
  }

  return next
}

/**
 * Convert Desmos calculator graphs to polylines then merge into workspace via commit callback.
 *
 * @param {object} calculator
 * @param {(fn: (d: object) => object) => void} commit
 * @param {(p: string) => string} nextId
 * @param {{ defaultFillRgba?: string }} [opts]
 * @returns {Promise<number>} number of polylines merged
 */
export async function convertDesmosToSketch(calculator, commit, nextId, opts = {}) {
  if (!calculator?.getExpressions) return 0

  const bounds = getCalculatorMathBounds(calculator)
  const expressions = getDrawableExpressions(calculator)
  /** @type {{ x: number; y: number }[][]} */
  const polylines = []

  for (const ex of expressions) {
    if (ex.type === 'table') {
      const fromT = polylinesFromTable(ex)
      for (const pl of fromT) polylines.push(pl)
      continue
    }
    if (ex.type === 'expression' && ex.latex) {
      const rhs = extractYEqualsRhs(ex.latex)
      if (rhs) {
        const pts = await sampleExplicitCurve(calculator, rhs, {
          left: bounds.left,
          right: bounds.right,
        })
        if (pts.length >= 2) polylines.push(pts)
      }
    }
  }

  if (polylines.length === 0) return 0

  commit((d) => mergePolylinesIntoWorkspace(d, polylines, nextId, opts))
  return polylines.length
}
