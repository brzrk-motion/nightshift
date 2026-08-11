import { McpServer } from '@modelcontextprotocol/server';

import { type QueryContext } from './query.js';
import { createTools } from './tools.js';

export const SERVER_NAME = 'nightshift-context';
export const SERVER_VERSION = '0.1.0';

const INSTRUCTIONS = [
  'A tree-sitter index of the repository, kept current as files change.',
  'Ask for the narrowest thing that answers the question: search_symbols to locate a',
  'definition, get_symbol for its exact source, file_outline before reading a file,',
  'find_references to see who uses an identifier, read_lines for a known range.',
  'Reading whole files should be the last resort, not the first move.',
].join(' ');

/**
 * Builds the MCP server. One instance per connection — `serveStdio` and
 * `createMcpHandler` both take this as a factory — while the index behind it is
 * shared and long-lived.
 */
export function createContextServer(context: QueryContext): McpServer {
  const server = new McpServer(
    { name: SERVER_NAME, version: SERVER_VERSION },
    { capabilities: { tools: {} }, instructions: INSTRUCTIONS },
  );

  for (const tool of createTools(context)) {
    server.registerTool(
      tool.name,
      {
        title: tool.title,
        description: tool.description,
        inputSchema: tool.inputSchema,
      },
      (input) => tool.handler(input),
    );
  }

  return server;
}
