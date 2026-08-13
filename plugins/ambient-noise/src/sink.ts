export interface AudioSink {
  write(chunk: Buffer | Uint8Array): Promise<void> | void;
  close(): void;
  readonly backend: 'device' | 'silent' | 'error';
}

export class NullSink implements AudioSink {
  readonly backend = 'silent' as const;
  closed = false;

  write(_chunk: Buffer | Uint8Array): void {
    // Timing is the mixer's job; the null sink just discards PCM.
  }

  close(): void {
    this.closed = true;
  }
}

export class CaptureSink implements AudioSink {
  readonly backend = 'silent' as const;
  readonly chunks: Buffer[] = [];
  closed = false;

  write(chunk: Buffer | Uint8Array): void {
    this.chunks.push(Buffer.from(chunk));
  }

  close(): void {
    this.closed = true;
  }

  concat(): Buffer {
    return Buffer.concat(this.chunks);
  }
}

type SpeakerWrite = ((
  chunk: Buffer | Uint8Array | null,
  cb?: (err?: Error | null) => void,
) => void) & {
  close?: () => void;
  backend?: string;
};

export async function createDeviceSink(): Promise<AudioSink> {
  try {
    const mod = (await import('@audio/speaker')) as { default?: (opts: object) => SpeakerWrite };
    const speaker = mod.default;
    if (typeof speaker !== 'function') return new NullSink();
    const write = speaker({ sampleRate: 44100, channels: 2, bitDepth: 16 });
    const kind = write.backend === 'null' || write.backend === 'silent' ? 'silent' : 'device';
    return {
      backend: kind,
      write(chunk) {
        return new Promise<void>((resolve, reject) => {
          write(chunk, (err) => {
            if (err) reject(err);
            else resolve();
          });
        });
      },
      close() {
        try {
          write.close?.();
          write(null);
        } catch {
          // Device already gone.
        }
      },
    };
  } catch {
    return new NullSink();
  }
}
