---
'@nightshift/cli': patch
'@nightshift/core': patch
'@nightshift/dashboard': patch
'@nightshift/plugin-spotify': patch
'@nightshift/sdk': patch
'@nightshift/services': patch
---

Ship a bundled Spotify Connect control plugin (playlists, podcasts, transport — no audio streaming). Existing configs migrate to load it with a network grant; the widget collects Developer app credentials and OAuths via a loopback callback. Browsing a podcast opens its episode list, playing anything returns to the now-playing hero, and library responses tolerate the null entries Spotify returns for unavailable content. Now-playing asks for episodes as well as tracks, and re-reads the player once Spotify has accepted a transport command, so starting something always shows up in the widget.
