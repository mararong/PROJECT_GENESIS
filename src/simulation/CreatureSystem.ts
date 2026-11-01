import type { Creature, DeathCause } from '../types/creature.ts';
import type { TerrainGrid } from '../types/world.ts';
import type { SimulationConfig } from './SimulationConfig.ts';
import type { BehaviorDecision } from './BehaviorSystem.ts';
import { canTraverse } from './World.ts';

export function updateAge(creature: Creature, config: SimulationConfig) {
  creature.age++;
  creature.growth = Math.min(1, .55 + .45 * creature.age / config.maturityAge);
}

export function deathCause(creature: Creature, config: SimulationConfig): DeathCause | null {
  return creature.energy <= 0 ? 'starvation' : creature.age >= config.maxAge ? 'old_age' : null;
}

export function moveCreature(creature: Creature, decision: BehaviorDecision, terrain: TerrainGrid, random: () => number): number {
  if (decision.action !== 'wander' && decision.action !== 'seek_food') return 0;
  if (decision.target) creature.heading = Math.atan2(decision.target.y - creature.y, decision.target.x - creature.x);
  else if (random() < .12) creature.heading += (random() - .5) * 1.8;
  const distance = Math.min(creature.genome.moveSpeed * (.65 + .35 * creature.growth),
    decision.target ? Math.hypot(decision.target.x - creature.x, decision.target.y - creature.y) : Infinity);
  const side = creature.id % 2 ? 1 : -1;
  for (const offset of [0, side * Math.PI / 4, -side * Math.PI / 4, side * Math.PI / 2, -side * Math.PI / 2, Math.PI]) {
    const heading = creature.heading + offset;
    const next = { x: creature.x + Math.cos(heading) * distance, y: creature.y + Math.sin(heading) * distance };
    if (canTraverse(terrain, creature, next)) { creature.x = next.x; creature.y = next.y; creature.heading = heading; return distance; }
  }
  creature.heading += Math.PI * .5;
  return 0;
}
