import { useEffect, useState } from 'react'
import { ToastProvider } from './context/ToastContext.jsx'
import { SketchesProvider } from './context/SketchesContext.jsx'
import { DesmosBridgeProvider } from './context/DesmosBridgeProvider.jsx'
import { AppShell } from './components/layout/AppShell.jsx'
import { HelpPage } from './pages/HelpPage.jsx'

function readHelpHash() {
  const h = window.location.hash.replace(/^#/, '')
  return h === 'help' || h === '/help'
}

function App() {
  const [showHelp, setShowHelp] = useState(readHelpHash)

  useEffect(() => {
    const onHash = () => setShowHelp(readHelpHash())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  if (showHelp) {
    return <HelpPage />
  }

  return (
    <ToastProvider>
      <SketchesProvider>
        <DesmosBridgeProvider>
          <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
            <AppShell />
          </div>
        </DesmosBridgeProvider>
      </SketchesProvider>
    </ToastProvider>
  )
}

export default App
