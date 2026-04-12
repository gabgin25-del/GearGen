/**
 * Desmos → GearGen sketch bridge: sample calculator expressions into polylines
 * (explicit, parametric, polar, inequalities → boundary, tables) and merge into workspace.
 * Segments use geoRegistered: true for GCS / fill / boolean compatibility.
 */

/** High-density sampling along each curve layer */
export const DEFAULT_SAMPLE_COUNT = 256

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
          const v = h.numericValue
          resolve(v != null && Number.isFinite(v) ? v : null)
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
 * Replace standalone variable x in RHS LaTeX with numeric literal for HelperExpression.
 * @param {string} rhs
 * @param {number} xv
 */
function substituteXSimple(rhs, xv) {
  const lit = Number.isFinite(xv) ? xv : 0
  return rhs.replace(/(?<!\\)\bx\b/g, `{${lit}}`)
}

/**
 * Replace bare `t` (not \\t) with numeric literal.
 * @param {string} expr
 * @param {number} tv
 */
function substituteT(expr, tv) {
  const lit = Number.isFinite(tv) ? tv : 0
  return expr.replace(/(?<!\\)\bt\b/g, `{${lit}}`)
}

/**
 * Replace \\theta with numeric literal.
 * @param {string} expr
 * @param {number} th
 */
function substituteTheta(expr, th) {
  const lit = Number.isFinite(th) ? th : 0
  return expr.replace(/\\theta\b/g, `{${lit}}`)
}

/**
 * Inequality / interval boundary: use equality form for tracing (e.g. x^2+y^2 \le 16 → x^2+y^2=16).
 * @param {string} latex
 */
