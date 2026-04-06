/**
 * Remove sketch entities from a selection (marquee / shift-click), with cascade
 * for points and constraint cleanup.
 */

/**
 * @param {object} data
 * @param {{ kind: string; id: string }[]} selection
 */
export function deleteSketchEntities(data, selection) {
  if (!selection?.length) return data

  const killPt = new Set(
    selection.filter((s) => s.kind === 'point').map((s) => s.id),
  )
  const killSeg = new Set(
    selection.filter((s) => s.kind === 'segment').map((s) => s.id),
  )
  const killCirc = new Set(
    selection.filter((s) => s.kind === 'circle').map((s) => s.id),
  )
  const killPoly = new Set(
    selection.filter((s) => s.kind === 'polygon').map((s) => s.id),
  )
  const killArc = new Set(
    selection.filter((s) => s.kind === 'arc').map((s) => s.id),
  )
  const killAng = new Set(
    selection.filter((s) => s.kind === 'angle').map((s) => s.id),
  )
  const killSpl = new Set(
    selection.filter((s) => s.kind === 'spline').map((s) => s.id),
  )
  const killStroke = new Set(
    selection.filter((s) => s.kind === 'stroke').map((s) => s.id),
  )

  for (const s of data.segments ?? []) {
    if (killPt.has(s.a) || killPt.has(s.b)) killSeg.add(s.id)
  }

  for (const a of data.arcs ?? []) {
    if (
      killPt.has(a.centerId) ||
      (a.startId && killPt.has(a.startId)) ||
      (a.endId && killPt.has(a.endId))
    ) {
      killArc.add(a.id)
    }
  }

  for (const an of data.angles ?? []) {
    if (
      killPt.has(an.centerId) ||
      killPt.has(an.arm1Id) ||
      killPt.has(an.arm2Id)
    ) {
      killAng.add(an.id)
    }
  }

  for (const sp of data.splines ?? []) {
    for (const vid of sp.vertexIds ?? []) {
      if (killPt.has(vid)) {
        killSpl.add(sp.id)
        break
      }
    }
  }

  for (const c of data.circles ?? []) {
    if (c.centerId && killPt.has(c.centerId)) killCirc.add(c.id)
  }

  for (const poly of data.polygons ?? []) {
    for (const vid of poly.vertexIds ?? []) {
      if (killPt.has(vid)) {
        killPoly.add(poly.id)
        break
      }
    }
  }

  const segments = (data.segments ?? []).filter((s) => !killSeg.has(s.id))
  const arcs = (data.arcs ?? []).filter((a) => !killArc.has(a.id))
  const angles = (data.angles ?? []).filter((a) => !killAng.has(a.id))
  const splines = (data.splines ?? []).filter((s) => !killSpl.has(s.id))
  const circles = (data.circles ?? []).filter((c) => !killCirc.has(c.id))

  let polygons = (data.polygons ?? [])
    .filter((p) => !killPoly.has(p.id))
    .map((p) => {
      const verts = (p.vertexIds ?? []).filter((id) => !killPt.has(id))
      if (verts.length === p.vertexIds?.length) return p
      return { ...p, vertexIds: verts }
    })
    .filter((p) => (p.vertexIds?.length ?? 0) >= 2)

  const points = (data.points ?? []).filter((p) => !killPt.has(p.id))

  const strokes = (data.strokes ?? []).filter((s) => !killStroke.has(s.id))

  const alive = new Set()
  for (const p of points) alive.add(`point:${p.id}`)
  for (const s of segments) alive.add(`segment:${s.id}`)
  for (const c of circles) alive.add(`circle:${c.id}`)
  for (const p of polygons) alive.add(`polygon:${p.id}`)
  for (const a of arcs) alive.add(`arc:${a.id}`)
  for (const an of angles) alive.add(`angle:${an.id}`)
  for (const sp of splines) alive.add(`spline:${sp.id}`)

  const constraints = (data.constraints ?? []).filter((c) => {
    const t = c.targets ?? []
    return t.every((tg) => alive.has(`${tg.kind}:${tg.id}`))
  })

  const dimensions = (data.dimensions ?? []).filter((dim) => {
    const t = dim.targets ?? []
    if (dim.type === 'distance' && t.length === 2) {
      if (typeof t[0] === 'string' && typeof t[1] === 'string') {
        return (
          points.some((p) => p.id === t[0]) &&
          points.some((p) => p.id === t[1])
        )
      }
      if (t[0]?.kind === 'segment' && t[1]?.kind === 'segment') {
        return (
          segments.some((s) => s.id === t[0].id) &&
          segments.some((s) => s.id === t[1].id)
        )
      }
      if (
        (t[0]?.kind === 'point' && t[1]?.kind === 'segment') ||
        (t[0]?.kind === 'segment' && t[1]?.kind === 'point')
      ) {
        const pid =
          t[0].kind === 'point' ? t[0].id : t[1].id
        const sid =
          t[0].kind === 'segment' ? t[0].id : t[1].id
        return (
          points.some((p) => p.id === pid) &&
          segments.some((s) => s.id === sid)
        )
      }
    }
    if (dim.type === 'distance' && typeof t[0] === 'string') {
      return segments.some((s) => s.id === t[0])
    }
    if (
      (dim.type === 'radius' || dim.type === 'diameter') &&
      t[0]
    ) {
      return circles.some((c) => c.id === t[0])
    }
    if (dim.type === 'angle' && t.length >= 3) {
      return t.every((pid) => points.some((p) => p.id === pid))
    }
    if (
      dim.type === 'angle' &&
      t.length === 2 &&
      t[0]?.kind === 'segment' &&
      t[1]?.kind === 'segment'
    ) {
      return (
        segments.some((s) => s.id === t[0].id) &&
        segments.some((s) => s.id === t[1].id)
      )
    }
    return false
  })

  return {
    ...data,
    points,
    segments,
    circles,
    polygons,
    arcs,
    angles,
    splines,
    strokes,
    constraints,
    dimensions,
    pendingCuts: data.pendingCuts ?? [],
  }
}
