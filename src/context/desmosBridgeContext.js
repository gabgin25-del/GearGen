import { createContext } from 'react'

/** @type {import('react').Context<{ registerCalculator: (c: object | null) => void; getCalculator: () => object | null } | null>} */
export const DesmosBridgeContext = createContext(null)
