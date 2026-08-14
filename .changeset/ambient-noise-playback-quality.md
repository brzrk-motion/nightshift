---
'@nightshift/plugin-ambient-noise': patch
---

Fix Ambient Noise stuttering and harsh loop joins: pull-pace PCM from the speaker callback instead of `setInterval`, use a 300 ms device ring, queue in-flight writes instead of dropping them, and keep waveform/position updates on a separate UI clock. Loop wraps use a short equal-power seam fade, decode resamples with Lanczos, and Soft Static ships at 44.1 kHz / 320 kb/s.
