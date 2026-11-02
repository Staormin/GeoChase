import type { AssistantTool, ToolActivity } from './shared';
import { analysisTools } from './analysis';
import { constructionTools } from './constructions';
import { editTools } from './edits';
import { mapTools } from './map';
import { overlayTools } from './overlays';
import { placeTools } from './places';

export { projectSummary } from './places';
export type { AssistantTool, ToolActivity } from './shared';

/** Every tool the model can call, in the order it is offered. */
export const assistantTools: AssistantTool[] = [
  ...placeTools,
  ...constructionTools,
  ...editTools,
  ...analysisTools,
  ...mapTools,
  ...overlayTools,
];

const byName = new Map(assistantTools.map((tool) => [tool.definition.name, tool]));

export function findTool(name: string): AssistantTool | undefined {
  return byName.get(name);
}

export function toolActivity(name: string): ToolActivity {
  return byName.get(name)?.activity ?? 'prepare';
}
