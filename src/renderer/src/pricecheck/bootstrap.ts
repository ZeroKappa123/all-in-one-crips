import { setDataLoader } from '@/assets/data/loader'
import { init } from '@/assets/data'
import { setTradeConfig, AppConfig } from '@/web/Config'
import { useLeagues } from '@/web/background/Leagues'
import { usePoeninja } from '@/web/background/Prices'
import type { Config } from '@shared/config'

/** Loads the game data once per window and points the trade modules at the configured league. */
let ready: Promise<void> | null = null
export function bootstrapPriceCheck(): Promise<void> {
  ready ??= (async () => {
    setDataLoader({
      text: async p => (await window.crips.readData(p, 'text')) as string,
      binary: async p => (await window.crips.readData(p, 'binary')) as ArrayBuffer
    })
    await init('en')
    const { config } = await window.crips.getConfig()
    applyConfig(config)
    window.crips.onConfig(applyConfig)
    await useLeagues().load()
    usePoeninja().queuePricesFetch()
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
