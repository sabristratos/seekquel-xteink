# CrossPoint Plugin: `seekquel`

Governance for `crosspoint-plugin/`. Auto-loaded when working under this directory. The workspace root `CLAUDE.md` and the global `~/.claude/CLAUDE.md` apply on top; this file is the contract for this repo.

| | |
| --- | --- |
| **Path** | `crosspoint-plugin/` |
| **Stack** | JavaScript (CrossPoint SD-card plugin: `plugin.js` in the reader's web page, `device.json` read by the firmware) |
| **Git** | `origin` → github.com/sabristratos/seekquel-xteink (public), `master` |
| **Gate** | `npm run check` (syntax plus the harness in `tests/`), `npm run build` writes `dist/seekquel-crosspoint-<version>.zip` |

**This repo is public: every commit is the owner's, and nothing in it may carry AI attribution, an em dash, or an explanatory comment.** The same rule as the KOReader and Calibre plugins, for the same reason.

## What it is

The Seekquel plugin for Xteink readers on CrossPoint firmware. CrossPoint's KOSync client already syncs the place in a book with nothing installed (`backend/docs/rules-device-sync.md` § *A second client speaks KOSync, and it is not KOReader*); this plugin adds the reading time, which KOSync cannot carry. **It needs CrossPoint's SD-plugin system, merged to `develop` on 2026-09-30 (#3114, with #3204's `reader.session` event) and not in a stable release on 2026-10-15 (1.6.5 predates it).** Do not launch it to readers, write its help article or its changelog line, or change the Xteink screen's "no reading time" copy, until a stable CrossPoint release carries plugins.

A CrossPoint plugin is not code on the device. `plugin.js` runs in the reader's web page on a phone or computer; `device.json` is a declarative manifest the firmware interprets, binding a whitelisted event to an HTTP request template. Read `docs/sd-plugins.md` and `docs/plugin-events.md` in the firmware repo before changing either file; the surface moved weekly through October 2026.

## The rules, each one bought by the KOReader add-on or the Xteink testers

- **Nobody types a key on the reader.** The card pairs by device code over `api.relay` (`/koreader/pair/start` with `client: xteink`, then `/koreader/pair/poll`), and the code is approved on the Xteink screen in the app, which the link fills in. Before 2026-09-15 the Xteink setup screen hid the key as it appeared and stranded readers; the KOReader add-on paired by code from the start for the same reason. A reader whose KOReader Sync already holds a Seekquel key is offered that account instead, checked against `/users/auth` first.
- **The card writes the reader's KOReader Sync settings, because the firmware's defaults are wrong for us.** Server URL, the key as username, a non-empty password (the firmware refuses to sync without one; the server never reads it), matching by contents (`koMatchMethod` 1, so the session's binary partial-MD5 is the same document the progress push names), sending book metadata, server type Other (`koServerType` 2, which restores the exact-position object and sends ISBN, ASIN and series), and clippings sync off (the server has no `/api/v1/clippings` yet, so on would fail every sync). Only keys `GET /api/settings` lists are written, so older firmware degrades to the reader setting them by hand. The connected card lists any that drift and offers to put them back.
- **No events until connected.** The shipped `device.json` has a title and no `events`. Connecting writes the events manifest; disconnecting writes the idle one back. An events handler with nothing configured would join Wi-Fi at every sleep to send a request that cannot succeed, which spends battery for nothing. **No restart is needed, whatever the docs say.** `docs/plugin-events.md` says subscriptions are rebuilt at boot, but `CrossPointWebServerActivity::onExit()` calls `refreshSubscriptions()` too (and non-touch models reboot there anyway), so leaving File Transfer is enough and the card says that. Do not bring back a restart notice keyed on the reader's uptime: on a touch model that never reboots it would never clear.
- **A malformed request must still be acknowledged.** Delivery is at-least-once and in order, and the firmware stops a drain at the first failure, so one request the server refuses would hold every later session behind it until the 4KB outbox drops them. The server answers a body that fails validation with `202 {"accepted": false}` and records the refusal on the device (`StoreReadingSessionRequest::failedValidation`). Templates substitute without escaping and leave an unknown variable as its literal `{event.x}` text, so the body carries only values that cannot break JSON (hex, integers, our own constants). **The file path goes in the `X-Book-Path` header, never in the body**: a filename holding a quote would otherwise make the whole body invalid. The cost of the header is accepted; a header is never parsed as JSON.
- **A removed device must not wake the radio forever.** A queued `connect: true` event makes the firmware join Wi-Fi at every sleep until it is delivered, so the server answers a key it no longer accepts with 202 rather than 401, and the card checks the key quietly when the page opens and says so plainly if it has been removed, rather than showing "Connected".
- **The card wears CrossPoint's own classes** (`btn-small btn-add` for the primary action, `btn-delete` for Disconnect, `setting-row` for the toggle) and adds only a scoped layout rule of its own, so it reads as part of the reader's settings page. A link styled as a button needs `box-sizing: border-box`, or the page's `min-height` adds to its padding and it renders taller than the buttons beside it.
- **The server holds what it cannot place yet.** A session for a file the server has not seen creates the document as Unidentified with the file name, keeps the session in `koreader_documents.session_log` (30 days), and credits it the moment the file is linked to a book (`KoreaderDocumentObserver`). The device cannot hold it: its outbox drops oldest first.
- **A session is a summary, not page turns.** BookOrbit's `/plugin/page-stats` reads every event as one page turned, so a sitting sent there credits two pages however far the reader got. The plugin posts to `/koreader/reading-sessions`, which turns the sitting's start and end into a share of the book and its seconds into the hours they fell in, split across midnight in the reader's own timezone.
- **Version is read, not restated.** `manifest.json` is the one place the version lives; `plugin.js` reads it at load and writes it into the session template, so the server records it on the device row (`app_version`).
- **Sending at sleep is the reader's choice.** On by default. The firmware joins Wi-Fi for at most ten seconds and skips it under 20% battery; the toggle rewrites the manifest with `connect: false`, and sessions then wait for the next time the reader is on Wi-Fi anyway.

## What it cannot do yet

- **Highlights and finished status.** The event whitelist has neither. CrossPoint's native clippings sync (`src/clippings/ClippingSync.cpp`, `GET`/`PUT {server}/api/v1/clippings/{hash}`, `sync_version` 2) is the route for highlights and needs a backend endpoint first.
- **Moving the place on sleep.** `reader.session` carries the end of the sitting, but the place still moves only when the reader chooses Sync Progress. Making a session move the book's place without touching the document's exact KOSync position is a server change still to decide.
- **Updating itself.** CrossPoint has a Plugin Store (a catalogue plugin with version badges); listing there is how readers would get updates. Until then an update is a file copy.
- **Translation.** The firmware's web page is English and the card follows it; strings sit in `TEXT` and `PROBLEMS` so a language can be added in one place.

`plugin.js` keeps no comments; the reasons live here.
