import { useEffect, useState, type ReactNode } from 'react';
import {
  Button,
  EmptyState,
  ErrorState,
  LoadingState,
  TextInput,
  useCommands,
  useEntity,
  useTheme,
  type WidgetProps,
} from '@nightshift/sdk';
import {
  HOME_ASSISTANT_CONNECTION_ENTITY,
  HOME_ASSISTANT_SCENES_ENTITY,
  initialConnectionState,
  initialScenesState,
  type ConnectionState,
  type ScenesState,
} from './entity.js';

function ConfigureForm({
  error,
  initialAddress,
}: {
  error?: string | null;
  initialAddress?: string | null;
}): ReactNode {
  const theme = useTheme();
  const commands = useCommands();
  const [address, setAddress] = useState(initialAddress ?? '');
  const [token, setToken] = useState('');
  const [focusToken, setFocusToken] = useState(false);

  const save = (): void => {
    const a = address.trim();
    const t = token.trim();
    if (a === '' || t === '') return;
    void commands.run('home-assistant.configure', { address: a, token: t });
  };

  return (
    <box
      style={{
        flexDirection: 'column',
        flexGrow: 1,
        gap: 1,
        paddingLeft: 1,
        paddingRight: 1,
      }}
    >
      <text fg={theme.colors.muted}>
        Enter your Home Assistant address (IP or URL) and a long-lived access token.
      </text>
      {error ? <text fg={theme.colors.danger}>{error}</text> : null}
      <box style={{ flexDirection: 'row', gap: 1, alignItems: 'center' }}>
        <text fg={theme.colors.muted}>Address</text>
        <TextInput
          value={address}
          onInput={setAddress}
          onSubmit={() => setFocusToken(true)}
          focused={!focusToken}
          placeholder="192.168.1.10 or https://…"
        />
      </box>
      <box style={{ flexDirection: 'row', gap: 1, alignItems: 'center' }}>
        <text fg={theme.colors.muted}>Token</text>
        <TextInput
          value={token}
          onInput={setToken}
          onSubmit={save}
          focused={focusToken}
          placeholder="Long-lived access token"
        />
        <Button label="Save" onPress={save} />
      </box>
    </box>
  );
}

function SceneList({
  connection,
  scenes,
}: {
  connection: ConnectionState;
  scenes: ScenesState;
}): ReactNode {
  const theme = useTheme();
  const commands = useCommands();
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <box style={{ flexDirection: 'column', flexGrow: 1, gap: 1 }}>
        <ConfigureForm error={connection.error} initialAddress={connection.baseUrl} />
        <box style={{ flexDirection: 'row', gap: 1, paddingLeft: 1 }}>
          <Button label="Cancel" onPress={() => setEditing(false)} />
          <Button
            label="Clear"
            onPress={() => {
              void commands.run('home-assistant.clear');
              setEditing(false);
            }}
          />
        </box>
      </box>
    );
  }

  return (
    <box
      style={{
        flexDirection: 'column',
        flexGrow: 1,
        gap: 1,
        paddingLeft: 1,
        paddingRight: 1,
      }}
    >
      <box style={{ flexDirection: 'row', gap: 1, alignItems: 'center' }}>
        <text fg={theme.colors.muted}>{connection.baseUrl ?? 'Home Assistant'}</text>
        <text
          fg={
            connection.status === 'connected'
              ? theme.colors.success
              : connection.status === 'error'
                ? theme.colors.danger
                : theme.colors.muted
          }
        >
          {connection.status}
        </text>
        <Button label="Refresh" onPress={() => void commands.run('home-assistant.refresh')} />
        <Button label="Edit" onPress={() => setEditing(true)} />
      </box>

      {connection.status === 'connecting' || scenes.loading ? (
        <LoadingState message="Loading scenes…" />
      ) : null}

      {scenes.error && !scenes.loading ? (
        <ErrorState message={scenes.error} />
      ) : null}

      {!scenes.loading && scenes.scenes.length === 0 && !scenes.error ? (
        <EmptyState message="No scenes found on this Home Assistant." />
      ) : null}

      <scrollbox style={{ flexGrow: 1 }}>
        {scenes.scenes.map((scene) => {
          const busy = scenes.activatingId === scene.entityId;
          return (
            <box
              key={scene.entityId}
              style={{ flexDirection: 'row', gap: 1, alignItems: 'center' }}
            >
              <text fg={theme.colors.text}>{scene.name}</text>
              <text fg={theme.colors.muted}>{scene.entityId}</text>
              <Button
                label={busy ? '…' : 'Activate'}
                onPress={() =>
                  void commands.run('home-assistant.activate-scene', {
                    entity_id: scene.entityId,
                  })
                }
              />
            </box>
          );
        })}
      </scrollbox>
    </box>
  );
}

export function ScenesWidget(_props: WidgetProps): ReactNode {
  const commands = useCommands();
  const connection =
    useEntity<ConnectionState>(HOME_ASSISTANT_CONNECTION_ENTITY)?.state ??
    initialConnectionState();
  const scenes =
    useEntity<ScenesState>(HOME_ASSISTANT_SCENES_ENTITY)?.state ?? initialScenesState();

  useEffect(() => {
    void commands.run('home-assistant.widget-mounted');
    return () => {
      void commands.run('home-assistant.widget-unmounted');
    };
  }, [commands]);

  if (!connection.configured) {
    return <ConfigureForm error={connection.error} />;
  }

  return <SceneList connection={connection} scenes={scenes} />;
}
