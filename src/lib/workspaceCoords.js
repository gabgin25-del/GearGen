/** @param {HTMLCanvasElement} canvas */
export function canvasLocalFromClient(canvas, clientX, clientY) {
  const r = canvas.getBoundingClientRect()
  return { x: clientX - r.left, y: clientY - r.top }
}

/** World position from canvas-local CSS pixels (view: pan + zoom). */
export function worldFromCanvasLocal(local, pan, zoom = 1) {
  const z = zoom || 1
  return { x: (local.x - pan.x) / z, y: (local.y - pan.y) / z }
}

/** Canvas-local CSS pixels from world (for drawing without active transform). */
export function canvasLocalFromWorld(world, pan, zoom = 1) {
  const z = zoom || 1
  return { x: world.x * z + pan.x, y: world.y * z + pan.y }
}

export function distSq(ax, ay, bx, by) {
  const dx = ax - bx
  const dy = ay - by
  return dx * dx + dy * dy
}
