import { boundarySegmentIdsForPolygon } from './polygonBoundary.js'

/**
 * @param {string} type relation id
 * @param {{ kind: string; id: string }[]} selection
 * @param {{ segments: { id: string; a: string; b: string }[]; polygons: { id: string; vertexIds: string[]; boundarySegmentIds?: string[] }[] }} data
 * @returns {{ kind: string; id: string }[] | null}
 */
export function relationTargetsFromSelection(type, selection, data) {
  if (!selection?.length) return null
  const segments = data?.segments ?? []
  const polygons = data?.polygons ?? []

  const segs = selection.filter((s) => s.kind === 'segment')
  const pts = selection.filter((s) => s.kind === 'point')
  const circs = selection.filter((s) => s.kind === 'circle')
  const polys = selection.filter((s) => s.kind === 'polygon')

  function firstBoundarySegId(polyId) {
    const poly = polygons.find((p) => p.id === polyId)
    if (!poly) return null
    const b = boundarySegmentIdsForPolygon(poly, segments)
    return b?.[0] ?? null
  }

  function resolveTwoSegmentIds() {
    if (segs.length >= 2) return [segs[0].id, segs[1].id]
    if (segs.length === 1 && polys.length === 1) {
      const e = firstBoundarySegId(polys[0].id)
      if (e) return [segs[0].id, e]
    }
    if (polys.length === 2) {
      const e0 = firstBoundarySegId(polys[0].id)
      const e1 = firstBoundarySegId(polys[1].id)
      if (e0 && e1) return [e0, e1]
    }
    if (polys.length === 1 && segs.length === 0) {
      const b = boundarySegmentIdsForPolygon(
        polygons.find((p) => p.id === polys[0].id),
        segments,
      )
      if (b && b.length >= 2) return [b[0], b[1]]
    }
    return null
  }

  switch (type) {
    case 'fixOrigin':
      if (pts.length < 1) return null
      return [{ kind: 'point', id: pts[0].id }]
    case 'equal':
    case 'parallel':
    case 'perpendicular':
    case 'symmetric':
    case 'similar': {
      const pair = resolveTwoSegmentIds()
      if (!pair) return null
      return [
        { kind: 'segment', id: pair[0] },
        { kind: 'segment', id: pair[1] },
      ]
    }
    case 'tangent': {
      if (segs.length >= 1 && circs.length >= 1) {
        return [
          { kind: 'segment', id: segs[0].id },
          { kind: 'circle', id: circs[0].id },
        ]
      }
      const pair = resolveTwoSegmentIds()
      if (!pair) return null
      return [
        { kind: 'segment', id: pair[0] },
        { kind: 'segment', id: pair[1] },
      ]
    }
    case 'horizontal':
    case 'vertical': {
      if (segs.length >= 1)
        return [{ kind: 'segment', id: segs[0].id }]
      if (polys.length >= 1) {
        const e = firstBoundarySegId(polys[0].id)
        if (e) return [{ kind: 'segment', id: e }]
      }
      return null
    }
    case 'concentric':
      if (circs.length < 2) return null
      return [
        { kind: 'circle', id: circs[0].id },
        { kind: 'circle', id: circs[1].id },
      ]
    case 'coincident':
      if (pts.length < 2) return null
      return [
        { kind: 'point', id: pts[0].id },
        { kind: 'point', id: pts[1].id },
      ]
    default:
      return null
  }
}
