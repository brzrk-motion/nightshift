---
'@nightshift/cli': patch
'@nightshift/dashboard': patch
'@nightshift/plugin-home-assistant': patch
'@nightshift/sdk': patch
'@nightshift/services': patch
---

Add a bundled Home Assistant scenes plugin (configure address + token, list/activate scenes, vibe `onActivate` bindings). Allow `context.fetch` over HTTP to loopback/private IPs so local HA works; existing v7 configs migrate to v8 with the plugin and network grant.
