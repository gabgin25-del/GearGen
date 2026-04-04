/**
 * @param {{ x: number; y: number }[]} pts
 * @param {number} tension 0 = sharp corners, 0.5 typical, 1 = very loose
 * @param {boolean} closed
 * @param {number} segmentsPerSpan samples between each pair of knots
 */
export function sampleCatmullRom(pts, tension = 0.5, closed = false, segmentsPerSpan = 16) {
  if (pts.length < 2) return [...pts]
  const out = []
  const n = pts.length
  const get = (i) => {
    if (closed) return pts[((i % n) + n) % n]
    return pts[Math.max(0, Math.min(n - 1, i))]
  }
  const spanEnd = closed ? n : n - 1
  for (let i = 0; i < spanEnd; i++) {
    const p0 = get(i - 1)
    const p1 = get(i)
    const p2 = get(i + 1)
    const p3 = get(i + 2)
    for (let s = 0; s < segmentsPerSpan; s++) {
      const t = s / segmentsPerSpan
      const t2 = t * t
      const t3 = t2 * t
      const s0 = -tension * t3 + 2 * tension * t2 - tension * t
      const s1 = (2 - tension) * t3 + (tension - 3) * t2 + 1
      const s2 = (tension - 2) * t3 + (3 - 2 * tension) * t2 + tension * t
      const s3 = tension * t3 - tension * t2
      out.push({
        x: s0 * p0.x + s1 * p1.x + s2 * p2.x + s3 * p3.x,
        y: s0 * p0.y + s1 * p1.y + s2 * p2.y + s3 * p3.y,
      })
    }
  }
  if (!closed) out.push({ x: pts[n - 1].x, y: pts[n - 1].y })
  else out.push({ x: pts[0].x, y: pts[0].y })
  return out
}

/** Uniform cubic B-spline control polygon → curve (approximating). */
export function sampleUniformCubicBSpline(pts, closed = false, segmentsPerSpan = 12) {
  if (pts.length < 4 && !closed) {
    if (pts.length < 2) return [...pts]
    return sampleCatmullRom(pts, 0.5, false, segmentsPerSpan)
  }
  const out = []
  const n = pts.length
  const knot = (i) => {
    if (closed) return pts[((i % n) + n) % n]
    if (i < 0) return pts[0]
    if (i >= n) return pts[n - 1]
    return pts[i]
  }
  function basis(t) {
    const b0 = (1 - t) ** 3 / 6
    const b1 = (3 * t * t * t - 6 * t * t + 4) / 6
    const b2 = (-3 * t * t * t + 3 * t * t + 3 * t + 1) / 6
    const b3 = t * t * t / 6
    return [b0, b1, b2, b3]
  }
  const range = closed ? n : n - 3
  for (let i = 0; i < range; i++) {
    const p0 = knot(i)
    const p1 = knot(i + 1)
    const p2 = knot(i + 2)
    const p3 = knot(i + 3)
    for (let s = 0; s < segmentsPerSpan; s++) {
      const t = s / segmentsPerSpan
      const [b0, b1, b2, b3] = basis(t)
      out.push({
        x: b0 * p0.x + b1 * p1.x + b2 * p2.x + b3 * p3.x,
        y: b0 * p0.y + b1 * p1.y + b2 * p2.y + b3 * p3.y,
      })
    }
  }
  if (!closed && n >= 4) {
    const t = 1
    const [b0, b1, b2, b3] = basis(t)
    const p0 = pts[n - 4]
    const p1 = pts[n - 3]
    const p2 = pts[n - 2]
    const p3 = pts[n - 1]
    out.push({
      x: b0 * p0.x + b1 * p1.x + b2 * p2.x + b3 * p3.x,
      y: b0 * p0.y + b1 * p1.y + b2 * p2.y + b3 * p3.y,
    })
  }
  return out
}

function solveTridiagonal(a, b, c, d) {
  const n = b.length
  const cp = new Array(n)
  const dp = new Array(n)
  cp[0] = c[0] / b[0]
  dp[0] = d[0] / b[0]
  for (let i = 1; i < n; i++) {
    const m = b[i] - a[i] * cp[i - 1]
    cp[i] = i < n - 1 ? c[i] / m : 0
    dp[i] = (d[i] - a[i] * dp[i - 1]) / m
  }
  const x = new Array(n)
  x[n - 1] = dp[n - 1]
  for (let i = n - 2; i >= 0; i--) {
    x[i] = dp[i] - cp[i] * x[i + 1]
  }
  return x
}

