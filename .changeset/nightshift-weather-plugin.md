---
'@nightshift/cli': patch
'@nightshift/core': patch
'@nightshift/dashboard': patch
'@nightshift/plugin-weather': patch
'@nightshift/sdk': patch
'@nightshift/services': patch
---

Add gated `context.fetch` (HTTPS, `network` capability) and ship a bundled Open-Meteo weather plugin with multi-location widgets on the default home dashboard. Existing v1 configs are migrated to load weather with a network grant. The current-conditions hero scales with its slot, and everything it draws stays readable: humidity and wind drop to plain text so the temperature can keep the six-row `block` ascii font as the widget shrinks, then the blank rows around the hero are spent to hold onto that font a few rows longer, and only once six rows are out of reach does the temperature step down — to the two-row `tiny` font rather than straight to one row of plain text, which stays drawn even in the smallest widget that has room for nothing but the temperature. The weather art goes from 12x5 to 7x3 to a single glyph, and the labels under the values are the first thing dropped — `°C`, `%` and `km/h` already say what each number is, and the art already says what the condition is. Below 14 rows the toolbar's bordered buttons become one row of pressable `[chips]`, which is what keeps the temperature on screen in the shortest widgets. A widget squeezed small now loses detail instead of drawing over its own toolbar and border.
