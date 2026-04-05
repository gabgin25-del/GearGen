import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ThemeProvider } from './context/ThemeContext.jsx'
import { initPlaneGcs } from './lib/planeGcs/planeGcsSingleton.js'
import './index.css'
import App from './App.jsx'

const rootEl = document.getElementById('root')

initPlaneGcs().finally(() => {
  createRoot(rootEl).render(
    <StrictMode>
      <ThemeProvider>
        <App />
      </ThemeProvider>
    </StrictMode>,
  )
})
