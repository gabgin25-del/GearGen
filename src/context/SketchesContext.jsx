/* eslint-disable react-refresh/only-export-components -- hooks exported alongside provider */
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react'
import {
  loadStoredSketches,
  saveSketchList,
  uid,
} from '../lib/sketchStorage.js'

const SketchesContext = createContext(null)

/**
 * @param {object} e
 * @returns {object | null}
 */
function migrateStoredEntry(e) {
  if (!e || typeof e !== 'object') return null
  if (e.payload && typeof e.payload === 'object') {
    return {
      ...e,
      previewImage: e.previewImage ?? e.payload?.meta?.previewImage ?? null,
    }
  }
  if (e.data !== undefined) {
    return {
      id: e.id,
      name: e.name,
      createdAt: e.createdAt,
      payload: {
        format: 'gearge-v1',
        geometry: e.data,
        desmosState: null,
      },
    }
  }
  return e
}

export function SketchesProvider({ children }) {
  const [sketches, setSketches] = useState(() => {
    const raw = loadStoredSketches()
    return raw.map(migrateStoredEntry).filter(Boolean)
  })

  const persist = useCallback((next) => {
    setSketches(next)
    saveSketchList(next)
  }, [])

  const addSketch = useCallback((name, payload) => {
    const normalizedPayload =
      payload?.format != null && payload?.geometry != null
        ? {
            format: payload.format,
            geometry: payload.geometry,
            desmosState: payload.desmosState ?? null,
            meta: payload.meta,
          }
        : {
            format: 'gearge-v1',
            geometry: payload,
            desmosState: null,
          }

    const previewImage =
      payload && typeof payload === 'object' && 'previewImage' in payload
        ? payload.previewImage ?? null
        : null

    const entry = {
      id: uid(),
      name: (name && String(name).trim()) || 'Sketch',
      createdAt: new Date().toISOString(),
      payload: normalizedPayload,
      previewImage,
    }
    setSketches((prev) => {
      const next = [entry, ...prev]
      saveSketchList(next)
      return next
    })
    return entry
  }, [])

  const removeSketch = useCallback((id) => {
    setSketches((prev) => {
      const next = prev.filter((x) => x.id !== id)
      saveSketchList(next)
      return next
    })
  }, [])

  const value = useMemo(
    () => ({
      sketches,
      addSketch,
      removeSketch,
      setSketches: persist,
    }),
    [sketches, addSketch, removeSketch, persist],
  )

  return (
    <SketchesContext.Provider value={value}>{children}</SketchesContext.Provider>
  )
}

export function useSketches() {
  const ctx = useContext(SketchesContext)
  if (!ctx) {
    throw new Error('useSketches must be used within SketchesProvider')
  }
  return ctx
}
