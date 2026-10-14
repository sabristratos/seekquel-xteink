# Security

## Reporting a vulnerability

Email **support@seekquel.app** with the details. Please do not open a public issue for
anything exploitable.

Include what you found, how to reproduce it, and what an attacker could do with it. You
will get an acknowledgement within a few days.

## What is worth reporting

- Anything that lets one account read or write another account's reading data.
- Anything that leaks a device key, or lets a device key be guessed or reused.
- Anything that lets the pairing exchange be completed by somebody who is not the reader
  approving it.
- Anything that lets a session be credited to a book or an account it did not come from.

## Known and deliberate

**The device key is stored in plain text on the memory card**, in
`.crosspoint/plugins/seekquel/config.json`, and as the KOReader Sync username in the
reader's own settings. The firmware gives plugins no keystore and reads the file to fill
in each request. Two things bound what the key is worth: it is scoped to syncing and can
neither read nor change account settings, and it is revocable at any time from Settings,
Integrations in Seekquel. Anyone holding the card holds the key, so treat the card the way
you would treat the reader.

**The key is never typed.** The card obtains it through the pairing exchange, approved in
Seekquel, so it does not exist anywhere a reader might copy it from.

**The pairing code is eight characters** and lives for fifteen minutes behind a human
approval on an account somebody is already signed in to. The device code that backs the
exchange is 64 characters and is stored hashed.

**Certificates are not verified on the reader.** CrossPoint ships no certificate bundle, so
the reader's own requests, the plugin's included, are encrypted but do not check who
answered. That is the firmware's posture for every connection it makes, not something this
plugin can change.
