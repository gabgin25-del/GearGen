/**
 * Geometric constraint solver: prefers FreeCAD PlaneGCS (WASM); falls back to
 * damped Gauss–Newton when PlaneGCS is unavailable or sketch uses unsupported relations.
 */

import { recomputeBoundArcs } from './arcPointBindings.js'
import { cloneWorkspaceData } from './workspaceReducer.js'
import { relaxAllConstraints } from './sketchConstraintQuality.js'
import { solveWithPlaneGcs } from './planeGcs/solvePlaneGcs.js'

const DEFAULT_MAX_ITER = 42
const DEFAULT_TOL = 1e-5
const LAMBDA0 = 1e-4
const STEP_CAP = 120

/** @param {number[][]} A @param {number[]} b */
function solveSymmetric(A, b) {
  const n = b.length
  const M = A.map((row, i) => [...row, b[i]])
  for (let k = 0; k < n; k++) {
    let piv = k
    let best = Math.abs(M[k][k])
    for (let i = k + 1; i < n; i++) {
      const v = Math.abs(M[i][k])
      if (v > best) {
        best = v
        piv = i
      }
    }
    if (best < 1e-18) continue
    if (piv !== k) {
      const t = M[k]
      M[k] = M[piv]
      M[piv] = t
    }
    const akk = M[k][k]
    for (let j = k; j <= n; j++) M[k][j] /= akk
    for (let i = 0; i < n; i++) {
      if (i === k) continue
      const f = M[i][k]
      if (Math.abs(f) < 1e-18) continue
      for (let j = k; j <= n; j++) {
        M[i][j] -= f * M[k][j]
      }
    }
  }
  const x = new Array(n).fill(0)
  for (let i = 0; i < n; i++) x[i] = M[i][n]
  return x
}

/**
 * @param {object} data
 * @param {Map<string, number>} idx point id -> flat index (2*i for x)
 * @param {number} nv
 * @returns {{ r: number[]; rows: { idx: number; val: number }[][] }}
 */
