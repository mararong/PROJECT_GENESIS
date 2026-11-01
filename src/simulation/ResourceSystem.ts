import type { FoodResource, MapPreset, TerrainGrid } from '../types/world.ts';
import type { SimulationConfig } from './SimulationConfig.ts';
import { DEFAULT_SIMULATION_CONFIG } from './SimulationConfig.ts';
import { SpatialIndex, type Position } from './World.ts';

export function regenerateResources(resources: readonly FoodResource[], terrain: TerrainGrid, preset: MapPreset, config: SimulationConfig): FoodResource[] {
  const climate = preset === 'arid' ? .25 : preset === 'forest' ? 1.5 : 1;
  return resources.map(resource => {
    const fertility = terrain.tiles[Math.floor(resource.y) * terrain.width + Math.floor(resource.x)]?.kind === 'forest' ? 1.4 : 1;
    // A persistent root allows even a fully depleted patch to regrow; finite capacity.
    const growth = config.resourceRegen * climate * fertility * (.2 + .8 * (1 - resource.amount / resource.capacity));
    return { ...resource, amount: Math.max(0, Math.min(resource.capacity, resource.amount + growth)) };
  });
}

export class ResourceSystem {
  private index: SpatialIndex<FoodResource>;
  private minimumAmount: number;
  constructor(resources: FoodResource[], minimumAmount = DEFAULT_SIMULATION_CONFIG.minimumFoodAmount) { this.index = new SpatialIndex(8, resources); this.minimumAmount = minimumAmount; }
  nearest(position: Position, radius: number): FoodResource | undefined {
    let closest: FoodResource | undefined, distance = radius;
    for (const resource of this.index.near(position, radius)) {
      if (resource.amount < this.minimumAmount) continue;
      const d = Math.hypot(resource.x - position.x, resource.y - position.y);
      if (d < distance || (d === distance && (!closest || resource.id < closest.id))) { closest = resource; distance = d; }
    }
    return closest;
  }
}
