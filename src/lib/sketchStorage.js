const STORAGE_KEY = 'geargen-sketches-v1'

/**
 * @returns {{ id: string; name: string; createdAt: string; data: object }[]}
 */
export function loadStoredSketches() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

/**
 * @param {{ id: string; name: string; createdAt: string; data: object }[]} list
 */
export function saveSketchList(list) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list))
}

export function uid() {
  return `sk_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`
}
