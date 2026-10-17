# Seekquel for CrossPoint

A CrossPoint Reader plugin that logs the time you spend reading on an Xteink X3, X4 or X4 Pro, and how far each sitting takes you, in your [Seekquel](https://seekquel.app) account.

Your place in a book already syncs through CrossPoint's KOReader Sync. This plugin adds the reading time, which that protocol cannot carry.

## What you need

- An Xteink reader running CrossPoint firmware with SD plugins (the beta or nightly builds from October 2026 onwards).
- A Seekquel account.

## Install

1. Download `seekquel-crosspoint-<version>.zip` from the [releases page](https://github.com/sabristratos/seekquel-xteink/releases).
2. Unzip it onto the root of the reader's memory card. It creates `.crosspoint/plugins/seekquel/`.
3. Put the card back in the reader.

## Connect

1. Join a Wi-Fi network on the reader.
2. Open the reader's web page on your phone or computer, then open Settings.
3. On the Seekquel card, choose **Connect to Seekquel**. Enter the code in Seekquel, or tap **Open Seekquel** to have it filled in.
4. Leave File Transfer on the reader. Sending starts then.

If the reader already syncs its place with Seekquel, the card offers to use that account instead of a new code.

Connecting also sets the reader's KOReader Sync settings for Seekquel: the server, matching books by their contents rather than their file name, sending each book's title, and server type Other so the exact spot in a book is kept. The card lists any of these that later change, with a button to put them back. If you point KOReader Sync at another server on purpose, such as CrossPoint Sync, the card leaves it there, including when you first connect: your reading time still goes to Seekquel, and the card only sets matching books by their contents. That setting applies to the other server too, so your other devices that sync with it need it as well to find your place.

## What it sends

After at least ten seconds of reading, CrossPoint records a session: the book's fingerprint, when you started, how long you read, and where in the book you began and ended. When the reader goes to sleep it joins Wi-Fi for up to ten seconds and sends the sessions it holds. It skips this with the battery under 20% or no saved network, and sends them next time. You can turn sending at sleep off on the card.

The file's path on the memory card is sent too, so a book Seekquel does not recognise yet can be shown to you by its file name.

Nothing else is sent. Highlights and finished books are not sent yet.

## Develop

```bash
npm run check
```

```bash
npm run build
```

`check` runs the plugin's code against a stand-in for the reader's web page. `build` writes the zip to `dist/`.

## License

MIT. See `LICENSE`.
