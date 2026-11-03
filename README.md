# Assay

Price-check overlay for Path of Exile 1. Learning project, clean-room rebuild of the core features of Awakened PoE Trade.
Assay isn't affiliated with or endorsed by Grinding Gear Games.

## Try it (Windows)

1. Unzip `Assay-0.1.0-win.zip` anywhere and run `Assay.exe`. It's unsigned, so Windows SmartScreen asks once ("More info" → "Run anyway").
2. Set Path of Exile to **Windowed Fullscreen**, language **English**.
3. Hover an item, press **Ctrl+D**. **Ctrl+Alt+D** keeps the panel open, **Shift+Space** shows the overlay, the tray icon opens settings.
4. Pick your league in Settings → General.

If PoE runs as administrator, Assay must too, or the hotkeys won't reach it.

## Develop

```bash
npm install
npm run dev          # app with hot reload
npm test             # unit tests (parser, stat matching, query, rate limiter, config)
npm run build && npm run e2e   # end-to-end tests against canned responses
npm run dist:win     # NSIS installer (run on Windows)
npm run dist:linux   # AppImage
```

Offline mode: set `ASSAY_FIXTURES=test/fixtures` and the app answers from canned responses instead of the trade site.

## How it works

`src/shared` holds everything testable without Electron: item parser, stat matching against the trade site's stat list, pseudo totals, search query builder, rate limiter, config schema. `src/main` does windows, tray, global input (uiohook-napi) and network. `src/renderer` is the React UI, styled only through design tokens (`src/renderer/tokens.json`).

Rules the app keeps: one server action per key press, no game-process access, rate-limit headers honoured, no personal data sent.
