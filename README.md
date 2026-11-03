# Assay

Overlay for Path of Exile 1: price checks and a campaign guide. Learning project, every line written from scratch (no AutoHotkey).
Assay isn't affiliated with or endorsed by Grinding Gear Games.

## Try it (Windows)

1. Unzip `Assay-0.1.0-win.zip` anywhere and run `Assay.exe`. It's unsigned, so Windows SmartScreen asks once ("More info" → "Run anyway").
2. Set Path of Exile to **Windowed Fullscreen**, language **English**.
3. Hover an item, press **Ctrl+D**. **Ctrl+Alt+D** keeps the panel open, **Shift+Space** shows the overlay, the tray icon opens settings.
4. Pick your league in Settings → General.

If PoE runs as administrator, Assay must too, or the hotkeys won't reach it.

## Act Tracker (campaign guide)

1. Settings (tray icon) → **Act Tracker**. Assay looks for `Client.txt` in the usual install folders; if it says it can't find it, choose the file by hand (it's in the `logs` folder of your game).
2. Enter your **character name** for level tracking, experience hints and the gear tracker.
3. Optional: copy a **Path of Building** code or **pobb.in** link and click *Import from clipboard*. The guide then shows which gem to take and which to buy at every quest, *Plan gem pickups* lets you delay or skip gems, and the tree overlay shows your build.
4. Play. The guide turns its pages when you enter the area at the end of a page. Click `<` `>` to browse, hold `<` to restart, hold `>` to jump to the area you're in.
5. Timer: click `A1` to start, hold right-click on it to reset. Runs are written to `export/campaign runs.csv` in the settings folder when you reach the epilogue.

| Key | Does |
| --- | --- |
| Alt+G | show or hide the guide |
| Alt+T | skill tree overlay (Q/E switch tree, hold 1–4 ascendancy, hold W overview, right-drag to align, wheel to zoom, Esc) |
| Alt+S | paste your build's gem search into the open vendor window (press again for the next part) |
| F3 / F4 | previous / next guide page (off by default) |

The guide editor (Settings → Act Tracker → *Edit guide*) shows one field per page; red means the page doesn't end in a known area.

Default route and game data: [exile-leveling](https://github.com/HeartofPhos/exile-leveling) by HeartofPhos (MIT), see `resources/THIRD_PARTY.md`. Passive tree data: Grinding Gear Games' skill tree export.

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
