import { StrictMode, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { PricePanel } from './screens/PricePanel'
import { Settings } from './screens/Settings'
import { Overlay } from './screens/Overlay'
import { Guide } from './screens/Guide'
import { Tree } from './screens/Tree'
import { Gear } from './screens/Gear'
import { Editor } from './screens/Editor'

function Router() {
  const [route, setRoute] = useState(location.hash.slice(1) || 'panel')
  useEffect(() => {
    const on = () => setRoute(location.hash.slice(1) || 'panel')
    addEventListener('hashchange', on)
    return () => removeEventListener('hashchange', on)
  }, [])
  useEffect(() => { document.body.classList.toggle('solid', route === 'settings' || route === 'gear' || route.startsWith('editor')) }, [route])
  if (route === 'settings') return <Settings />
  if (route === 'guide') return <Guide />
  if (route === 'tree') return <Tree />
  if (route === 'gear') return <Gear />
  if (route.startsWith('editor/')) return <Editor slotIndex={Number(route.slice(7)) || 0} />
  if (route === 'overlay') return <Overlay />
  return <PricePanel />
}

createRoot(document.getElementById('root')!).render(<StrictMode><Router /></StrictMode>)
