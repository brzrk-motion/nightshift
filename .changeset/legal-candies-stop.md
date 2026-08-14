---
'@nightshift/plugin-weather': patch
---

Remove the mirrored `weather.now` entity. Automations and consumers should read the primary location slot from `weather.locations` instead.
