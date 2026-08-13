import { describe, expect, it } from 'vitest';
import { CaptureSink, NullSink } from './sink.js';

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