export function normalizeInequalityToBoundary(latex) {
  if (!latex || typeof latex !== 'string') return latex
  let s = latex.trim()
  if (!/\\le|\\leq|\\ge|\\geq|≤|≥/.test(s)) return s
  return s
    .replace(/\\le(?![a-z])/g, '=')
    .replace(/\\leq(?![a-z])/g, '=')
    .replace(/\\ge(?![a-z])/g, '=')
    .replace(/\\geq(?![a-z])/g, '=')
    .replace(/≤/g, '=')
    .replace(/≥/g, '=')
    .trim()
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
 * @param {string} latex
 * @returns {string | null}
 */
export function extractXEqualsRhs(latex) {
  if (!latex || typeof latex !== 'string') return null
  const t = latex.trim()
  const m = t.match(/^\s*x\s*=\s*(.+)$/is)
  return m ? m[1].trim() : null
}

/**
 * Polar r = f(θ) in radians.
 * @param {string} latex
 * @returns {string | null} RHS
 */
export function extractPolarRhs(latex) {
  if (!latex || typeof latex !== 'string') return null
  const t = latex.trim()
  const m = t.match(/^\s*r\s*=\s*(.+)$/is)
  return m ? m[1].trim() : null
}

/**
 * @param {string} s
 * @returns {[string, string] | null}
 */
function splitTopLevelComma(s) {
  let depth = 0
  for (let i = 0; i < s.length; i++) {
    const c = s[i]
    if (c === '(' || c === '{') depth += 1
    if (c === ')' || c === '}') depth -= 1
    if (c === ',' && depth === 0) {
      return [s.slice(0, i).trim(), s.slice(i + 1).trim()]
    }
  }
  return null
}

/**
 * @param {string} latex
 * @returns {{ xExpr: string; yExpr: string } | null}
 */
export function extractParametricPair(latex) {
  if (!latex || typeof latex !== 'string') return null
  let t = latex.trim()
  if (t.includes('=')) return null
  if (t.startsWith('\\left(') && t.endsWith('\\right)')) {
    t = t.slice(6, -7).trim()
  } else if (t.startsWith('(') && t.endsWith(')')) {
    t = t.slice(1, -1).trim()
  } else {
    return null
  }
  const parts = splitTopLevelComma(t)
  if (!parts) return null
  const [a, b] = parts
  if (!a || !b) return null
  if (!/(?<!\\)\bt\b|\\theta/.test(a + b)) return null
  return { xExpr: a, yExpr: b }
}

/**
 * Try x^2+y^2=C (circle boundary).
 * @param {string} boundaryLatex
 * @param {object} calculator
 * @returns {Promise<{ x: number; y: number }[] | null>}
 */
async function sampleCircleX2Y2Equals(
  boundaryLatex,
  calculator,
  sampleCount,
) {
  const compact = boundaryLatex.replace(/\s+/g, '')
  const m = compact.match(/^x\^2\+y\^2=(.+)$/i)
  if (!m) return null
  const rhs = m[1]
  const C = await helperNumeric(calculator, rhs)
  if (C == null || !Number.isFinite(C) || C <= 0) return null
  const r = Math.sqrt(C)
  if (!Number.isFinite(r) || r <= 0) return null
  const pts = []
  const n = Math.max(8, sampleCount)
  for (let i = 0; i <= n; i++) {
    const u = (i / n) * 2 * Math.PI
    const x = r * Math.cos(u)
    const y = r * Math.sin(u)
    if (Number.isFinite(x) && Number.isFinite(y)) pts.push({ x, y })
  }
  return pts.length >= 2 ? pts : null
}

/**
 * @param {object} calculator
 * @param {string} rhsLatex
 * @param {{ left: number; right: number }} bounds
 * @param {number} sampleCount
 */
async function sampleExplicitY(calculator, rhsLatex, bounds, sampleCount) {
  const pts = []
  const { left, right } = bounds
  if (!Number.isFinite(left) || !Number.isFinite(right) || right <= left)
    return pts
  const n = Math.max(4, sampleCount)
  for (let i = 0; i <= n; i++) {
    const t = i / n
    const x = left + t * (right - left)
    if (!Number.isFinite(x)) continue
    const sub = substituteXSimple(rhsLatex, x)
    const y = await helperNumeric(calculator, sub)
    if (y != null && Number.isFinite(y)) pts.push({ x, y })
  }
  return pts
}

/**
 * @param {object} calculator
 * @param {string} rhsLatex
 * @param {{ bottom: number; top: number }} bounds
 * @param {number} sampleCount
 */
async function sampleExplicitX(calculator, rhsLatex, bounds, sampleCount) {
  const pts = []
  const { bottom, top } = bounds
  if (!Number.isFinite(bottom) || !Number.isFinite(top) || top <= bottom)
    return pts
  const n = Math.max(4, sampleCount)
  for (let i = 0; i <= n; i++) {
    const t = i / n
    const y = bottom + t * (top - bottom)
    if (!Number.isFinite(y)) continue
    const sub = rhsLatex.replace(/(?<!\\)\by\b/g, `{${y}}`)
    const x = await helperNumeric(calculator, sub)
    if (x != null && Number.isFinite(x)) pts.push({ x, y })
  }
  return pts
}

/**
 * @param {object} calculator
 * @param {string} rhsLatex
 * @param {number} sampleCount
 */
async function samplePolarCurve(calculator, rhsLatex, sampleCount) {
  const pts = []
  const n = Math.max(16, sampleCount)
  for (let i = 0; i <= n; i++) {
    const th = (i / n) * 2 * Math.PI
    if (!Number.isFinite(th)) continue
    const sub = substituteTheta(rhsLatex, th)
    const r = await helperNumeric(calculator, sub)
    if (r == null || !Number.isFinite(r)) continue
    const x = r * Math.cos(th)
    const y = r * Math.sin(th)
    if (Number.isFinite(x) && Number.isFinite(y)) pts.push({ x, y })
  }
  return pts
}

/**
 * @param {object} calculator
 * @param {{ xExpr: string; yExpr: string }} pair
 * @param {number} sampleCount
 */
async function sampleParametricCurve(calculator, pair, sampleCount) {
  const pts = []
  const n = Math.max(16, sampleCount)
  const useTheta = /\\theta/.test(pair.xExpr + pair.yExpr)
  for (let i = 0; i <= n; i++) {
    const u = i / n
    if (!Number.isFinite(u)) continue
    const param = useTheta ? u * 2 * Math.PI : u
    let xL = substituteT(pair.xExpr, param)
    let yL = substituteT(pair.yExpr, param)
    if (useTheta) {
      xL = substituteTheta(xL, param)
      yL = substituteTheta(yL, param)
    }
    const x = await helperNumeric(calculator, xL)
    const y = await helperNumeric(calculator, yL)
    if (
      x != null &&
      y != null &&
      Number.isFinite(x) &&
      Number.isFinite(y)
    ) {
      pts.push({ x, y })
    }
  }
  return pts
}

/**
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
 * @param {object} calculator
 * @param {string} latex
 * @param {{ left: number; right: number; bottom: number; top: number }} bounds
 * @param {number} sampleCount
 * @returns {Promise<{ x: number; y: number }[] | null>}
 */
async function sampleExpressionLatex(
  calculator,
  latex,
  bounds,
  sampleCount,
) {
  const raw = latex.trim()
  const boundary = normalizeInequalityToBoundary(raw)

  const yRhs = extractYEqualsRhs(boundary)
  if (yRhs) {
    const pts = await sampleExplicitY(calculator, yRhs, bounds, sampleCount)
    return pts.length >= 2 ? pts : null
  }

  const xRhs = extractXEqualsRhs(boundary)
  if (xRhs) {
    const pts = await sampleExplicitX(
      calculator,
      xRhs,
      { bottom: bounds.bottom, top: bounds.top },
      sampleCount,
    )
    return pts.length >= 2 ? pts : null
  }

  const polarRhs = extractPolarRhs(boundary)
  if (polarRhs) {
    const pts = await samplePolarCurve(calculator, polarRhs, sampleCount)
    return pts.length >= 2 ? pts : null
  }

  const param = extractParametricPair(boundary)
  if (param) {
    const pts = await sampleParametricCurve(calculator, param, sampleCount)
    return pts.length >= 2 ? pts : null
  }

  const circ = await sampleCircleX2Y2Equals(boundary, calculator, sampleCount)
  if (circ) return circ

  return null
}

/**
 * Sync Desmos calculator graphs into the workspace (same entity model as hand-drawn geometry).
 *
 * @param {object} calculator
 * @param {(fn: (d: object) => object) => void} commit
 * @param {(p: string) => string} nextId
 * @param {{ defaultFillRgba?: string; sampleCount?: number }} [opts]
 * @returns {Promise<number>} number of polyline layers merged
 */
export async function syncDesmosExpressionsToWorkspace(
  calculator,
  commit,
  nextId,
  opts = {},
) {
  if (!calculator?.getExpressions) return 0

  const sampleCount = opts.sampleCount ?? DEFAULT_SAMPLE_COUNT
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
      const pts = await sampleExpressionLatex(
        calculator,
        ex.latex,
        bounds,
        sampleCount,
      )
      if (pts && pts.length >= 2) polylines.push(pts)
    }
  }

  if (polylines.length === 0) return 0

  commit((d) => mergePolylinesIntoWorkspace(d, polylines, nextId, opts))
  return polylines.length
}
