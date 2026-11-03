import { BrowserWindow, dialog, ipcMain } from 'electron'
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, statSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import { extname, join } from 'node:path'
import { dataDir, getConfig, setConfig } from './configStore'
import { allWindows } from './windows'
import { log } from './log'

/**
 * Your own pictures (cheat sheets, maps, notes) for the overlay's image strip, like the
 * "Image strip" widget in Awakened PoE Trade. Chosen files are copied into the data folder,
 * so the originals can move or be deleted.
 */
const TYPES: Record<string, string> = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif' }
const MAX_BYTES = 25 * 1024 * 1024
const dir = () => join(dataDir(), 'images')

function broadcast(): void {
  const c = getConfig()
  for (const w of allWindows()) w.webContents.send('config:changed', c)
}

export function initImages(): void {
  ipcMain.handle('images:add', async (e) => {
    let paths: string[]
    if (process.env.CRIPS_IMAGE_PICK) paths = process.env.CRIPS_IMAGE_PICK.split('|') // tests
    else {
      const parent = BrowserWindow.fromWebContents(e.sender)
      const opts = { title: 'Add images', properties: ['openFile', 'multiSelections'] as ('openFile' | 'multiSelections')[], filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif'] }] }
      const r = parent ? await dialog.showOpenDialog(parent, opts) : await dialog.showOpenDialog(opts)
      if (r.canceled) return { added: 0, skipped: [] }
      paths = r.filePaths
    }
    mkdirSync(dir(), { recursive: true })
    const added: { id: string; file: string; name: string }[] = []
    const skipped: string[] = []
    for (const p of paths) {
      const ext = extname(p).toLowerCase()
      if (!TYPES[ext] || !existsSync(p) || statSync(p).size > MAX_BYTES) { skipped.push(p); continue }
      const id = randomUUID()
      const file = `${id}${ext}`
      copyFileSync(p, join(dir(), file))
      added.push({ id, file, name: p.split(/[\\/]/).pop()!.replace(/\.[^.]+$/, '') })
    }
    if (added.length) { setConfig({ images: [...getConfig().images, ...added] }); broadcast() }
    if (skipped.length) log('warn', `images not added (not an image or larger than 25 MB): ${skipped.length}`)
    return { added: added.length, skipped }
  })

  ipcMain.handle('images:get', (_e, id: string) => {
    const img = getConfig().images.find(i => i.id === id)
    if (!img) return null
    const p = join(dir(), img.file)
    if (!existsSync(p)) return null
    return `data:${TYPES[extname(img.file)]};base64,${readFileSync(p).toString('base64')}`
  })

  ipcMain.handle('images:remove', (_e, id: string) => {
    const img = getConfig().images.find(i => i.id === id)
    if (!img) return
    rmSync(join(dir(), img.file), { force: true })
    setConfig({ images: getConfig().images.filter(i => i.id !== id) })
    broadcast()
  })
}
