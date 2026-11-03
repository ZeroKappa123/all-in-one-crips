import { setDataLoader } from '@/assets/data/loader'
import { init } from '@/assets/data'
import { setTradeConfig, AppConfig } from '@/web/Config'
import { useLeagues } from '@/web/background/Leagues'
import { usePoeninja } from '@/web/background/Prices'
import type { Config } from '@shared/config'
import { loadIcons } from './icons'

/** Loads the game data once per window and points the trade modules at the configured league. */
let ready: Promise<void> | null = null
let dataSha: string | null | undefined
let listening = false

async function loadData(): Promise<void> {
  const status = await window.crips.data.status()
  try {
    await init('en')
    dataSha = status.active?.sha ?? null
  } catch (e) {
    // Downloaded data the parser can't use: report it, main switches back to the shipped data.
    if (!status.active) throw e
    window.crips.data.failed(e instanceof Error ? e.message : String(e))
    await init('en')
    dataSha = null
  }
}

export function bootstrapPriceCheck(): Promise<void> {
  if (!listening) {
    listening = true
    // new game data was activated: load it before the next price check
    window.crips.data.onChanged(s => { if (ready && !s.checking && (s.active?.sha ?? null) !== dataSha) ready = null })
  }
  ready ??= (async () => {
    setDataLoader({
      text: async p => (await window.crips.readData(p, 'text')) as string,
      binary: async p => (await window.crips.readData(p, 'binary')) as ArrayBuffer
    })
    const first = dataSha === undefined
    await loadData()
    if (!first) return
    const { config } = await window.crips.getConfig()
    applyConfig(config)
    window.crips.onConfig(applyConfig)
    await useLeagues().load()
    usePoeninja().queuePricesFetch()
    void loadIcons()
  })()
  return ready
}

export function applyConfig(c: Config): void {
  setTradeConfig({ leagueId: c.leagueId })
  const pc = AppConfig<Record<string, unknown>>('price-check')!
  pc.searchStatRange = c.searchTolerancePct
  pc.smartInitialSearch = c.autoSearch
  pc.lockedInitialSearch = c.autoSearch
}
