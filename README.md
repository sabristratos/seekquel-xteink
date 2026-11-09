# Seekquel for CrossPoint

A CrossPoint Reader plugin that logs the time you spend reading on an Xteink X3, X4 or X4 Pro, and how far each sitting takes you, in your [Seekquel](https://seekquel.app) account.

Your place in a book already syncs through CrossPoint's KOReader Sync. This plugin adds the reading time, which that protocol cannot carry.

## What you need

- An Xteink reader running CrossPoint firmware with plugins: 2.0.0, the first stable release with them, or a beta or nightly build from October 2026 onwards. The plugin has run on the beta builds and is still being tested on 2.0.0.
- A Seekquel account.

## Install

1. On the reader, turn on **Settings > Connectivity > Plugins** if it is off. A new install of CrossPoint 2.0.0 starts with plugins off.
2. Download `seekquel-crosspoint-<version>.zip` from the [releases page](https://github.com/sabristratos/seekquel-xteink/releases).
3. Unzip it onto the root of the reader's memory card. It creates `.crosspoint/plugins/seekquel/`.
4. Put the card back in the reader.

## Connect

1. Join a Wi-Fi network on the reader.
2. Open the reader's web page on your phone or computer, then open Plugins.
3. On the Seekquel card, choose **Connect to Seekquel**. Enter the code in Seekquel, or tap **Open Seekquel** to have it filled in.
4. Leave File Transfer on the reader. Sending starts then.

If the reader already syncs its place with Seekquel, the card offers to use that account instead of a new code.

Connecting also sets the reader's KOReader Sync settings for Seekquel: the server, matching books by their contents rather than their file name, sending each book's title, and server type Other so the exact spot in a book is kept. The card lists any of these that later change, with a button to put them back. If you point KOReader Sync at another server on purpose, such as CrossPoint Sync, the card leaves it there, including when you first connect: your reading time still goes to Seekquel, and the card only sets matching books by their contents. That setting applies to the other server too, so your other devices that sync with it need it as well to find your place.

## What it sends

After at least ten seconds of reading, CrossPoint records a session: the book's fingerprint, when you started, how long you read, and where in the book you began and ended. When the reader goes to sleep it joins Wi-Fi for up to ten seconds and sends the sessions it holds. It skips this with the battery under 20% or no saved network, and sends them next time. You can turn sending at sleep off on the card.

The file's path on the memory card is sent too, so a book Seekquel does not recognise yet can be shown to you by its file name.

Two more things are sent only for accounts in Seekquel's beta, and the card asks Seekquel each time it opens whether yours is one:

- **Finished books.** When you leave a book, the reader sends how far through it you were. On the last page or the end screen, Seekquel marks the book read if your sessions show you read through it on your Xteink, at a believable pace, in the last 30 days. Jumping to the end does not count.
- **Highlights.** The card turns on the reader's own highlights sync. When you choose Sync Progress in a book, the reader sends that book's highlights with its place, and they go to the book's notebook in Seekquel. Nothing is sent back to the reader, and a highlight you delete on the reader stays in Seekquel.

Nothing else is sent.

## Develop

```bash
npm run check
```

```bash
npm run build
```

`check` runs the plugin's code against a stand-in for the reader's web page. `build` writes the zip to `dist/`.

The plugin itself is the `seekquel.crosspoint-plugin/` folder; everything else in this repository stays off the reader. Plugin Hub picks up each full GitHub release whose tag matches the version in its `manifest.json`.

## License

MIT. See `LICENSE`.
