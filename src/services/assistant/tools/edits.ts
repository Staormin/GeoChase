import type { ToolContext } from '../context';
import type { AssistantChange, AssistantPlacement, AssistantReference } from '../plan';
import type { AssistantTool } from './shared';
import { isRecord } from '@/utils/guards';
import { number, text } from '../context';
import { pointOnLine } from '../geometry';
import { LIMITS } from '../limits';
import { bool, defineTool, editableType, elementType, num, schema, str } from './shared';

const prepare = { activity: 'prepare', writes: true } as const;

function repositionPoint(ctx: ToolContext, input: Record<string, unknown>) {
  const current = ctx.point(input.point_id);
  // The manual point editor does not rebuild dependent line constructions.
  // Refuse a misleading correction until those dependencies can be recomputed.
  if (
    ctx.current().lines.some((l) => l.startPointId === current.id || l.endPointId === current.id) ||
    isPolygonVertex(ctx, current.id)
  )
    throw new Error('This point anchors another construction. Edit that construction first.');
  const position = pointOnLine(ctx.line(input.line_id), input, ctx.geometry);
  ctx.plan.placements[current.id] = {
    lineId: position.lineId,
    position: input.position as number,
    unit: input.unit as AssistantPlacement['unit'],
    fromEnd: input.from_end as boolean,
  };
  return ctx.edit(ctx.reference('point', current.id), { ...current, ...position });
}

/** Includes polygons prepared by this request, whose points carry no back-reference yet. */
const WITHOUT_EDITS = ['polygon', 'route', 'image', 'note'] as const;
function hasNoEdits(type: string): type is AssistantChange['type'] {
  return (WITHOUT_EDITS as readonly string[]).includes(type);
}

/** What stops an element from being deleted, unless it is deleted in the same call. */
function blockers(ctx: ToolContext, type: string, id: string) {
  const { points, lines, polygons } = ctx.current();
  if (type === 'point')
    return polygons
      .filter((polygon) => polygon.pointIds.includes(id))
      .map((polygon) => ({ type: 'polygon', id: polygon.id, name: polygon.name }));
  if (type === 'lineSegment')
    return [
      ...points
        .filter((point) => point.construction?.lineId === id)
        .map((point) => ({ type: 'point', id: point.id, name: point.name })),
      ...lines
        .filter((line) => line.angleFrom?.lineId === id)
        .map((line) => ({ type: 'lineSegment', id: line.id, name: line.name })),
    ];
  return [];
}

/** All or nothing: nothing is staged until every element can go. */
function deleteElements(ctx: ToolContext, input: Record<string, unknown>) {
  const { elements } = input;
  if (!Array.isArray(elements) || elements.length === 0 || elements.length > LIMITS.changes)
    throw new Error(`Provide between 1 and ${LIMITS.changes} elements`);
  const targets = elements.map((item: unknown) => {
    if (!isRecord(item)) throw new Error('Invalid element');
    return { type: String(item.element_type), id: text(item.element_id) };
  });
  const keys = new Set(targets.map(({ type, id }) => `${type}:${id}`));
  if (keys.size !== targets.length) throw new Error('Duplicate elements');
  const resolved = targets.map(({ type, id }) => {
    const ref = hasNoEdits(type)
      ? { type, id, name: ctx.anyElement(type, id).element.name }
      : ctx.reference(type, id);
    const blocker = blockers(ctx, type, id).find((item) => !keys.has(`${item.type}:${item.id}`));
    if (blocker)
      throw new Error(
        `${ref.name} is used by ${blocker.type} ${blocker.name}: include that in the list too.`
      );
    return ref;
  });
  for (const ref of resolved) {
    if (hasNoEdits(ref.type)) ctx.remove(ref as AssistantChange);
    else ctx.edit(ref as AssistantReference, null);
  }
  return { status: 'deleted', count: resolved.length };
}

function isPolygonVertex(ctx: ToolContext, pointId: string) {
  return (
    !!ctx.point(pointId).polygonIds?.length ||
    ctx.current().polygons.some((polygon) => polygon.pointIds.includes(pointId))
  );
}

function reverseOrigin(ctx: ToolContext, input: Record<string, unknown>) {
  const current = ctx.point(input.point_id);
  if (current.construction?.fraction !== undefined)
    return repositionPoint(ctx, {
      point_id: current.id,
      line_id: current.construction.lineId,
      position: current.construction.fraction,
      unit: 'fraction',
      from_end: !current.construction.fromEnd,
    });
  const candidates = [
    ctx.plan.placements[current.id],
    ...(ctx.project.recent ?? [])
      .toReversed()
      .filter((ref) => ref.id === current.id)
      .map((ref) => ref.placement),
  ];
  const placement = candidates.find((candidate) => {
    if (!candidate) return false;
    try {
      const expected = pointOnLine(
        ctx.line(candidate.lineId),
        { position: candidate.position, unit: candidate.unit, from_end: candidate.fromEnd },
        ctx.geometry
      ).coordinates;
      return (
        Math.abs(expected.lon - current.coordinates.lon) < 0.000001 &&
        Math.abs(expected.lat - current.coordinates.lat) < 0.000001
      );
    } catch {
      return false;
    }
  });
  if (placement)
    return repositionPoint(ctx, {
      point_id: current.id,
      line_id: placement.lineId,
      position: placement.position,
      unit: placement.unit,
      from_end: !placement.fromEnd,
    });
  if (current.construction?.distanceKm === undefined)
    throw new Error('No recorded position. Specify the line and fraction or distance.');
  return repositionPoint(ctx, {
    point_id: current.id,
    line_id: current.construction.lineId,
    position: current.construction.distanceKm,
    unit: 'kilometers',
    from_end: !current.construction.fromEnd,
  });
}

