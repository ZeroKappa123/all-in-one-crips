const t = require('./src/renderer/tokens.json')
// color-mix lets opacity modifiers like bg-danger/20 work with CSS-variable colours
const colors = Object.fromEntries(Object.keys(t.dark).map(k => [k, `color-mix(in srgb, var(--c-${k}) calc(<alpha-value> * 100%), transparent)`]))
const fontSize = Object.fromEntries(Object.entries(t.type).map(([k, v]) => [k, [`${v.size}px`, { lineHeight: `${v.line}px`, fontWeight: String(v.weight) }]]))
const spacing = Object.fromEntries(t.space.map((v, i) => [String(i), `${v}px`]))
module.exports = {
  content: ['./src/renderer/**/*.{html,tsx,ts}'],
  theme: {
    colors: { transparent: 'transparent', current: 'currentColor', white: '#ffffff', black: '#000000', ...colors },
    fontSize, spacing: { ...spacing, row: 'var(--row-height)', panel: 'var(--panel-width)' },
    borderRadius: { none: '0', sm: 'var(--r-sm)', md: 'var(--r-md)', lg: 'var(--r-lg)', full: 'var(--r-pill)' },
    boxShadow: { card: 'var(--sh-card)', pop: 'var(--sh-pop)', none: 'none' },
    fontFamily: { sans: 'var(--font-sans)', mono: 'var(--font-mono)' },
    extend: { width: { panel: 'var(--panel-width)' }, transitionDuration: { fast: 'var(--m-fast)', base: 'var(--m-base)' } }
  }
}
