import type { EventKind, PrototypeEvent } from '../../types/event';

export type TimelineFilter = 'important' | 'all' | EventKind;
export interface TimelineGroup {
  id: string;
  kind: EventKind;
  firstTick: number;
  lastTick: number;
  events: PrototypeEvent[];
  label: string;
  order: number;
}

const IMPORTANT_KINDS = new Set<EventKind>(['birth', 'death', 'extinction', 'reproduction', 'resource_low', 'resource_recovered']);
const GROUP_TICKS = 100;

/** Presentation-only summaries. Every member is the original model event. */
export function summarizeTimeline(events: readonly PrototypeEvent[], filter: TimelineFilter): TimelineGroup[] {
  const groups = new Map<string, TimelineGroup>();
  events.forEach((event, order) => {
    if (filter === 'important' ? !IMPORTANT_KINDS.has(event.kind) : filter !== 'all' && event.kind !== filter) return;
    const initial = event.kind === 'birth' && event.tick === 0;
    const id = event.kind === 'extinction' ? event.id : initial ? 'initial-placement' : event.kind + ':' + Math.floor(event.tick / GROUP_TICKS);
    let group = groups.get(id);
    if (!group) {
      group = { id, kind: event.kind, firstTick: event.tick, lastTick: event.tick, events: [], label: '', order };
      groups.set(id, group);
    }
    group.events.push(event);
    group.firstTick = Math.min(group.firstTick, event.tick);
    group.lastTick = Math.max(group.lastTick, event.tick);
    group.order = order;
  });
  return [...groups.values()].map(group => {
    const count = group.events.length;
    const organisms = new Set(group.events.flatMap(e => e.creatureId === null ? [] : [e.creatureId])).size;
    if (group.id === 'initial-placement') group.label = '초기 배치 · ' + organisms + '개체';
    else if (count === 1) group.label = group.events[0].message;
    else if (group.kind === 'eat') group.label = '먹이 섭취 ' + count + '회 · ' + organisms + '개체';
    else if (group.kind === 'selection') group.label = '개체 선택 ' + count + '회';
    else if (group.kind === 'death') group.label = organisms + '개체 사망';
    else if (group.kind === 'birth') group.label = (group.events.some(e => e.message.includes('데모 번식')) ? '데모 번식 · ' : '') + organisms + '개체 탄생';
    else if (group.kind === 'reproduction') group.label = count + '회 번식 · ' + organisms + '개체';
    else if (group.kind === 'resource_low') group.label = '먹이 자원 부족 · ' + count + '회';
    else if (group.kind === 'resource_recovered') group.label = '먹이 자원 회복 · ' + count + '회';
    return group;
  }).sort((a, b) => b.lastTick - a.lastTick || b.order - a.order);
}

export function formatEventTicks(group: TimelineGroup): string {
  const start = 'T' + String(group.firstTick).padStart(5, '0');
  return group.firstTick === group.lastTick ? start : start + '–' + String(group.lastTick).padStart(5, '0');
}
