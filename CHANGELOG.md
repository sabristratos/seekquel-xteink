# Changelog

## Unreleased

- Connecting only accepts a secure sync address from Seekquel and a key that is text, and a save that fails part way no longer leaves the reader set to send reading time with no connection saved.

## 1.0.2

- A paired reader is named from its model, for example Xteink X4 Pro, instead of its raw model id.

## 1.0.1

- A reader that syncs its place with another server, such as CrossPoint Sync, keeps it, including when the plugin is first connected: connecting changes none of its sync settings. The card says where the place syncs, still sends reading time to Seekquel, and offers to match books by their contents, which that server uses too.
- A sync settings change that fails, for example over a dropped connection, now says so instead of showing nothing.

## 1.0.0

- Connects by code, approved in Seekquel, so no key is typed on the reader.
- Sends each reading session (time, start and end in the book) when the reader sleeps, or on the next Wi-Fi connection if that is turned off.
- Sets the reader's KOReader Sync settings for Seekquel and reports any that later change.
- Reuses the Seekquel key a reader already syncs its place with.
