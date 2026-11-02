import type { AssistantTool } from './shared';
import type { NoteElement } from '@/types/project';
import { text } from '../context';
import { anyType, bool, defineTool, str } from './shared';

const prepare = { activity: 'prepare', writes: true } as const;

export const mapTools: AssistantTool[] = [
  defineTool(
    'focus_element',
    'Zoom the map on one element once the request is applied.',
    { element_type: anyType, element_id: str },
    {
      activity: 'prepare',
      writes: false,
      run(ctx, input) {
        const { type, element } = ctx.anyElement(input.element_type, input.element_id);
        ctx.plan.effects.focus = { type, id: element.id };
        return { status: 'will_focus' };
      },
    }
  ),
  defineTool(
    'set_visibility',
    'Show or hide an element on the map.',
    { element_type: anyType, element_id: str, visible: bool },
    {
      ...prepare,
      run(ctx, input) {
        const { type, element } = ctx.anyElement(input.element_type, input.element_id);
        if (typeof input.visible !== 'boolean') throw new Error('visible must be a boolean');
        ctx.plan.visibility = ctx.plan.visibility.filter(
          (v) => !(v.type === type && v.id === element.id)
        );
        ctx.plan.visibility.push({ type, id: element.id, visible: input.visible });
        return { status: 'prepared' };
      },
    }
  ),
  defineTool(
    'set_color',
    'Change the colour of a line, circle, polygon or route. color is #rrggbb.',
    {
      element_type: { type: 'string', enum: ['lineSegment', 'circle', 'polygon', 'route'] },
      element_id: str,
      color: str,
    },
    {
      ...prepare,
      run(ctx, input) {
        if (input.element_type === 'point')
          throw new Error('Points have a fixed style in GeoChase');
        const { type, element } = ctx.anyElement(input.element_type, input.element_id);
        const color = text(input.color, 7).toLowerCase();
        if (!/^#[\da-f]{6}$/.test(color)) throw new Error('Use a #rrggbb colour');
        const { plan } = ctx;
        const prepared = [...plan.lines, ...plan.circles, ...plan.polygons, ...plan.routes].find(
          (item) => item.id === element.id
        );
        if (prepared) prepared.color = color;
        else {
          plan.styles = plan.styles.filter((s) => !(s.type === type && s.id === element.id));
          plan.styles.push({ type, id: element.id, color });
        }
        return { status: 'prepared' };
      },
    }
  ),
  defineTool(
    'add_note',
    'Attach a note to an element, or append to its existing note. Use for reasoning, clues or sources the user wants to keep.',
    { element_type: anyType, element_id: str, title: str, content: str },
    {
      ...prepare,
      run(ctx, input) {
        const { type, element } = ctx.anyElement(input.element_type, input.element_id);
        const title = text(input.title);
        const content = text(input.content, 6000);
        const { notes } = ctx.current();
        const existing = notes.find(
          (n) => n.linkedElementType === type && n.linkedElementId === element.id
        );
        if (existing && ctx.plan.notes.includes(existing)) {
          existing.content = `${existing.content}\n\n${content}`;
          return { id: existing.id, status: 'appended' };
        }
        if (existing) {
          const update = ctx.plan.noteUpdates.find((u) => u.id === existing.id);
          if (update) update.content = `${update.content}\n\n${content}`;
          else
            ctx.plan.noteUpdates.push({
              id: existing.id,
              content: `${existing.content}\n\n${content}`,
            });
          return { id: existing.id, status: 'appended' };
        }
        const note: NoteElement = {
          id: crypto.randomUUID(),
          title,
          content,
          linkedElementType: type,
          linkedElementId: element.id,
        };
        ctx.stageNote(note);
        return { id: note.id, status: 'prepared' };
      },
    }
  ),
  defineTool(
    'export_gpx',
    'Download the whole project as a GPX file once the request is applied.',
    {},
    {
      activity: 'prepare',
      writes: false,
      run(ctx) {
        ctx.plan.effects.exportGpx = true;
        return { status: 'will_export_after_apply' };
      },
    }
  ),
];