/** Natural cubic spline of x(u), y(u) vs cumulative chord length u (open, natural ends). */
export function sampleNaturalCubicSpline(pts, segmentsPerSpan = 14) {
  const n = pts.length
  if (n < 2) return [...pts]
  if (n === 2) {
    const out = []
    for (let s = 0; s <= segmentsPerSpan; s++) {
      const t = s / segmentsPerSpan
      out.push({
        x: pts[0].x + t * (pts[1].x - pts[0].x),
        y: pts[0].y + t * (pts[1].y - pts[0].y),
      })
    }
    return out
  }
  const u = [0]
  for (let i = 1; i < n; i++) {
    u.push(u[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y))
  }
  const h = []
  for (let i = 0; i < n - 1; i++) {
    h.push(u[i + 1] - u[i] || 1e-6)
  }
  const a = new Array(n).fill(0)
  const b = new Array(n).fill(0)
  const c = new Array(n).fill(0)
  const rhsx = new Array(n).fill(0)
  const rhsy = new Array(n).fill(0)
  b[0] = 1
  b[n - 1] = 1
  for (let i = 1; i < n - 1; i++) {
    a[i] = h[i - 1]
    b[i] = 2 * (h[i - 1] + h[i])
    c[i] = h[i]
    rhsx[i] =
      6 *
      ((pts[i + 1].x - pts[i].x) / h[i] -
        (pts[i].x - pts[i - 1].x) / h[i - 1])
    rhsy[i] =
      6 *
      ((pts[i + 1].y - pts[i].y) / h[i] -
        (pts[i].y - pts[i - 1].y) / h[i - 1])
  }
  const Mx = solveTridiagonal(a, b, c, rhsx)
  const My = solveTridiagonal(a, b, c, rhsy)
  const out = []
  for (let i = 0; i < n - 1; i++) {
    const hi = h[i]
    for (let s = 0; s < segmentsPerSpan; s++) {
      const t = (s / segmentsPerSpan) * hi
      const t2 = t * t
      const t3 = t2 * t
      const Ax = (Mx[i + 1] - Mx[i]) / (6 * hi)
      const Bx = Mx[i] / 2
      const Cx =
        (pts[i + 1].x - pts[i].x) / hi - (hi * (2 * Mx[i] + Mx[i + 1])) / 6
      const Dx = pts[i].x
      const Ay = (My[i + 1] - My[i]) / (6 * hi)
      const By = My[i] / 2
      const Cy =
        (pts[i + 1].y - pts[i].y) / hi - (hi * (2 * My[i] + My[i + 1])) / 6
      const Dy = pts[i].y
      out.push({
        x: Ax * t3 + Bx * t2 + Cx * t + Dx,
        y: Ay * t3 + By * t2 + Cy * t + Dy,
      })
    }
  }
  out.push({ x: pts[n - 1].x, y: pts[n - 1].y })
  return out
}

/**
 * Quadratic chain: A₀,H₀,A₁,H₁,A₂,… — curve passes through each A; Hᵢ pulls the span (off-curve).
 * Open: odd count ≥ 3. Closed: even count ≥ 4, last H connects last A back to first A.
 */
export function sampleQuadraticAnchorHandle(
  pts,
  closed = false,
  segmentsPerSpan = 16,
) {
  const n = pts.length
  if (n < 3) return [...pts]
  const pushQuad = (out, A0, H, A1, skipFirst) => {
    for (let s = skipFirst ? 1 : 0; s < segmentsPerSpan; s++) {
      const t = s / segmentsPerSpan
      const u = 1 - t
      out.push({
        x: u * u * A0.x + 2 * u * t * H.x + t * t * A1.x,
        y: u * u * A0.y + 2 * u * t * H.y + t * t * A1.y,
      })
    }
  }
  if (!closed) {
    if (n % 2 === 0) {
      return sampleCatmullRom(pts.slice(0, n - 1), 0.5, false, segmentsPerSpan)
    }
    const out = []
    for (let i = 0; i + 2 < n; i += 2) {
      pushQuad(out, pts[i], pts[i + 1], pts[i + 2], out.length > 0)
    }
    out.push({ x: pts[n - 1].x, y: pts[n - 1].y })
    return out
  }
  if (n < 4 || n % 2 !== 0) {
    return sampleCatmullRom(pts, 0.5, true, segmentsPerSpan)
  }
  const out = []
  for (let i = 0; i < n; i += 2) {
    const i1 = (i + 1) % n
    const i2 = (i + 2) % n
    const A0 = pts[i]
    const H = pts[i1]
    const A1 = pts[i2]
    pushQuad(out, A0, H, A1, out.length > 0)
  }
  if (out.length) out.push({ x: out[0].x, y: out[0].y })
  return out
}

/**
 * Cubic chain: A₀,H₀a,H₀b,A₁,H₁a,H₁b,A₂,… — Bézier spans; interior anchors lie on the curve.
 * Open: n = 4 + 3k. Closed: n = 3k, k ≥ 2, wraps.
 */
