/** All enabled item searches as one search: the parts joined with "|", split at the game's 250 characters. */
export function combineItemSearches(regexes: string[], limit = 250): string[] {
  const terms = regexes.map(r => r.trim().replace(/^"|"$/g, '')).filter(Boolean)
  const parts: string[] = []
  let cur: string[] = []
  for (const t of terms) {
    if (cur.length && `"${[...cur, t].join('|')}"`.length > limit) { parts.push(`"${cur.join('|')}"`); cur = [] }
    cur.push(t)
  }
  if (cur.length) parts.push(`"${cur.join('|')}"`)
  return parts
}
