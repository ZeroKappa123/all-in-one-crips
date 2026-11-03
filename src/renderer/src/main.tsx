import { StrictMode, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { PriceCheck } from './screens/PriceCheck'
import { Settings } from './screens/Settings'
import { Overlay } from './screens/Overlay'
import { Guide } from './screens/Guide'
import { Tree } from './screens/Tree'
import { Gear } from './screens/Gear'
import { Editor } from './screens/Editor'
import { Trades } from './screens/Trades'
import { Stash } from './screens/Stash'

function Router() {
  const [route, setRoute] = useState(location.hash.slice(1) || 'panel')
  useEffect(() => {
    const on = () => setRoute(location.hash.slice(1) || 'panel')
    addEventListener('hashchange', on)
    return () => removeEventListener('hashchange', on)
  }, [])
  // Appearance: dark by default, light or "like the system" from Settings. Applies to every window, overlays included.
  useEffect(() => {
    const apply = (theme: 'dark' | 'light' | 'system') => {
      if (theme === 'system') delete document.documentElement.dataset.theme
      else document.documentElement.dataset.theme = theme
    }
    void window.crips.getConfig().then(r => apply(r.config.theme))
    return window.crips.onConfig(c => apply(c.theme))
  }, [])
  useEffect(() => { document.body.classList.toggle('solid', route === 'settings' || route === 'gear' || route.startsWith('editor')) }, [route])
  if (route === 'settings') return <Settings />
  if (route === 'guide') return <Guide />
  if (route === 'tree') return <Tree />
  if (route === 'gear') return <Gear />
  if (route === 'trades') return <Trades />
  if (route === 'stash') return <Stash />
  if (route.startsWith('editor/')) return <Editor slotIndex={Number(route.slice(7)) || 0} />
  if (route === 'overlay') return <Overlay />
  return <PriceCheck />
}

createRoot(document.getElementById('root')!).render(<StrictMode><Router /></StrictMode>)
