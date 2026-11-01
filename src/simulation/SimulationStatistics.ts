import type { Creature } from '../types/creature.ts';
import type { FoodResource } from '../types/world.ts';
import { BASE_TICKS_PER_SECOND } from './SimulationClock.ts';

export interface SimulationStatistics {
  population: number; totalBirths: number; totalDeaths: number; totalReproductions: number;
  averageEnergy: number; totalResources: number; timeSeconds: number;
  totalFoodConsumed: number; totalFoodRegenerated: number;
  starvationDeaths: number; oldAgeDeaths: number;
}

export function calculateStatistics(creatures: readonly Creature[], resources: readonly FoodResource[], tick: number,
  counters: Pick<SimulationStatistics, 'totalBirths' | 'totalDeaths' | 'totalReproductions'> &
    Partial<Pick<SimulationStatistics, 'totalFoodConsumed' | 'totalFoodRegenerated' | 'starvationDeaths' | 'oldAgeDeaths'>>): SimulationStatistics {
  return { totalFoodConsumed: 0, totalFoodRegenerated: 0, starvationDeaths: 0, oldAgeDeaths: 0, ...counters, population: creatures.length,
    averageEnergy: creatures.length ? creatures.reduce((sum, creature) => sum + creature.energy, 0) / creatures.length : 0,
    totalResources: resources.reduce((sum, resource) => sum + resource.amount, 0), timeSeconds: tick / BASE_TICKS_PER_SECOND };
}
