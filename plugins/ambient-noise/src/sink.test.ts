import { describe, expect, it } from 'vitest';
import { CaptureSink, DEVICE_SINK_OPTIONS, NullSink } from './sink.js';

describe('NullSink', () => {
  it('writes without opening a device and reports silent', () => {
    const sink = new NullSink();
    expect(sink.backend).toBe('silent');
    sink.write(Buffer.from([0, 0]));
    sink.close();
    expect(sink.closed).toBe(true);
  });
});

describe('CaptureSink', () => {
  it('records written PCM chunks', () => {
    const sink = new CaptureSink();
    sink.write(Buffer.from([1, 2]));
    sink.write(new Uint8Array([3, 4]));
    expect(sink.concat().equals(Buffer.from([1, 2, 3, 4]))).toBe(true);
    sink.close();
    expect(sink.closed).toBe(true);
    expect(sink.backend).toBe('silent');
  });
});

describe('DEVICE_SINK_OPTIONS', () => {
  it('requests a ring large enough to absorb timer jitter', () => {
    expect(DEVICE_SINK_OPTIONS.bufferSize).toBeGreaterThanOrEqual(250);
    expect(DEVICE_SINK_OPTIONS.sampleRate).toBe(44100);
    expect(DEVICE_SINK_OPTIONS.channels).toBe(2);
    expect(DEVICE_SINK_OPTIONS.bitDepth).toBe(16);
  });
});
