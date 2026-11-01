import type { Creature } from '../types/creature.ts';
import type { FoodResource } from '../types/world.ts';
import type { SimulationConfig } from './SimulationConfig.ts';

export function spendEnergy(creature: Creature, distance: number, config: SimulationConfig) {
  const growthCost = .7 + .3 * creature.growth;
  creature.energy = Math.max(0, Math.min(creature.maxEnergy,
    creature.energy - creature.genome.metabolism * config.basalCostMultiplier * growthCost - distance * config.movementCost));
}

export function eat(creature: Creature, resource: FoodResource, config: SimulationConfig): number {
  const consumed = Math.max(0, Math.min(resource.amount, config.biteSize, (creature.maxEnergy - creature.energy) / config.energyPerFood));
  resource.amount = Math.max(0, resource.amount - consumed);
  creature.energy = Math.min(creature.maxEnergy, creature.energy + consumed * config.energyPerFood);
  return consumed;
}
