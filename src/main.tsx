import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import '@fontsource/barlow/latin-400.css'
import '@fontsource/barlow/latin-ext-400.css'
import '@fontsource/barlow/latin-600.css'
import '@fontsource/barlow/latin-ext-600.css'
import '@fontsource/barlow/latin-700.css'
import '@fontsource/barlow/latin-ext-700.css'
import '@fontsource/barlow-condensed/latin-600.css'
import '@fontsource/barlow-condensed/latin-ext-600.css'
import '@fontsource/barlow-condensed/latin-700.css'
import '@fontsource/barlow-condensed/latin-ext-700.css'
import { App } from './App.tsx'
import './styles.css'

registerSW({ immediate: true })

const root = document.getElementById('root')
if (root) {
  createRoot(root).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}
