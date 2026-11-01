import type { Creature, PrototypeAction } from '../types/creature.ts';
import type { FoodResource } from '../types/world.ts';
import type { SimulationConfig } from './SimulationConfig.ts';
import type { ResourceSystem } from './ResourceSystem.ts';

export interface BehaviorContext { creature: Readonly<Creature>; resources: ResourceSystem; config: Readonly<SimulationConfig>; tick: number; canReproduce: boolean }
export interface BehaviorDecision { action: Exclude<PrototypeAction, 'dead'>; target?: FoodResource }
/** M2 can replace this policy without depending on React, Pixi or the clock. */
export interface BehaviorPolicy { decide(context: BehaviorContext): BehaviorDecision }

export class RuleBasedBehavior implements BehaviorPolicy {
  decide({ creature, resources, config, canReproduce }: BehaviorContext): BehaviorDecision {
    if (canReproduce) return { action: 'reproduce' };
    const ratio = creature.energy / creature.maxEnergy;
    if (ratio >= config.restThreshold || (creature.currentAction === 'idle' && ratio >= config.restUntil)) return { action: 'idle' };
    const target = resources.nearest(creature, creature.genome.senseRadius);
    if (!target) return { action: 'wander' };
    return { action: Math.hypot(target.x - creature.x, target.y - creature.y) <= config.eatingRadius ? 'eat' : 'seek_food', target };
  }
}
