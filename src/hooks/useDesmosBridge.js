import { useContext } from 'react'
import { DesmosBridgeContext } from '../context/desmosBridgeContext.js'

export function useDesmosBridge() {
  const ctx = useContext(DesmosBridgeContext)
  if (!ctx) {
    return {
      registerCalculator: () => {},
      getCalculator: () => null,
    }
  }
  return ctx
}
