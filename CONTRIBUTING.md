# Contributing

Reports from real readers are the most valuable thing anyone can send right now. The plugin
has been run against CrossPoint's own settings page and a simulated reader, but not yet on
an Xteink in somebody's hands.

## Reporting a bug

Open an issue and include:

- Your reader (X3, X4 or X4 Pro) and the CrossPoint version, from the reader's About screen
  or the `version` on its web page.
- What you expected and what happened instead.
- What the Seekquel card on the reader's web page says.
- If you can, the reader's serial log around the problem. Lines tagged `PEVT` are the
  plugin's events being queued and sent.

Redact your device key if it appears anywhere. It looks like `ABCD-EFGH-IJKL-MNOP`.

## Layout

```
seekquel/              what goes on the memory card
  manifest.json        the card's title and the version, the one place it is written
  device.json          the shipped manifest, with no events until the reader connects
  plugin.js            the card on the reader's web page
  README.md            the text the reader shows under Settings, System, Plugins
tests/                 the card run against a stand-in for the reader's web page
scripts/build.py       writes dist/seekquel-crosspoint-<version>.zip
```

## Building and installing

```bash
npm run check
```

```bash
npm run build
```

Unzip the result onto the root of the memory card. It creates `.crosspoint/plugins/seekquel/`.

## Style

- Two spaces, no tabs. LF endings.
- No comments. Names carry the meaning, and anything that genuinely needs explaining
  belongs in the README where a reader will find it.
- `device.json` is a template the firmware fills without escaping, so a request body only
  ever carries values that cannot break JSON. Anything that might (a file name) goes in a
  header.
- A failure is reported to the reader in words they can act on. "Could not reach Seekquel"
  and "this key is no longer accepted" are different problems and must never be reported
  as the same one.
- Never leave the reader sending requests that cannot succeed. The firmware wakes the
  reader's Wi-Fi to deliver a queued event, so an event that will always fail costs battery
  at every sleep.

## What to expect from a review

A change to what the card writes into the reader's settings, or to what an event sends,
will be read closely, and the question asked of it is always the same one: what happens to
a reader who set that value up differently already.
