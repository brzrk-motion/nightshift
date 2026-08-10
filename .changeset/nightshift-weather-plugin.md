---
"@nightshift/cli": patch
"@nightshift/core": patch
"@nightshift/dashboard": patch
"@nightshift/plugin-weather": patch
"@nightshift/sdk": patch
"@nightshift/services": patch
---

Add gated `context.fetch` (HTTPS, `network` capability) and ship a bundled Open-Meteo weather plugin with multi-location widgets on the default home dashboard. Existing v1 configs are migrated to load weather with a network grant.
