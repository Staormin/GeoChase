import type { AssistantPlan, AssistantReference } from './plan';
import type { AITool } from './providers';
import { createdElements, planSize } from './plan';
import { imagesOf } from './providers';
import { assistantTools } from './tools';
import { PROJECT_PDF } from './tools/overlays';
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
/** Bridge-only tools: walk the project history. */
export const UNDO = 'undo';
export const REDO = 'redo';

// research_places needs the in-app provider key; Claude has its own web search.
// choose_elements drives the in-app clarification UI; Claude asks in its own chat.
// delete_element is covered by delete_elements.
const IN_APP_ONLY = new Set(['research_places', 'choose_elements', 'delete_element']);

// The tools are written for the chat, which previews a request and applies it at the end.
// Here each call applies at once, and only the project PDF can be a document.
const CHAT_WORDING: [string | RegExp, string][] = [
  [' Preview before applying.', ''],
  [' This is previewed before applying.', ''],
  [' This will be previewed before applying.', ''],
  [' Changes apply after successful completion.', ''],
  [' once the request is applied', ''],
  [/existing or prepared/g, 'existing'],
  [/^Prepare a /, 'Create a '],
  ['Compute and prepare', 'Compute and create'],
  ['Prepare ALL requested points together', 'Create all requested points in one call'],
  [
    'source_urls must be URLs from research_places, or [] for simple place requests.',
    'source_urls are pages backing the place, saved as a note, or [] for simple place requests.',
  ],
  [`an attached image or PDF (by its name) or the "${PROJECT_PDF}"`, `the "${PROJECT_PDF}"`],
  [', e.g. with an attached image', ''],
];
const LOCATION_IDS =
  ' A location ID stops working when the GeoChase page reloads: search again if it is refused.';

function forClaude({ name, description, parameters }: AITool): AITool {
  const reworded = CHAT_WORDING.reduce((text, [from, to]) => text.replace(from, to), description);
  return {
    name,
    parameters,
    description: name === 'search_places' ? reworded + LOCATION_IDS : reworded,
  };
}

/** Tools report what they staged for the chat; on the bridge it is already done. */
const DONE_STATUS: Record<string, string> = {
  prepared: 'created',
  prepared_provisionally: 'created',
  update_prepared: 'updated',
  deletion_prepared: 'deleted',
  placement_prepared: 'placed',
  will_focus: 'focused',
  will_export_after_apply: 'exported',
};

/** The tools Claude gets: the assistant's own, so both stay in step. */
export function bridgeTools(): AITool[] {
  return [
    ...assistantTools
      .filter((tool) => !IN_APP_ONLY.has(tool.definition.name))
      .map((tool) => forClaude(tool.definition)),
    {
      name: CAPTURE_MAP,
      description:
        'Capture the map as currently displayed in GeoChase (JPEG) with its bounds and zoom, to see the basemap and drawn elements.',
      parameters: schema({ reason: str }),
    },
    {
      name: UNDO,
      description:
        'Undo the latest step of the project history, as the Undo button does: one earlier tool call, or the last edit the user made by hand.',
      parameters: schema({}),
    },
    {
      name: REDO,
      description: 'Restore the step that undo just reverted, as the Redo button does.',
      parameters: schema({}),
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
      ...plan.renames,
      ...refs('image', plan.imageEdits),
    ],
    deleted: [
      ...edits.filter((edit) => !edit.after).map(({ type, id, name }) => ({ type, id, name })),
      ...plan.removals,
    ],
    ...Object.fromEntries(Object.entries(counts).filter(([, count]) => count > 0)),
  };
}

/** Tool output plus what was written to the map, as Claude reads it. */
export function bridgeResult(id: string, output: unknown, plan?: AssistantPlan): BridgeResult {
  const applied = plan && planSize(plan) > 0 ? appliedChanges(plan) : undefined;
  const text = JSON.stringify(
    applied
      ? { result: output, applied_to_map: applied, note: 'Applied as one undo step.' }
      : output,
    (key, value) => (key === 'status' && DONE_STATUS[value as string]) || value
  );
  const images = imagesOf(output).map(({ mimeType, data }) => ({ mimeType, data }));
  return { type: 'result', id, isError: false, text, images };
}
export function bridgeError(id: string, message: string): BridgeResult {
  return { type: 'result', id, isError: true, text: message, images: [] };
}
