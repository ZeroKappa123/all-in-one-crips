import { app } from 'electron'
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync, copyFileSync, cpSync } from 'node:fs'
import { join } from 'node:path'
import { type Config, ConfigSchema, loadConfig } from '@shared/config'
import { log } from './log'

const dir = () => process.env.CRIPS_DATA_DIR ?? join(app.getPath('userData'), 'crips-data')

/** Settings from the version that was still called "Assay" move over once. */
export function migrateOldData(): void {
  if (process.env.CRIPS_DATA_DIR || existsSync(dir())) return
  const old = join(app.getPath('appData'), 'assay', 'assay-data')
  if (!existsSync(old)) return
  try { cpSync(old, dir(), { recursive: true }); log('info', 'moved settings from the previous version') } catch (e) { log('warn', `could not move old settings: ${String(e)}`) }
}
const file = () => join(dir(), 'config.json')

let current: Config | null = null
let repairedOnLoad = false

export function getConfig(): Config {
  if (current) return current
  mkdirSync(dir(), { recursive: true })
  let raw: unknown = undefined
  if (existsSync(file())) {
    try {
      raw = JSON.parse(readFileSync(file(), 'utf8'))
    } catch (e) {
      log('warn', `config unreadable, backing up: ${String(e)}`)
      copyFileSync(file(), file() + '.broken')
    }
  }
  const { config, repaired } = loadConfig(raw)
  repairedOnLoad = raw !== undefined && repaired
  current = config
  if (raw === undefined || repaired) save(config)
  return config
}

export function wasRepaired(): boolean {
  return repairedOnLoad
}

export function setConfig(patch: Partial<Config>): Config {
  const next = ConfigSchema.parse({ ...getConfig(), ...patch })
  current = next
  save(next)
  return next
}

/** Write to a temp file and rename, so a crash never leaves half a config behind. */
function save(config: Config): void {
  const tmp = file() + '.tmp'
  writeFileSync(tmp, JSON.stringify(config, null, 2))
  renameSync(tmp, file())
}

export function dataDir(): string {
  return dir()
}
