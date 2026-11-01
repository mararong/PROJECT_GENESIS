import type { Creature } from '../types/creature.ts';
import type { TerrainGrid } from '../types/world.ts';
import type { SimulationConfig } from './SimulationConfig.ts';
import { canTraverse, SpatialIndex, type Position } from './World.ts';

export function canReproduce(creature: Creature, tick: number, config: SimulationConfig): boolean {
  return creature.alive && creature.age >= config.reproductionAge && creature.energy >= config.reproductionEnergy &&
    creature.energy > config.reproductionCost && tick - creature.lastReproductionTick >= config.reproductionCooldown;
}

export function findBirthPosition(parent: Creature, terrain: TerrainGrid, occupied: SpatialIndex<Creature>, config: SimulationConfig, random: () => number): Position | null {
  const start = random() * Math.PI * 2;
  for (let i = 0; i < 12; i++) {
    const angle = start + i * Math.PI / 6;
    const point = { x: parent.x + Math.cos(angle) * config.spawnDistance, y: parent.y + Math.sin(angle) * config.spawnDistance };
    if (canTraverse(terrain, parent, point) && !occupied.near(point, config.spawnClearance).next().value) return point;
  }
  return null;
}

export function reproduce(parent: Creature, position: Position, id: number, tick: number, config: SimulationConfig): Creature {
  parent.energy -= config.reproductionCost;
  parent.lastReproductionTick = tick;
  parent.offspringCount++;
  return { ...parent, ...position, id, parentId: parent.id, birthTick: tick, age: 0, growth: .55,
    energy: config.newbornEnergy, health: 100 * config.newbornEnergy / parent.maxEnergy,
    currentAction: 'idle', lastReproductionTick: tick, offspringCount: 0, alive: true, deathCause: null, deathTick: null,
    bodyParts: parent.bodyParts.map(part => ({ ...part })), genome: { ...parent.genome } };
}
