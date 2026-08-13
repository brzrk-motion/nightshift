import { type ReactNode } from 'react';
import {
  ActivityWaveform,
  Button,
  EmptyState,
  ErrorState,
  IconButton,
  Toolbar,
  useCommands,
  useEntity,
  useTheme,
  type WidgetProps,
} from '@nightshift/sdk';
import {
  PLAYER_ENTITY,
  type PlayerState,
  initialPlayerState,
  isTransportActive,
} from './entity.js';
import { resolveLayout, useCompactSkipGlyphs } from './scale.js';

const PREVIOUS_GLYPH = '◀◀';
const NEXT_GLYPH = '▶▶';
const COMPACT_PREVIOUS_GLYPH = '«';
const COMPACT_NEXT_GLYPH = '»';
const PLAY_GLYPH = '▶';
const PAUSE_GLYPH = '▮';

function clip(text: string, max: number): string {
  if (max <= 0) return '';
  if (text.length <= max) return text;
  if (max === 1) return '…';
  return `${text.slice(0, max - 1)}…`;
}

export function PlayerWidget({ width, height }: WidgetProps): ReactNode {
  const theme = useTheme();
  const commands = useCommands();
  const entity = useEntity<PlayerState>(PLAYER_ENTITY);
  const state = entity?.state ?? initialPlayerState();
  const layout = resolveLayout(width, height);
  const compact = layout === 'compact';
  const skipGlyphs = useCompactSkipGlyphs(width, layout);
  const playing = isTransportActive(state.status);

  if (state.status === 'empty') {
    return (
      <EmptyState
        message="No ambient clips"
        hint="Add WAV or MP3 files to test-audio and list them in clips.json."
      />
    );
  }

  if (state.status === 'unavailable' && !state.currentName) {
    return (
      <ErrorState
        message="Clips unavailable"
        hint={state.error ?? 'Check the bundled audio files.'}
      />
    );
  }

  const prevGlyph = skipGlyphs ? COMPACT_PREVIOUS_GLYPH : PREVIOUS_GLYPH;
  const nextGlyph = skipGlyphs ? COMPACT_NEXT_GLYPH : NEXT_GLYPH;
  const nameWidth = Math.max(8, width - 8);

  return (
    <box
      style={{
        flexDirection: 'column',
        flexGrow: 1,
        overflow: 'hidden',
        gap: compact ? 0 : 1,
        paddingLeft: 1,
        paddingRight: 1,
      }}
    >
      <text fg={playing ? theme.colors.accent : theme.colors.text}>
        {clip(state.currentName || 'Ambient', nameWidth)}
      </text>
      {state.status === 'loading' ? (
        <text fg={theme.colors.muted}>{clip('Loading…', nameWidth)}</text>
      ) : state.error ? (
        <text fg={theme.colors.muted}>{clip(state.error, nameWidth)}</text>
      ) : null}
      {state.output !== 'device' && state.outputMessage ? (
        <text fg={theme.colors.muted}>{clip(state.outputMessage, nameWidth)}</text>
      ) : null}
      {layout === 'wide' && playing && state.levels.length > 0 ? (
        <ActivityWaveform values={state.levels} width={Math.max(8, width - 6)} />
      ) : null}
      <box style={{ flexGrow: 1 }} />
      <box style={{ flexDirection: 'row', gap: 1, alignItems: 'center', flexShrink: 0 }}>
        {compact ? (
          <Toolbar>
            {playing ? (
              <IconButton
                icon={PAUSE_GLYPH}
                onPress={() => void commands.run('ambient-noise.pause')}
              />
            ) : (
              <IconButton
                icon={PLAY_GLYPH}
                onPress={() => void commands.run('ambient-noise.play')}
              />
            )}
          </Toolbar>
        ) : (
          <>
            <Button label={prevGlyph} onPress={() => void commands.run('ambient-noise.previous')} />
            {playing ? (
              <Button
                label={PAUSE_GLYPH}
                primary
                onPress={() => void commands.run('ambient-noise.pause')}
              />
            ) : (
              <Button
                label={PLAY_GLYPH}
                primary
                onPress={() => void commands.run('ambient-noise.play')}
              />
            )}
            <Button label={nextGlyph} onPress={() => void commands.run('ambient-noise.next')} />
          </>
        )}
      </box>
    </box>
  );
}
