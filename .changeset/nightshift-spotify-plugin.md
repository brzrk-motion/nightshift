---
"@nightshift/cli": patch
"@nightshift/core": patch
"@nightshift/dashboard": patch
"@nightshift/plugin-spotify": patch
"@nightshift/sdk": patch
"@nightshift/services": patch
---

Ship a bundled Spotify Connect control plugin (playlists, podcasts, transport — no audio streaming). Existing configs migrate to load it with a network grant; the widget collects Developer app credentials and OAuths via a loopback callback.
