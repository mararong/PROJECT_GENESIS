import type { PrototypeEvent, EventKind } from '../types/event.ts';
import type { Creature } from '../types/creature.ts';

export class SimulationEvents {
  private sequence = 0;
  create(tick: number, kind: EventKind, creature: Creature | null, message: string): PrototypeEvent {
    return { id: `m0-${this.sequence++}`, tick, kind, creatureId: creature?.id ?? null, message, x: creature?.x, y: creature?.y };
  }
}

export function retainEvents(before: readonly PrototypeEvent[], added: readonly PrototypeEvent[], limit: number): PrototypeEvent[] {
  return [...before, ...added].slice(-limit);
}
