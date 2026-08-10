import { NightshiftError, type Unsubscribe } from '@nightshift/core';
import type { EntityId } from '@nightshift/entities';
import type { PluginWidget, WidgetComponent } from '@nightshift/sdk';

/**
 * The widget registry: the lookup from a `type` in a dashboard file to
 * something that can draw it. Plugins fill it through the SDK, and the
 * dashboard renderer is the only thing that reads it — so a widget type is the
 * whole contract between the two.
 */
export interface WidgetDefinition {
  type: string;
  title: string;
  /** Entities the widget reads. Used to document it and to prefetch. */
  entities: readonly EntityId[];
  description?: string;
  render: WidgetComponent;
  /** Plugin that contributed it; absent for built-ins. */
  source?: string;
}

export interface WidgetRegistry {
  register(definition: WidgetDefinition): Unsubscribe;
  /** Adds every widget a plugin declared through the SDK. */
  registerPlugin(pluginId: string, widgets: readonly PluginWidget[]): Unsubscribe;
  get(type: string): WidgetDefinition | undefined;
  has(type: string): boolean;
  list(): WidgetDefinition[];
  /** Types referenced by a dashboard that nothing has registered. */
  missing(types: readonly string[]): string[];
}

export function createWidgetRegistry(initial: readonly WidgetDefinition[] = []): WidgetRegistry {
  const widgets = new Map<string, WidgetDefinition>();

  const registry: WidgetRegistry = {
    register(definition) {
      if (definition.type.trim() === '') {
        throw new NightshiftError('CONFIG_INVALID', 'A widget needs a type.');
      }
      widgets.set(definition.type, definition);
      return () => void widgets.delete(definition.type);
    },

    registerPlugin(pluginId, pluginWidgets) {
      const disposers = pluginWidgets
        // A widget with nothing to draw would only ever render a placeholder,
        // so it is skipped rather than registered.
        .filter((widget) => typeof widget.render === 'function')
        .map((widget) =>
          registry.register({
            type: widget.type,
            title: widget.title,
            entities: widget.entities,
            render: widget.render as WidgetComponent,
            source: pluginId,
            ...(widget.description === undefined ? {} : { description: widget.description }),
          }),
        );

      return () => {
        for (const dispose of disposers) dispose();
      };
    },

    get: (type) => widgets.get(type),
    has: (type) => widgets.has(type),
    list: () => [...widgets.values()].sort((a, b) => a.type.localeCompare(b.type)),
    missing: (types) => [...new Set(types)].filter((type) => !widgets.has(type)).sort(),
  };

  for (const definition of initial) registry.register(definition);
  return registry;
}
