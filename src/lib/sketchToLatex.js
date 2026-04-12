/**
 * Converts sketch geometry into a single Desmos parametric (x(t), y(t)) using
 * piecewise-linear segments on t ∈ [0, N) (one unit per edge of a closed polygon).
 */

/**
 * @param {{ x: number; y: number }[]} verts ordered vertices (closed polygon, no duplicate closing point)
 * @returns {string | null} LaTeX for parametric pair (x(t), y(t))
 */
export function buildClosedPolygonParametricLatex(verts) {
  if (!verts || verts.length < 3) return null
  const n = verts.length
  const xs = verts.map((p) => p.x)
  const ys = verts.map((p) => p.y)
  if (xs.some((x) => !Number.isFinite(x)) || ys.some((y) => !Number.isFinite(y)))
    return null

  const xParts = []
  const yParts = []
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n
    const xa = xs[i]
    const ya = ys[i]
    const xb = xs[j]
    const yb = ys[j]
    const cond = `${i}\\le t <${i + 1}`
    const xExpr = `${xa}+\\left(t-${i}\\right)\\cdot\\left(${xb}-${xa}\\right)`
    const yExpr = `${ya}+\\left(t-${i}\\right)\\cdot\\left(${yb}-${ya}\\right)`
    xParts.push(`${cond}:${xExpr}`)
    yParts.push(`${cond}:${yExpr}`)
  }

  const xPw = `\\left\\{${xParts.join(',')}\\right\\}`
  const yPw = `\\left\\{${yParts.join(',')}\\right\\}`
  return `\\left(${xPw},${yPw}\\right)`
}

/**
 * @param {object} data workspace snapshot
 * @returns {{ x: number; y: number }[] | null}
 */
export function getFirstClosedPolygonVertices(data) {
  const polys = data?.polygons ?? []
  const pmap = new Map((data?.points ?? []).map((p) => [p.id, p]))
  for (const poly of polys) {
    const ids = poly?.vertexIds ?? []
    if (ids.length < 3) continue
    const verts = []
    for (const id of ids) {
      const p = pmap.get(id)
      if (!p || !Number.isFinite(p.x) || !Number.isFinite(p.y)) {
        verts.length = 0
        break
      }
      verts.push({ x: p.x, y: p.y })
    }
    if (verts.length >= 3) return verts
  }
  return null
}

/**
 * Build Desmos parametric LaTeX from the first filled polygon in the workspace.
 *
 * @param {object} data
 * @returns {string | null}
 */
export function workspacePolygonToDesmosParametricLatex(data) {
  const verts = getFirstClosedPolygonVertices(data)
  if (!verts) return null
  return buildClosedPolygonParametricLatex(verts)
}

/**
 * Push a piecewise polygon parametric into the calculator (adds / overwrites gg_* ids).
 *
 * @param {any} calculator
 * @param {object} data workspace
 * @returns {boolean}
 */
export function injectPolygonSketchIntoDesmosCalculator(calculator, data) {
  if (!calculator?.setExpression) return false
  const latex = workspacePolygonToDesmosParametricLatex(data)
  if (!latex) return false
  try {
    calculator.setExpression({
      id: 'geargen_sketch_poly',
      latex,
    })
    return true
  } catch {
    return false
  }
}