export function sampleCubicAnchorHandle(
  pts,
  closed = false,
  segmentsPerSpan = 14,
) {
  const n = pts.length
  if (n < 4) return [...pts]
  const pushCub = (out, P0, P1, P2, P3, skipFirst) => {
    for (let s = skipFirst ? 1 : 0; s < segmentsPerSpan; s++) {
      const t = s / segmentsPerSpan
      const u = 1 - t
      const u2 = u * u
      const u3 = u2 * u
      const t2 = t * t
      const t3 = t2 * t
      out.push({
        x: u3 * P0.x + 3 * u2 * t * P1.x + 3 * u * t2 * P2.x + t3 * P3.x,
        y: u3 * P0.y + 3 * u2 * t * P1.y + 3 * u * t2 * P2.y + t3 * P3.y,
      })
    }
  }
  if (!closed) {
    if ((n - 4) % 3 !== 0) {
      return sampleCatmullRom(pts, 0.5, false, segmentsPerSpan)
    }
    const out = []
    let i = 0
    while (i + 3 < n) {
      pushCub(
        out,
        pts[i],
        pts[i + 1],
        pts[i + 2],
        pts[i + 3],
        out.length > 0,
      )
      i += 3
    }
    out.push({ x: pts[n - 1].x, y: pts[n - 1].y })
    return out
  }
  if (n < 6 || n % 3 !== 0) {
    return sampleCatmullRom(pts, 0.5, true, segmentsPerSpan)
  }
  const out = []
  const spans = n / 3
  for (let k = 0; k < spans; k++) {
    const i0 = (k * 3) % n
    const P0 = pts[i0]
    const P1 = pts[(i0 + 1) % n]
    const P2 = pts[(i0 + 2) % n]
    const P3 = pts[(i0 + 3) % n]
    pushCub(out, P0, P1, P2, P3, out.length > 0)
  }
  if (out.length) out.push({ x: out[0].x, y: out[0].y })
  return out
}

/**
 * Dashed “frame” so off-curve / control points read clearly (consecutive knot edges).
 * @returns {Array<{ ax: number; ay: number; bx: number; by: number }>}
 */
export function splineControlSegments(pts, splineType) {
  if (pts.length < 2) return []
  const segs = []
  for (let i = 0; i < pts.length - 1; i++) {
    segs.push({
      ax: pts[i].x,
      ay: pts[i].y,
      bx: pts[i + 1].x,
      by: pts[i + 1].y,
    })
  }
  const frameTypes = new Set([
    'quadraticAnchors',
    'cubicAnchors',
    'uniformBSpline',
    'naturalCubic',
    'catmullRom',
    'chordalCatmullRom',
  ])
  return frameTypes.has(splineType) ? segs : []
}

/**
 * @param {{ x: number; y: number }[]} controlPoints
 * @param {string} splineType
 * @param {{ tension?: number; closed?: boolean; segmentsPerSpan?: number }} opts
 */
export function sampleSplinePolyline(controlPoints, splineType, opts = {}) {
  const {
    tension = 0.5,
    closed = false,
    segmentsPerSpan = 14,
  } = opts
  if (controlPoints.length < 2) return [...controlPoints]
  switch (splineType) {
    case 'polyline':
      return closed && controlPoints.length > 2
        ? [...controlPoints, controlPoints[0]]
        : [...controlPoints]
    case 'catmullRom':
      return sampleCatmullRom(controlPoints, tension, closed, segmentsPerSpan)
    case 'naturalCubic':
      if (closed) return sampleCatmullRom(controlPoints, 0.5, true, segmentsPerSpan)
      return sampleNaturalCubicSpline(controlPoints, segmentsPerSpan)
    case 'uniformBSpline':
      return sampleUniformCubicBSpline(controlPoints, closed, segmentsPerSpan)
    case 'chordalCatmullRom':
      return sampleCatmullRom(controlPoints, tension, closed, segmentsPerSpan)
    case 'quadraticAnchors':
      return sampleQuadraticAnchorHandle(
        controlPoints,
        closed,
        segmentsPerSpan,
      )
    case 'cubicAnchors':
      return sampleCubicAnchorHandle(controlPoints, closed, segmentsPerSpan)
    default:
      return sampleCatmullRom(controlPoints, tension, closed, segmentsPerSpan)
  }
}

export function polylineLength(samples) {
  let L = 0
  for (let i = 1; i < samples.length; i++) {
    L += Math.hypot(
      samples[i].x - samples[i - 1].x,
      samples[i].y - samples[i - 1].y,
    )
  }
  return L
}

/**
 * On-curve anchor vs off-curve control (for drawing knots).
 * @returns {'anchor' | 'control'}
 */
export function splineVertexRole(splineType, n, index, closed) {
  switch (splineType) {
    case 'uniformBSpline':
      return 'control'
    case 'quadraticAnchors':
      if (closed) {
        if (n < 4 || n % 2 !== 0) return 'anchor'
        return index % 2 === 0 ? 'anchor' : 'control'
      }
      if (n % 2 === 0) return 'anchor'
      return index % 2 === 0 ? 'anchor' : 'control'
    case 'cubicAnchors':
      if (closed) {
        if (n < 6 || n % 3 !== 0) return 'anchor'
        return index % 3 === 0 ? 'anchor' : 'control'
      }
      if ((n - 4) % 3 !== 0) return 'anchor'
      if (index === n - 1) return 'anchor'
      return index % 3 === 0 ? 'anchor' : 'control'
    default:
      return 'anchor'
  }
}
