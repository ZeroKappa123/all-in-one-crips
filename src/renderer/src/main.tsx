import { StrictMode, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { PricePanel } from './screens/PricePanel'
import { Settings } from './screens/Settings'
import { Overlay } from './screens/Overlay'

function Router() {
  const [route, setRoute] = useState(location.hash.slice(1) || 'panel')
  useEffect(() => {
    const on = () => setRoute(location.hash.slice(1) || 'panel')
    addEventListener('hashchange', on)
    return () => removeEventListener('hashchange', on)
  }, [])
  useEffect(() => { document.body.classList.toggle('solid', route === 'settings') }, [route])
  if (route === 'settings') return <Settings />
  if (route === 'overlay') return <Overlay />
  return <PricePanel />
}

createRoot(document.getElementById('root')!).render(<StrictMode><Router /></StrictMode>)
