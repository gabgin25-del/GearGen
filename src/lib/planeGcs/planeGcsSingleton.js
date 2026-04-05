/**
 * Single shared PlaneGCS (FreeCAD WASM) instance for the app.
 * Must be initialized before solveGCS runs (see main.jsx).
 */

let wrapperPromise = null
let wrapper = null
let initError = null

/**
 * @returns {Promise<import('@salusoft89/planegcs').GcsWrapper | null>}
 */
export async function initPlaneGcs() {
  if (initError) return null
  if (wrapper) return wrapper
  if (!wrapperPromise) {
    wrapperPromise = (async () => {
      try {
        const [{ make_gcs_wrapper }, wasmMod] = await Promise.all([
          import('@salusoft89/planegcs'),
          import('@salusoft89/planegcs/dist/planegcs_dist/planegcs.wasm?url'),
        ])
        const wasm_url = wasmMod.default
        const w = await make_gcs_wrapper(wasm_url)
        wrapper = w
        return w
      } catch (e) {
        initError = e
        console.warn('[PlaneGCS] init failed, using legacy solver:', e)
        return null
      }
    })()
  }
  return wrapperPromise
}

/** @returns {import('@salusoft89/planegcs').GcsWrapper | null} */
export function getPlaneGcsWrapper() {
  return wrapper
}

export function planeGcsInitFailed() {
  return initError != null && wrapper == null
}
