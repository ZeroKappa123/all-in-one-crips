// Stand-in for the original app's config module: only what the price-check logic reads.
import type { PriceCheckWidget } from './overlay/widgets'

export interface CripsTradeConfig {
  leagueId: string | undefined
  realm: 'pc-ggg'
  language: 'en'
  useIntlSite: boolean
  priceCheck: Pick<PriceCheckWidget, 'showSeller' | 'searchStatRange' | 'showRateLimitState' | 'apiLatencySeconds' | 'collapseListings' |
    'smartInitialSearch' | 'lockedInitialSearch' | 'activateStockFilter' | 'merchantOnly' | 'defaultCurrency' | 'requestPricePrediction'>
}

const config: CripsTradeConfig & { widgets: unknown[] } = {
  widgets: [],
  leagueId: 'Standard',
  realm: 'pc-ggg',
  language: 'en',
  useIntlSite: true,
  priceCheck: {
    showSeller: false,
    searchStatRange: 10,
    showRateLimitState: false,
    apiLatencySeconds: 2,
    collapseListings: 'app',
    smartInitialSearch: true,
    lockedInitialSearch: true,
    activateStockFilter: false,
    merchantOnly: false,
    defaultCurrency: null,
    requestPricePrediction: false
  }
}

export function setTradeConfig(patch: Partial<CripsTradeConfig>): void {
  Object.assign(config, patch)
}

export function AppConfig(): CripsTradeConfig & { widgets: unknown[] }
export function AppConfig<T>(type: string): T | undefined
export function AppConfig(type?: string): unknown {
  if (type === 'price-check') return config.priceCheck
  if (type) return undefined
  return config // the original mutates this object (e.g. the selected league), so hand out the real one
}

export function poeWebApi(): string {
  return 'www.pathofexile.com'
}
