---
'@nightshift/plugin-shared': patch
'@nightshift/plugin-home-assistant': patch
'@nightshift/plugin-spotify': patch
---

Extract shared bearer HTTP helpers (`authorizedFetch`, `ensureOk`, `HttpError`) into `@nightshift/plugin-shared` and route the Home Assistant and Spotify clients through them.
