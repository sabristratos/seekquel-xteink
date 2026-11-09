# Changelog

## 1.2.1

- Fixes reading time not being sent after updating the plugin in place: opening the card now sets sending back up if the update left it off. If you updated to 1.2.0 and nothing arrived, open the card on the reader's Plugins page once, then leave File Transfer.

## 1.2.0

- For accounts in Seekquel's beta: a book you read to the end on this reader is marked read in Seekquel when you leave it on its last page. Jumping to the end does not count.
- For accounts in Seekquel's beta: your highlights go to the book's notebook in Seekquel when you choose Sync Progress. The card turns the reader's highlights sync on for you.
- The card asks Seekquel which of these your account has each time it opens, and sets the reader up to match.

## 1.1.0

- Follows CrossPoint 2.0.0, the first stable release with plugins: the Seekquel card is now on the reader's Plugins page, where 2.0.0 shows plugin cards.

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