function buildSystem(data, idx, nv) {
  const r = []
  /** @type {{ idx: number; val: number }[][]} */
  const rows = []
  const pmap = new Map(data.points.map((p) => [p.id, p]))

  const addRow = (res, sparseRow) => {
    r.push(res)
    rows.push(sparseRow)
  }

  const vx = (id) => idx.get(id)
  const row2 = (id) => {
    const b = vx(id)
    if (b == null) return null
    return { x: b, y: b + 1 }
  }

  for (const c of data.constraints ?? []) {
    const t = c.targets ?? []

    if (c.type === 'fixOrigin' && t.length === 1 && t[0].kind === 'point') {
      const p = pmap.get(t[0].id)
      const ri = row2(t[0].id)
      if (p && ri) {
        addRow(p.x, [{ idx: ri.x, val: 1 }])
        addRow(p.y, [{ idx: ri.y, val: 1 }])
      }
      continue
    }

    if (
      c.type === 'coincident' &&
      t.length === 2 &&
      t[0].kind === 'point' &&
      t[1].kind === 'point'
    ) {
      const pa = pmap.get(t[0].id)
      const pb = pmap.get(t[1].id)
      const ia = row2(t[0].id)
      const ib = row2(t[1].id)
      if (pa && pb && ia && ib) {
        addRow(pa.x - pb.x, [
          { idx: ia.x, val: 1 },
          { idx: ib.x, val: -1 },
        ])
        addRow(pa.y - pb.y, [
          { idx: ia.y, val: 1 },
          { idx: ib.y, val: -1 },
        ])
      }
      continue
    }

    if (
      c.type === 'horizontal' &&
      t.length === 1 &&
      t[0].kind === 'segment'
    ) {
      const seg = data.segments.find((s) => s.id === t[0].id)
      if (!seg) continue
      const pa = pmap.get(seg.a)
      const pb = pmap.get(seg.b)
      const ia = row2(seg.a)
      const ib = row2(seg.b)
      if (pa && pb && ia && ib) {
        addRow(pa.y - pb.y, [
          { idx: ia.y, val: 1 },
          { idx: ib.y, val: -1 },
        ])
      }
      continue
    }

    if (c.type === 'vertical' && t.length === 1 && t[0].kind === 'segment') {
      const seg = data.segments.find((s) => s.id === t[0].id)
      if (!seg) continue
      const pa = pmap.get(seg.a)
      const pb = pmap.get(seg.b)
      const ia = row2(seg.a)
      const ib = row2(seg.b)
      if (pa && pb && ia && ib) {
        addRow(pa.x - pb.x, [
          { idx: ia.x, val: 1 },
          { idx: ib.x, val: -1 },
        ])
      }
      continue
    }

    if (
      (c.type === 'parallel' || c.type === 'perpendicular') &&
      t.length === 2 &&
      t[0].kind === 'segment' &&
      t[1].kind === 'segment'
    ) {
      const seg0 = data.segments.find((s) => s.id === t[0].id)
      const seg1 = data.segments.find((s) => s.id === t[1].id)
      if (!seg0 || !seg1) continue
      const pa0 = pmap.get(seg0.a)
      const pb0 = pmap.get(seg0.b)
      const pa1 = pmap.get(seg1.a)
      const pb1 = pmap.get(seg1.b)
      const i00 = row2(seg0.a)
      const i01 = row2(seg0.b)
      const i10 = row2(seg1.a)
      const i11 = row2(seg1.b)
      if (!pa0 || !pb0 || !pa1 || !pb1 || !i00 || !i01 || !i10 || !i11) continue
      const v0x = pb0.x - pa0.x
      const v0y = pb0.y - pa0.y
      const v1x = pb1.x - pa1.x
      const v1y = pb1.y - pa1.y
      if (c.type === 'parallel') {
        const res = v0x * v1y - v0y * v1x
        addRow(res, [
          { idx: i00.x, val: -v1y },
          { idx: i00.y, val: v1x },
          { idx: i01.x, val: v1y },
          { idx: i01.y, val: -v1x },
          { idx: i10.x, val: v0y },
          { idx: i10.y, val: -v0x },
          { idx: i11.x, val: -v0y },
          { idx: i11.y, val: v0x },
        ])
      } else {
        const res = v0x * v1x + v0y * v1y
        addRow(res, [
          { idx: i00.x, val: -v1x },
          { idx: i00.y, val: -v1y },
          { idx: i01.x, val: v1x },
          { idx: i01.y, val: v1y },
          { idx: i10.x, val: -v0x },
          { idx: i10.y, val: -v0y },
          { idx: i11.x, val: v0x },
          { idx: i11.y, val: v0y },
        ])
      }
      continue
    }

    if (
      c.type === 'anchorAt' &&
      t.length === 1 &&
      t[0].kind === 'point' &&
      c.x != null &&
      c.y != null
    ) {
      const p = pmap.get(t[0].id)
      const ri = row2(t[0].id)
      if (p && ri) {
        addRow(p.x - c.x, [{ idx: ri.x, val: 1 }])
        addRow(p.y - c.y, [{ idx: ri.y, val: 1 }])
      }
      continue
    }

    if (
      c.type === 'lockCoordX' &&
      t.length === 1 &&
      t[0].kind === 'point' &&
      c.value != null
    ) {
      const p = pmap.get(t[0].id)
      const ri = row2(t[0].id)
      if (p && ri) {
        addRow(p.x - c.value, [{ idx: ri.x, val: 1 }])
      }
      continue
    }

    if (
      c.type === 'lockCoordY' &&
      t.length === 1 &&
      t[0].kind === 'point' &&
      c.value != null
    ) {
      const p = pmap.get(t[0].id)
      const ri = row2(t[0].id)
      if (p && ri) {
        addRow(p.y - c.value, [{ idx: ri.y, val: 1 }])
      }
      continue
    }

    // pointOnSegment: handled by relaxAllConstraints after each GN step
  }

  for (const dim of data.dimensions ?? []) {
    if (dim.type === 'distance' && dim.targets?.length >= 1) {
      const segId = dim.targets[0]
      const L0 = dim.value
      if (L0 == null || !Number.isFinite(L0) || L0 <= 0) continue
      const seg = data.segments.find((s) => s.id === segId)
      if (!seg) continue
      const pa = pmap.get(seg.a)
      const pb = pmap.get(seg.b)
      const ia = row2(seg.a)
      const ib = row2(seg.b)
      if (!pa || !pb || !ia || !ib) continue
      const dx = pb.x - pa.x
      const dy = pb.y - pa.y
      const L = Math.hypot(dx, dy)
      if (L < 1e-12) continue
      const res = L - L0
      addRow(res, [
        { idx: ia.x, val: -dx / L },
        { idx: ia.y, val: -dy / L },
        { idx: ib.x, val: dx / L },
        { idx: ib.y, val: dy / L },
      ])
      continue
    }

    if (dim.type === 'angle' && dim.targets?.length >= 3) {
      const [idC, idA, idB] = dim.targets
      const C = pmap.get(idC)
      const A = pmap.get(idA)
      const B = pmap.get(idB)
      const iC = row2(idC)
      const iA = row2(idA)
      const iB = row2(idB)
      if (!C || !A || !B || !iC || !iA || !iB) continue
      const v0 = dim.value
      if (v0 == null || !Number.isFinite(v0)) continue

      const angleRes = (c, a, b) => {
        const a1 = Math.atan2(a.y - c.y, a.x - c.x)
        const a2 = Math.atan2(b.y - c.y, b.x - c.x)
        let sweep = a2 - a1
        while (sweep <= -Math.PI) sweep += 2 * Math.PI
        while (sweep > Math.PI) sweep -= 2 * Math.PI
        return sweep - v0
      }
      const base = angleRes(C, A, B)
      const eps = 1e-5
      const bumps = [
        [idC, 'x', iC.x],
        [idC, 'y', iC.y],
        [idA, 'x', iA.x],
        [idA, 'y', iA.y],
        [idB, 'x', iB.x],
        [idB, 'y', iB.y],
      ]
      const sparse = []
      for (const [pid, axis, flatIdx] of bumps) {
        const c = pmap.get(idC)
        const a = pmap.get(idA)
        const b = pmap.get(idB)
        if (!c || !a || !b) continue
        const P = pid === idC ? c : pid === idA ? a : b
        const P2 = { ...P, [axis]: P[axis] + eps }
        let C2 = c
        let A2 = a
        let B2 = b
        if (pid === idC) C2 = P2
        if (pid === idA) A2 = P2
        if (pid === idB) B2 = P2
        const r2 = angleRes(C2, A2, B2)
        sparse.push({ idx: flatIdx, val: (r2 - base) / eps })
      }
      addRow(base, sparse)
    }
  }

  return { r, rows }
}

