# All-In-One CRIPS

Price checks, a campaign guide and a trade helper for Path of Exile 1, in one overlay. Made by **zero**. No AutoHotkey needed.
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
The campaign guide uses its own symbols for waypoints, towns, quests, portals, trials, crafting and the labyrinth, with the colours and gem dots of exile-leveling's guide.

## Widescreen (Windows)

Switch it on or off in the tray menu (*Widescreen*), in the overlay (Shift+Space, rectangle button) or under Settings → Widescreen.
The game window becomes borderless and full screen; *Wide picture* makes it lower so the picture gets wider. **F2** switches the wide picture, **Ctrl+↑/↓** moves the window, **Shift+↑/↓** moves it by one pixel. *Wideness* sets how wide (default 1.35); lower it if black bars appear at the sides.
Only the window frame is changed, never the game itself. If the game runs as administrator, start this app as administrator too.
Idea after the "PoE Widescreen" AutoHotkey script by Mikey, rebuilt without AutoHotkey.

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

## Trade Helper

Incoming trade whispers become cards at the edge of the screen (idea from Poe-Lurker by C1rdec). Each click sends exactly one chat command.

| On a card | Does |
| --- | --- |
| main button | Invite → Trade → Trade again → Kick (when done) |
| Busy / Thanks | sends your message (Settings → Trade Helper) |
| Ctrl+click | "sold" message · Ctrl+Shift+click: "still interested?" |
| right-click | /whois · Alt+click: make this the active trade |
| stash button | outlines the item in your open stash tab (fit the frame once under Settings → Trade Helper) |

Outgoing whispers you sent show up too (Hideout, Trade, Resend). *Auto-whisper* (off by default) whispers a trade-site message you copy; hold Shift while copying to skip it.

## After a PoE patch: updates

**Game data (automatic, nothing to do):** after a patch, Awakened PoE Trade publishes new item and mod data. The app checks for it on start and every 6 hours, downloads it, checks it and uses it from the next price check. If the new data doesn't work, it silently keeps the data it shipped with. Settings → Price Check → *Game data* shows the version in use and has *Check now* and an on/off switch.

**Everything else (one command, on the PC with the source):**

```bash
npm run update
```

It fetches the latest game data, Act Tracker data (route, quests, gems, passive tree) and the price-check code from the public repositories (no git or GitHub account needed), runs the type check and the tests after each step and puts a step back if it breaks something. At the end it builds `dist/All-In-One-CRIPS-1.0.0-win.zip`. Send that ZIP to your friends: they replace the old folder with it, settings stay (they live in `%APPDATA%`).
Options: `--data-only` (no code), `--no-zip`.

## Develop

```bash
npm install
npm run dev                      # app with hot reload
npm test                         # unit tests
npm run build && npm run e2e     # end-to-end tests against canned responses (CRIPS_FIXTURES)
npm run dist:zip                 # Windows ZIP
npm run dist:win                 # Windows installer (run on Windows)
```

## Credits

- Price-check logic, item parser and game data: [Awakened PoE Trade](https://github.com/SnosMe/awakened-poe-trade) © 2020 Alexander Drozdov, MIT License (in `src/apt`).
- Campaign route and data: [exile-leveling](https://github.com/HeartofPhos/exile-leveling) © HeartofPhos, MIT License.
- Passive tree data: Grinding Gear Games' skill tree export.
- Trade helper idea: [Poe-Lurker](https://github.com/C1rdec/Poe-Lurker) by C1rdec (MIT); written fresh for this app.
- Typeface: Inter, SIL Open Font License.

Full licence texts: `resources/THIRD_PARTY.md`.