export const editTools: AssistantTool[] = [
  defineTool(
    'rename_element',
    'Rename an existing element, preserving its ID and geometry.',
    { element_type: elementType, element_id: str, name: str },
    {
      ...prepare,
      run(ctx, input) {
        const type = String(input.element_type);
        if (hasNoEdits(type)) {
          const { element } = ctx.anyElement(type, input.element_id);
          ctx.rename({ type, id: element.id, name: text(input.name) });
          return { id: element.id, status: 'update_prepared' };
        }
        const ref = ctx.reference(input.element_type, input.element_id);
        return ctx.edit(ref, { ...ctx.element(ref.type, ref.id), name: text(input.name) });
      },
    }
  ),
  defineTool(
    'resize_circle',
    'Correct a circle radius in kilometers. This will be previewed before applying.',
    { circle_id: str, radius_km: num },
    {
      ...prepare,
      run(ctx, input) {
        const ref = ctx.reference('circle', input.circle_id);
        return ctx.edit(ref, {
          ...ctx.circle(ref.id),
          radius: number(input.radius_km, 0.000001, 20_000),
        });
      },
    }
  ),
  defineTool(
    'reverse_point_origin',
    'Use for “from the other end / depuis l’autre extrémité”. Reverse the origin of the existing point while preserving its original fraction or distance automatically. Do not recalculate a fraction yourself. Preview before applying.',
    { point_id: str },
    { ...prepare, run: reverseOrigin }
  ),
  defineTool(
    'reposition_point_on_line',
    'Correct an existing point on a line, preserving its ID. position is a fractional number (0.5 midpoint, 0.3333333333333333 one third, never 1 for a third) or kilometers. from_end chooses the endpoint origin. Use for “from the other end” or “instead at 12 km”. Preview before applying.',
    {
      point_id: str,
      line_id: str,
      position: num,
      unit: { type: 'string', enum: ['fraction', 'kilometers'] },
      from_end: bool,
    },
    { ...prepare, run: repositionPoint }
  ),
  defineTool(
    'delete_elements',
    'Delete one or more elements in a single undo step, only those explicitly requested. Either all are deleted or none: an element still used by another one (a point of a polygon, a line with constructions) fails unless that one is in the list too. A deleted element also loses its note.',
    {
      elements: {
        type: 'array',
        items: schema({
          element_type: elementType,
          element_id: str,
        }),
      },
    },
    { activity: 'prepare', writes: true, bridgeOnly: true, run: deleteElements }
  ),
  defineTool(
    'delete_element',
    'Remove only the explicitly requested element, e.g. undo just that circle. Deletions are previewed and require user confirmation. Never delete guessed targets.',
    { element_type: editableType, element_id: str },
    {
      ...prepare,
      run(ctx, input) {
        const ref = ctx.reference(input.element_type, input.element_id);
        if (ref.type === 'point' && isPolygonVertex(ctx, ref.id))
          throw new Error('This point belongs to a polygon. Ask the user to edit the polygon.');
        if (
          ref.type === 'lineSegment' &&
          (ctx.current().points.some((p) => p.construction?.lineId === ref.id) ||
            ctx.current().lines.some((l) => l.angleFrom?.lineId === ref.id))
        )
          throw new Error('This line has dependent constructions. Remove those first.');
        return ctx.edit(ref, null);
      },
    }
  ),
  defineTool(
    'choose_elements',
    'Ask which element the user means. Supply 2–8 actual project IDs; UI shows clickable choices with map highlighting. Finish your response with the question and do not stage changes until answered.',
    {
      question: str,
      elements: {
        type: 'array',
        items: {
          type: 'object',
          properties: { element_type: editableType, element_id: str },
          required: ['element_type', 'element_id'],
          additionalProperties: false,
        },
      },
    },
    {
      activity: 'read',
      writes: false,
      run(ctx, input) {
        if (
          !Array.isArray(input.elements) ||
          input.elements.length < 2 ||
          input.elements.length > 8
        )
          throw new Error('Provide 2–8 choices');
        const elements = input.elements.map(
          (item: { element_type: unknown; element_id: unknown }) =>
            ctx.reference(item.element_type, item.element_id)
        );
        ctx.plan.choice = { question: text(input.question), elements };
        return { status: 'awaiting_user_selection' };
      },
    }
  ),
];
