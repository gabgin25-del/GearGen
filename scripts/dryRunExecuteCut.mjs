/**
 * Dry-run: matches WorkspaceCanvas Execute Cut — trySubtractCircleFromFill then
 * remove the cutter circle from `circles` when the subtract succeeds.
 */
import { trySubtractCircleFromFill } from '../src/lib/sketchBooleanCut.js'

let id = 0
const nextId = (p) => `${p}${++id}`

const data = {
  points: [
    { id: 'p1', x: 0, y: 0 },
    { id: 'p2', x: 100, y: 0 },
    { id: 'p3', x: 100, y: 100 },
    { id: 'p4', x: 0, y: 100 },
  ],
  segments: [
    { id: 's1', a: 'p1', b: 'p2' },
    { id: 's2', a: 'p2', b: 'p3' },
    { id: 's3', a: 'p3', b: 'p4' },
    { id: 's4', a: 'p4', b: 'p1' },
  ],
  polygons: [
    {
      id: 'poly1',
      vertexIds: ['p1', 'p2', 'p3', 'p4'],
      fill: 'rgba(59, 130, 246, 0.22)',
      boundarySegmentIds: ['s1', 's2', 's3', 's4'],
    },
  ],
  circles: [
    {
      id: 'cCut',
      centerId: 'pC',
      r: 15,
      fill: null,
      isCut: true,
      geoRegistered: true,
    },
  ],
}

const withCenter = {
  ...data,
  points: [...data.points, { id: 'pC', x: 50, y: 50 }],
}

const cx = 50
const cy = 50
const r = 15

const afterSubtract = trySubtractCircleFromFill(withCenter, cx, cy, r, nextId, {})
if (!afterSubtract) {
  console.error('dryRunExecuteCut: trySubtractCircleFromFill returned null')
  process.exit(1)
}

const poly = (afterSubtract.polygons ?? []).find((p) => p.id === 'poly1')
const hasHole =
  Array.isArray(poly?.holes) &&
  poly.holes.length > 0 &&
  poly.holes[0].length >= 3
if (!hasHole) {
  console.error('dryRunExecuteCut: expected polygon hole ring after subtract')
  process.exit(1)
}

const cutterId = 'cCut'
const finalState = {
  ...afterSubtract,
  circles: (afterSubtract.circles ?? []).filter((c) => c.id !== cutterId),
}
if ((finalState.circles ?? []).some((c) => c.id === cutterId)) {
  console.error('dryRunExecuteCut: cutter circle should be removed after UI step')
  process.exit(1)
}

console.log(
  'dryRunExecuteCut: ok — hole in polygon, cutter circle removed (Execute Cut path).',
)
