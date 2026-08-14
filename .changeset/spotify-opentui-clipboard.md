---
'@nightshift/sdk': patch
'@nightshift/ui': patch
'@nightshift/plugin-spotify': patch
---

Export `useRenderer` from the SDK and use OpenTUI's `copyToClipboardOSC52` for the Spotify OAuth link copy button instead of a hand-rolled OSC 52 helper.
