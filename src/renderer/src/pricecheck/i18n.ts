import dict from '@/assets/data/app_i18n.en.json'

/** Resolves the original app's message keys ("filters.hide_ele_res") to their English text. */
export function aptText(key: string | undefined): string | undefined {
  if (!key) return undefined
  let cur: unknown = dict
  for (const part of key.split('.')) {
    if (cur && typeof cur === 'object' && part in (cur as Record<string, unknown>)) cur = (cur as Record<string, unknown>)[part]
    else { cur = undefined; break }
  }
  if (typeof cur === 'string') return cur
  const flat = (dict as unknown as Record<string, Record<string, string>>).filters?.[key]
  return flat ?? key.replace(/^filters\./, '').replace(/_/g, ' ')
}
