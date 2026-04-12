/* eslint-disable react-refresh/only-export-components -- hooks exported alongside provider */
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react'

const STORAGE_KEY = 'geargen-theme'

const ThemeContext = createContext({
  theme: 'dark',
  setTheme: () => {},
  toggleTheme: () => {},
})

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(() => {
    try {
      const s = localStorage.getItem(STORAGE_KEY)
      if (s === 'light' || s === 'dark') return s
    } catch {
      /* ignore */
    }
    return 'dark'
  })

  const setTheme = useCallback((next) => {
    const t = next === 'light' ? 'light' : 'dark'
    setThemeState(t)
    try {
      document.documentElement.setAttribute('data-theme', t)
      localStorage.setItem(STORAGE_KEY, t)
    } catch {
      /* ignore */
    }
  }, [])

  const toggleTheme = useCallback(() => {
    setTheme(theme === 'dark' ? 'light' : 'dark')
  }, [theme, setTheme])

  const value = useMemo(
    () => ({ theme, setTheme, toggleTheme }),
    [theme, setTheme, toggleTheme],
  )

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  )
}

export function useTheme() {
  return useContext(ThemeContext)
}
