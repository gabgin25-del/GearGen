import { useCallback, useRef } from 'react'
import { DesmosBridgeContext } from './desmosBridgeContext.js'

export function DesmosBridgeProvider({ children }) {
  const ref = useRef(/** @type {object | null} */ (null))

  const registerCalculator = useCallback((c) => {
    ref.current = c
  }, [])

  const getCalculator = useCallback(() => ref.current, [])

  return (
    <DesmosBridgeContext.Provider value={{ registerCalculator, getCalculator }}>
      {children}
    </DesmosBridgeContext.Provider>
  )
}
