---
'@nightshift/cli': patch
'@nightshift/dashboard': patch
'@nightshift/plugin-clock': patch
'@nightshift/services': patch
---

Pull the clock out of `packages/dashboard`'s built-ins and ship it as a bundled plugin (`clock.now`), with a settings panel on the widget itself for 12/24-hour, showing seconds, and a date format picked from a few presets (long, medium, short, ISO, or hidden) — all persisted across restarts. `minimal` and `nightshift` stay on built-in-only widgets so they still render with no plugins installed; `home` now draws its clock from the plugin like it already does for weather, focus and todo. Existing v2 configs are migrated to load the clock plugin alongside the others.

The widget also adapts to a short row: below 10 rows the settings panel collapses onto a single line (dropping the fixed-height `Button` for a content-sized chip) and the clock face drops its date line, so the toolbar's "Done" button stays reachable instead of being overrun.

The clock now displays in a real timezone rather than always the process's own: it detects the machine's zone via `Intl.DateTimeFormat` (no network) and falls back to asking for a location, geocoded to a timezone through the same Open-Meteo endpoint weather uses. A `clock.now` added through the widget picker opens straight into its settings panel — 12/24-hour, seconds, date format and timezone all in one place — rather than showing a face with nothing configured yet. Existing v4 configs are migrated to grant the clock plugin `network`, needed for the location lookup.
