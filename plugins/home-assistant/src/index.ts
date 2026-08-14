import { argString, definePlugin, type PluginContext } from '@nightshift/sdk';
import { activateScene, checkConnection, listScenes } from './client.js';
import {
  HOME_ASSISTANT_CONNECTION_ENTITY,
  HOME_ASSISTANT_SCENES_ENTITY,
  initialConnectionState,
  initialScenesState,
  type ConnectionState,
  type ScenesState,
} from './entity.js';
import {
  CREDENTIALS_STORAGE_KEY,
  parseCredentials,
  serializeCredentials,
  type Credentials,
} from './storage.js';
import { normalizeBaseUrl, UrlValidationError } from './url.js';
import { ScenesWidget } from './widgets.js';

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export default definePlugin({
  id: 'home-assistant',
  name: 'Home Assistant',
  version: '0.1.0',
  description: 'List and activate Home Assistant scenes; bind them to vibes.',
  capabilities: [
    'entities:read',
    'entities:write',
    'widgets:register',
    'commands:register',
    'storage',
    'network',
  ],

  async setup(context: PluginContext) {
    const stored = await context.storage.get(CREDENTIALS_STORAGE_KEY).catch((error: unknown) => {
      context.log.warn('Could not read Home Assistant credentials', { error: `${error}` });
      return undefined;
    });
    let credentials = parseCredentials(stored);

    context.registerEntity(
      HOME_ASSISTANT_CONNECTION_ENTITY,
      credentials
        ? {
            configured: true,
            baseUrl: credentials.baseUrl,
            status: 'idle' as const,
            error: null,
            lastSyncedAt: null,
          }
        : initialConnectionState(),
      { title: 'Home Assistant', owner: 'home-assistant' },
    );
    context.registerEntity(HOME_ASSISTANT_SCENES_ENTITY, initialScenesState(), {
      title: 'Home Assistant scenes',
      owner: 'home-assistant',
    });

    const readConnection = (): ConnectionState =>
      context.entities.get<ConnectionState>(HOME_ASSISTANT_CONNECTION_ENTITY)?.state ??
      initialConnectionState();

    const writeConnection = (next: ConnectionState): void => {
      context.entities.set(HOME_ASSISTANT_CONNECTION_ENTITY, next);
    };

    const readScenes = (): ScenesState =>
      context.entities.get<ScenesState>(HOME_ASSISTANT_SCENES_ENTITY)?.state ??
      initialScenesState();

    const writeScenes = (next: ScenesState): void => {
      context.entities.set(HOME_ASSISTANT_SCENES_ENTITY, next);
    };

    const persistCredentials = async (next: Credentials | null): Promise<void> => {
      try {
        if (next) await context.storage.set(CREDENTIALS_STORAGE_KEY, next);
        else await context.storage.delete(CREDENTIALS_STORAGE_KEY);
      } catch (error: unknown) {
        context.log.warn('Could not save Home Assistant credentials', { error: `${error}` });
      }
    };

    const refreshScenes = async (creds: Credentials): Promise<void> => {
      writeScenes({ ...readScenes(), loading: true, error: null });
      try {
        const scenes = await listScenes(context.fetch, creds.baseUrl, creds.token);
        writeScenes({
          scenes,
          loading: false,
          error: null,
          activatingId: null,
        });
        writeConnection({
          ...readConnection(),
          status: 'connected',
          error: null,
          lastSyncedAt: Date.now(),
        });
      } catch (error: unknown) {
        const message = errorMessage(error);
        writeScenes({ ...readScenes(), loading: false, error: message });
        writeConnection({
          ...readConnection(),
          status: 'error',
          error: message,
        });
        context.log.warn('Home Assistant scene refresh failed', { error: message });
      }
    };

    const runCheckAndRefresh = async (creds: Credentials): Promise<void> => {
      writeConnection({
        configured: true,
        baseUrl: creds.baseUrl,
        status: 'connecting',
        error: null,
        lastSyncedAt: readConnection().lastSyncedAt,
      });
      try {
        await checkConnection(context.fetch, creds.baseUrl, creds.token);
        writeConnection({
          configured: true,
          baseUrl: creds.baseUrl,
          status: 'connected',
          error: null,
          lastSyncedAt: readConnection().lastSyncedAt,
        });
        await refreshScenes(creds);
      } catch (error: unknown) {
        const message = errorMessage(error);
        writeConnection({
          configured: true,
          baseUrl: creds.baseUrl,
          status: 'error',
          error: message,
          lastSyncedAt: readConnection().lastSyncedAt,
        });
        context.notify(`Home Assistant: ${message}`, {
          tone: 'warning',
          key: 'home-assistant:connection',
        });
        context.log.warn('Home Assistant connection check failed', { error: message });
      }
    };

    context.registerCommand({
      id: 'home-assistant.configure',
      title: 'Configure Home Assistant',
      run: async (args) => {
        const address = argString(args, 'address');
        const token = argString(args, 'token');
        if (!address || !token) return;

        let baseUrl: string;
        try {
          baseUrl = normalizeBaseUrl(address);
        } catch (error: unknown) {
          const message = error instanceof UrlValidationError ? error.message : errorMessage(error);
          writeConnection({
            ...readConnection(),
            status: 'error',
            error: message,
          });
          return;
        }

        const next = serializeCredentials(baseUrl, token);
        credentials = next;
        await persistCredentials(next);
        await runCheckAndRefresh(next);
      },
    });

    context.registerCommand({
      id: 'home-assistant.clear',
      title: 'Clear Home Assistant config',
      run: async () => {
        credentials = null;
        await persistCredentials(null);
        writeConnection(initialConnectionState());
        writeScenes(initialScenesState());
      },
    });

    context.registerCommand({
      id: 'home-assistant.refresh',
      title: 'Refresh Home Assistant scenes',
      run: async () => {
        if (!credentials) return;
        await refreshScenes(credentials);
      },
    });

    context.registerCommand({
      id: 'home-assistant.activate-scene',
      title: 'Activate Home Assistant scene',
      run: async (args) => {
        const entityId = argString(args, 'entity_id');
        if (!entityId) {
          context.log.warn('home-assistant.activate-scene missing entity_id');
          return;
        }
        if (!/^scene\.[a-z0-9_]+$/.test(entityId)) {
          context.log.warn('home-assistant.activate-scene invalid entity_id', { entityId });
          return;
        }
        if (!credentials) {
          context.notify('Home Assistant is not configured.', {
            tone: 'warning',
            key: 'home-assistant:activate',
          });
          return;
        }

        writeScenes({ ...readScenes(), activatingId: entityId, error: null });
        try {
          await activateScene(context.fetch, credentials.baseUrl, credentials.token, entityId);
          writeScenes({ ...readScenes(), activatingId: null });
          context.notify(`Activated ${entityId}`, {
            tone: 'success',
            key: `home-assistant:activate:${entityId}`,
          });
        } catch (error: unknown) {
          const message = errorMessage(error);
          writeScenes({ ...readScenes(), activatingId: null, error: message });
          context.notify(`Scene failed: ${message}`, {
            tone: 'danger',
            key: `home-assistant:activate:${entityId}`,
          });
          context.log.warn('Home Assistant activate-scene failed', {
            entityId,
            error: message,
          });
        }
      },
    });

    context.registerWidget({
      type: 'home-assistant.scenes',
      title: 'Home Assistant',
      entities: [HOME_ASSISTANT_CONNECTION_ENTITY, HOME_ASSISTANT_SCENES_ENTITY],
      description: 'Configure Home Assistant and activate scenes',
      render: ScenesWidget,
    });

    // Sync only while the widget is on screen — stored credentials must not
    // mean background API traffic on dashboards that never show Home Assistant.
    let widgetMounted = 0;

    context.registerCommand({
      id: 'home-assistant.widget-mounted',
      title: 'Home Assistant widget mounted',
      hidden: true,
      run: () => {
        widgetMounted += 1;
        if (widgetMounted === 1 && credentials) {
          void runCheckAndRefresh(credentials);
        }
      },
    });

    context.registerCommand({
      id: 'home-assistant.widget-unmounted',
      title: 'Home Assistant widget unmounted',
      hidden: true,
      run: () => {
        widgetMounted = Math.max(0, widgetMounted - 1);
      },
    });

    context.log.info('Home Assistant plugin ready');
  },
});

export {
  HOME_ASSISTANT_CONNECTION_ENTITY,
  HOME_ASSISTANT_SCENES_ENTITY,
  initialConnectionState,
  initialScenesState,
  type ConnectionState,
  type Scene,
  type ScenesState,
} from './entity.js';
export { normalizeBaseUrl } from './url.js';
export { scenesFromStates } from './scenes.js';
export { ScenesWidget } from './widgets.js';
