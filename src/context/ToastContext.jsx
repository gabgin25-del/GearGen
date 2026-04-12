/* eslint-disable react-refresh/only-export-components -- hooks exported alongside provider */
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from 'react'

/** @type {import('react').Context<{ show: (msg: string) => void } | null>} */
const ToastContext = createContext(null)

export function ToastProvider({ children }) {
  const [message, setMessage] = useState(null)
  const tidRef = useRef(0)

  const show = useCallback((msg) => {
    setMessage(msg)
    window.clearTimeout(tidRef.current)
    tidRef.current = window.setTimeout(() => setMessage(null), 4200)
  }, [])

  const value = useMemo(() => ({ show }), [show])

  return (
    <ToastContext.Provider value={value}>
      {children}
      {message ? (
        <div
          className="pointer-events-none fixed bottom-6 left-1/2 z-[200] max-w-[min(92vw,24rem)] -translate-x-1/2 rounded-lg border border-gg-border bg-gg-sidebar px-4 py-2.5 text-center text-[13px] leading-snug text-gg-text shadow-lg"
          role="status"
        >
          {message}
        </div>
      ) : null}
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) {
    return { show: () => {} }
  }
  return ctx
}
