import { MPEGDecoder } from 'mpg123-decoder';
import { loadWav, pcmFromChannels, type PcmBuffer } from './wav.js';

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

async function loadMp3(bytes: Uint8Array): Promise<PcmBuffer> {
  const decoder = new MPEGDecoder();
  await decoder.ready;
  try {
    const decoded = decoder.decode(bytes);
    const left = decoded.channelData[0];
    if (!left || decoded.samplesDecoded < 1) {
      throw new Error('MP3 decode produced no samples');
    }
    return pcmFromChannels(decoded.channelData, decoded.sampleRate);
  } finally {
    decoder.free();
  }
}

/**
 * Decode a bundled clip: WAV PCM via the RIFF parser, MP3 via mpg123 WASM.
 */
export async function loadClip(bytes: Uint8Array): Promise<PcmBuffer> {
  if (isRiffWav(bytes)) return loadWav(bytes);
  if (isMpeg(bytes)) return loadMp3(bytes);
  throw new Error('Unsupported audio format');
}
