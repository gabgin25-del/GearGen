/**
 * @param {{ vertexIds: string[]; boundarySegmentIds?: string[] } | undefined} poly
 * @param {{ id: string; a: string; b: string }[]} segments
 * @returns {string[] | null}
 */
export function boundarySegmentIdsForPolygon(poly, segments) {
  if (!poly?.vertexIds?.length) return null
  if (poly.boundarySegmentIds?.length === poly.vertexIds.length) {
    return poly.boundarySegmentIds
  }
  const verts = poly.vertexIds
  const ids = []
  for (let i = 0; i < verts.length; i++) {
    const a = verts[i]
    const b = verts[(i + 1) % verts.length]
    const seg = segments.find(
      (s) =>
        (s.a === a && s.b === b) || (s.a === b && s.b === a),
    )
    if (!seg) return null
    ids.push(seg.id)
  }
  return ids
}
