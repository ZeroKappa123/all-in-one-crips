# All-In-One CRIPS

Price checks and a campaign guide for Path of Exile 1, in one overlay. Made by **zero**. No AutoHotkey needed.
All-In-One CRIPS isn't affiliated with or endorsed by Grinding Gear Games.

## Install (Windows)

1. Unzip `All-In-One-CRIPS-1.0.0-win.zip` and run `All-In-One CRIPS.exe`. It's unsigned, so SmartScreen asks once ("More info" → "Run anyway").
2. Path of Exile: **Windowed Fullscreen**, language **English**.
3. The app lives in the tray. Click the icon for settings and pick your league under *Price Check*.

If PoE runs as administrator, All-In-One CRIPS must too, or the hotkeys won't reach it. Settings from the earlier version ("Assay") are taken over on first start.

## Price check

Hover an item and press **Ctrl+D** (**Ctrl+Alt+D** keeps the panel open). The app copies the item's advanced description, reads it with the game data, and shows:

- search modes (pseudo, exact, base item, bulk) and item filters (item level, links, quality, gem level, map tier, stack size, corrupted, influences…)
- every modifier with its tier, roll and min/max, pseudo totals for resistances, life and more
- listings from the official trade site, grouped by seller, with online/away status, or the bulk exchange for currency
- the poe.ninja market value with its 7-day trend

**Shift+Space** opens the overlay with settings, stopwatch, guide and tree buttons. **Alt+W** opens the item in the wiki, **Ctrl+wheel** scrolls stash tabs, chat commands (F5 hideout, F9 character select, `@last` for your last whisper) are set under *Chat Commands*.

## Appearance and icons

Dark by default. Switch to **Light** or **System** under Settings → Price Check → Appearance; every window follows, the overlays above the game included.
Item and currency icons are shown straight from Grinding Gear Games' image server (`web.poecdn.com`), like on the official trade site. No game artwork is packaged with the app. Without a connection the short names (chaos, div) are shown instead.

## Act Tracker

1. Settings → **Act Tracker**. The game's `Client.txt` is found automatically in the usual folders; otherwise choose it by hand.
2. Enter your **character name** (levels, experience hints, gear tracker).
3. Optional: copy a **Path of Building** code or **pobb.in** link and click *Import from clipboard*.
4. Play. The guide turns its pages when you enter the area at the end of a page.

| Key | Does |
| --- | --- |
| Alt+G | show or hide the guide |
| Alt+T | skill tree overlay (Q/E switch tree, hold 1–4 ascendancy, hold W overview, right-drag to align, wheel to zoom, Esc) |
| Alt+S | paste your build's gem search into the open vendor window |
| F3 / F4 | previous / next guide page (off by default) |

## Develop

```bash
npm install
npm run dev                      # app with hot reload
npm test                         # unit tests
npm run build && npm run e2e     # end-to-end tests against canned responses (CRIPS_FIXTURES)
npm run dist:win                 # Windows installer (run on Windows)
```

## Credits

- Price-check logic, item parser and game data: [Awakened PoE Trade](https://github.com/SnosMe/awakened-poe-trade) © 2020 Alexander Drozdov, MIT License (in `src/apt`).
- Campaign route and data: [exile-leveling](https://github.com/HeartofPhos/exile-leveling) © HeartofPhos, MIT License.
- Passive tree data: Grinding Gear Games' skill tree export.
- Typeface: Inter, SIL Open Font License.

Full licence texts: `resources/THIRD_PARTY.md`.
