import type { AssistantPlan, AssistantReference } from './plan';
import type { AITool } from './providers';
import { createdElements, planSize } from './plan';
import { imagesOf } from './providers';
import { assistantTools } from './tools';
import { schema, str } from './tools/shared';

/**
 * Link between this tab and the local GeoChase MCP server (mcp/src/server.ts), which
 * forwards Claude's tool calls here. Messages are JSON:
 *   tab → server  hello { tools, project }      on connection and when the project changes
 *   server → tab  call { id, name, input }      one tool call
 *   server → tab  cancel { id }                 Claude abandoned the call
 *   tab → server  result { id, isError, text, images }
 */
export const BRIDGE_URL = 'ws://127.0.0.1:47777';
export const BRIDGE_PROTOCOL = 'geochase-bridge.v1';

export interface BridgeCall {
  type: 'call';
  id: string;
  name: string;
  input: unknown;
}
export interface BridgeResult {
  type: 'result';
  id: string;
  isError: boolean;
  text: string;
  images: { mimeType: string; data: string }[];
}

/** Bridge-only tool: Claude has no other way to see the map. */
export const CAPTURE_MAP = 'capture_map';

// research_places needs the in-app provider key; Claude has its own web search.
// choose_elements drives the in-app clarification UI; Claude asks in its own chat.
const IN_APP_ONLY = new Set(['research_places', 'choose_elements']);

/** The tools Claude gets: the assistant's own, so both stay in step. */
export function bridgeTools(): AITool[] {
  return [
    ...assistantTools
      .map((tool) => tool.definition)
      .filter((definition) => !IN_APP_ONLY.has(definition.name)),
    {
      name: CAPTURE_MAP,
      description:
        'Capture the map as currently displayed in GeoChase (JPEG) with its bounds and zoom, to see the basemap and drawn elements.',
      parameters: schema({ reason: str }),
    },
  ];
}
export function isBridgeTool(name: string): boolean {
  return bridgeTools().some((tool) => tool.name === name);
}

/** Each element once, at its latest position, newest last. */
export function uniqueReferences(list: AssistantReference[], limit = 20): AssistantReference[] {
  const latest = new Map<string, AssistantReference>();
  for (const ref of list) {
    const key = `${ref.type}:${ref.id}`;
    latest.delete(key);
    latest.set(key, ref);
  }
  return [...latest.values()].slice(-limit);
}

function refs(type: string, list: { id: string; name: string }[]) {
  return list.map(({ id, name }) => ({ type, id, name }));
}

/** Everything a call wrote, since its own output only says "prepared". */
export function appliedChanges(plan: AssistantPlan) {
  const created = createdElements(plan);
  const createdIds = new Set(Object.values(created).flatMap((list) => list.map((e) => e.id)));
  const edits = plan.edits.filter((edit) => !createdIds.has(edit.id));
  const counts = {
    notes_added: plan.notes.length,
    notes_updated: plan.noteUpdates.length,
    colors_changed: plan.styles.length,
    visibility_changed: plan.visibility.length,
  };
  return {
    created: [
      ...refs('point', created.points),
      ...refs('lineSegment', created.lines),
      ...refs('circle', created.circles),
      ...refs('polygon', created.polygons),
      ...refs('route', created.routes),
      ...refs('image', created.images),
    ],
    updated: [
      ...edits.flatMap(({ type, id, after }) => (after ? [{ type, id, name: after.name }] : [])),
      ...refs('image', plan.imageEdits),
    ],
    deleted: edits.filter((edit) => !edit.after).map(({ type, id, name }) => ({ type, id, name })),
    ...Object.fromEntries(Object.entries(counts).filter(([, count]) => count > 0)),
  };
}

/** Tool output plus what was written to the map, as Claude reads it. */
export function bridgeResult(id: string, output: unknown, plan?: AssistantPlan): BridgeResult {
  const applied = plan && planSize(plan) > 0 ? appliedChanges(plan) : undefined;
  const text = JSON.stringify(
    applied
      ? { result: output, applied_to_map: applied, note: 'Applied as one undo step.' }
      : output
  );
  const images = imagesOf(output).map(({ mimeType, data }) => ({ mimeType, data }));
  return { type: 'result', id, isError: false, text, images };
}
export function bridgeError(id: string, message: string): BridgeResult {
  return { type: 'result', id, isError: true, text: message, images: [] };
}
