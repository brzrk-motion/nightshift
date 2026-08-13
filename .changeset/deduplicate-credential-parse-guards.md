---
'@nightshift/core': patch
'@nightshift/sdk': patch
'@nightshift/plugin-home-assistant': patch
'@nightshift/plugin-spotify': patch
---

Add `parseStoredVersion` for defensive versioned storage parsing. Home Assistant and Spotify credential blobs now share the helper; Spotify storage writes include a `version` field (legacy blobs without it still load).
