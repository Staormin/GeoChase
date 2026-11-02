import type { ToolContext } from '../context';
import type { AITool } from '../providers';

/** Status shown while a tool runs; each value has an `assistant.activity*` translation. */
export type ToolActivity =
  'read' | 'prepare' | 'search' | 'research' | 'elevation' | 'route' | 'osm' | 'photos' | 'overlay';

export interface AssistantTool {
  definition: AITool;
  activity: ToolActivity;
  /** Stages project changes, so it counts against the change limit. */
  writes: boolean;
  run: (ctx: ToolContext, input: Record<string, unknown>) => unknown;
}

export const str = { type: 'string' };
export const num = { type: 'number' };
export const bool = { type: 'boolean' };
export const ids = { type: 'array', items: str };
export const editableType = { type: 'string', enum: ['point', 'lineSegment', 'circle'] };
export const anyType = {
  type: 'string',
  enum: ['point', 'lineSegment', 'circle', 'polygon', 'route'],
};

/** Strict schema: every property is required and nothing else is accepted. */
export function schema(properties: Record<string, unknown>) {
  return {
    type: 'object',
    properties,
    required: Object.keys(properties),
    additionalProperties: false,
  };
}

export function defineTool(
  name: string,
  description: string,
  properties: Record<string, unknown>,
  options: Omit<AssistantTool, 'definition'>
): AssistantTool {
  return { definition: { name, description, parameters: schema(properties) }, ...options };
}
