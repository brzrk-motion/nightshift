import { MPEGDecoder } from 'mpg123-decoder';
import { MIXER_CHANNELS, MIXER_SAMPLE_RATE } from './entity.js';
import { loadWav, pcmFromChannels, type PcmBuffer } from './wav.js';

/** Resident PCM per clip. Long beds loop this window instead of the whole file. */
export const MAX_DECODED_SECONDS = 60;

const MAX_MPEG_BYTES = Math.ceil((320_000 / 8) * MAX_DECODED_SECONDS) + 64 * 1024;

function isRiffWav(bytes: Uint8Array): boolean {
  return (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x41 &&
    bytes[10] === 0x56 &&
    bytes[11] === 0x45
  );
}

function isMpeg(bytes: Uint8Array): boolean {
  if (bytes.length < 3) return false;
  if (bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33) return true;
  const next = bytes[1];
  return bytes[0] === 0xff && next !== undefined && (next & 0xe0) === 0xe0;
}

function id3v2Size(bytes: Uint8Array): number {
  if (bytes.length < 10) return 0;
  if (bytes[0] !== 0x49 || bytes[1] !== 0x44 || bytes[2] !== 0x33) return 0;
  const size =
    ((bytes[6] ?? 0) << 21) | ((bytes[7] ?? 0) << 14) | ((bytes[8] ?? 0) << 7) | (bytes[9] ?? 0);
  return 10 + size;
}

function mpegWindow(bytes: Uint8Array): Uint8Array {
  const start = Math.min(id3v2Size(bytes), bytes.length);
  const end = Math.min(bytes.length, start + MAX_MPEG_BYTES);
  return start === 0 && end === bytes.length ? bytes : bytes.subarray(start, end);
}

export function limitPcm(
  buffer: PcmBuffer,
  maxFrames = MIXER_SAMPLE_RATE * MAX_DECODED_SECONDS,
): PcmBuffer {
  if (buffer.frameCount <= maxFrames) return buffer;
  return {
    ...buffer,
    frames: buffer.frames.slice(0, maxFrames * MIXER_CHANNELS),
    frameCount: maxFrames,
  };
}

async function loadMp3(bytes: Uint8Array): Promise<PcmBuffer> {
  const decoder = new MPEGDecoder();
  await decoder.ready;
  try {
    const decoded = decoder.decode(mpegWindow(bytes));
    const left = decoded.channelData[0];
    if (!left || decoded.samplesDecoded < 1) {
      throw new Error('MP3 decode produced no samples');
    }
    return pcmFromChannels(
      decoded.channelData,
      decoded.sampleRate,
      MIXER_SAMPLE_RATE * MAX_DECODED_SECONDS,
    );
  } finally {
    decoder.free();
  }
}

/**
 * Decode a bundled clip: WAV PCM via the RIFF parser, MP3 via mpg123 WASM.
 * Long files are trimmed to {@link MAX_DECODED_SECONDS} so the mixer does not
 * keep a full-length bed resident.
 */
export async function loadClip(bytes: Uint8Array): Promise<PcmBuffer> {
  if (isRiffWav(bytes)) return limitPcm(loadWav(bytes));
  if (isMpeg(bytes)) return limitPcm(await loadMp3(bytes));
  throw new Error('Unsupported audio format');
}
