// Generates CSS custom properties from the design tokens. Run: npm run tokens
import { readFileSync, writeFileSync } from 'node:fs'
const t = JSON.parse(readFileSync(new URL('../src/renderer/tokens.json', import.meta.url)))
const lines = [':root {']
for (const [k, v] of Object.entries(t.color)) lines.push(`  --c-${k}: ${v};`)
for (const [k, v] of Object.entries(t.radius)) lines.push(`  --r-${k}: ${v}px;`)
for (const [k, v] of Object.entries(t.shadow)) lines.push(`  --sh-${k}: ${v};`)
for (const [k, v] of Object.entries(t.motion)) lines.push(`  --m-${k}: ${v};`)
lines.push(`  --row-height: ${t.layout['row-height']}px;`, `  --panel-width: ${t.layout['panel-width']}px;`)
lines.push(`  --font-sans: ${t.font.sans};`, `  --font-mono: ${t.font.mono};`, '}')
writeFileSync(new URL('../src/renderer/src/tokens.css', import.meta.url), lines.join('\n') + '\n')
console.log('tokens.css written')