function normR(r) {
  let s = 0
  for (const v of r) s += v * v
  return Math.sqrt(s)
}

function applyDelta(d, delta, pointIds) {
  const pts = d.points.map((p, i) => {
    const ix = 2 * i
    let nx = p.x + delta[ix]
    let ny = p.y + delta[ix + 1]
    if (!Number.isFinite(nx) || !Number.isFinite(ny)) return p
    const cx = Math.max(-STEP_CAP * 50, Math.min(STEP_CAP * 50, nx))
    const cy = Math.max(-STEP_CAP * 50, Math.min(STEP_CAP * 50, ny))
    return { ...p, x: cx, y: cy }
  })
  return { ...d, points: pts }
}

/**
 * @param {object} data workspace snapshot (mutated copy internally)
 * @param {{ maxIter?: number; tol?: number }} [opts]
 */
export function solveGCS(data, opts = {}) {
  if ((data.points?.length ?? 0) > 0) {
    const plane = solveWithPlaneGcs(data)
    if (plane) return plane
  }
  return solveLegacyGCS(data, opts)
}

/**
 * @param {object} data
 * @param {{ maxIter?: number; tol?: number }} [opts]
 */
function solveLegacyGCS(data, opts = {}) {
  const maxIter = opts.maxIter ?? DEFAULT_MAX_ITER
  const tol = opts.tol ?? DEFAULT_TOL
  let d = cloneWorkspaceData(data)
  const pointIds = d.points.map((p) => p.id)
  const nv = 2 * pointIds.length
  if (nv === 0) return d

  const idx = new Map()
  pointIds.forEach((id, i) => idx.set(id, 2 * i))

  const hasWork =
    (d.constraints?.length ?? 0) > 0 || (d.dimensions?.length ?? 0) > 0
  if (!hasWork) {
    d = recomputeBoundArcs(d)
    d.solverDiagnostics = {
      engine: 'legacy',
      fullyDefined: false,
      overConstrained: false,
      dof: null,
    }
    return d
  }

  let lambda = LAMBDA0

  for (let iter = 0; iter < maxIter; iter++) {
    const { r, rows } = buildSystem(d, idx, nv)
    if (r.length === 0) break

    const nr = normR(r)
    if (nr < tol) break

    const JtJ = Array.from({ length: nv }, () => new Array(nv).fill(0))
    const Jtr = new Array(nv).fill(0)

    for (let i = 0; i < r.length; i++) {
      const row = rows[i]
      const ri = r[i]
      for (const a of row) {
        Jtr[a.idx] -= a.val * ri
        for (const b of row) {
          JtJ[a.idx][b.idx] += a.val * b.val
        }
      }
    }

    for (let i = 0; i < nv; i++) JtJ[i][i] += lambda

    let delta
    try {
      delta = solveSymmetric(JtJ, Jtr)
    } catch {
      break
    }

    for (let i = 0; i < nv; i++) {
      if (!Number.isFinite(delta[i])) delta[i] = 0
      if (Math.abs(delta[i]) > STEP_CAP) {
        delta[i] = Math.sign(delta[i]) * STEP_CAP
      }
    }

    const trial = applyDelta(d, delta, pointIds)
    const nrTrial = normR(buildSystem(trial, idx, nv).r)

    if (nrTrial < nr) {
      d = trial
      d = recomputeBoundArcs(d)
      lambda = Math.max(1e-12, lambda * 0.65)
    } else {
      lambda = Math.min(1e8, lambda * 2.2)
      if (lambda > 1e7 && nr < tol * 200) break
    }
  }

  d = relaxAllConstraints(d, 18)
  d = recomputeBoundArcs(d)
  d.solverDiagnostics = {
    engine: 'legacy',
    fullyDefined: false,
    overConstrained: false,
    dof: null,
  }
  return d
}
