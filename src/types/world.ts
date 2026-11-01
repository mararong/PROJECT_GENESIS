import type { Creature } from './creature.ts';
import type { PrototypeEvent } from './event.ts';
import type { SimulationStatistics } from '../simulation/SimulationStatistics.ts';
export type TerrainKind = 'water' | 'plain' | 'forest' | 'rock';
export interface TerrainTile { kind: TerrainKind; variation: number }
export interface TerrainGrid { width: number; height: number; tiles: TerrainTile[] }
export interface FoodResource { id: number; x: number; y: number; amount: number; capacity: number }
export type MapPreset = 'balanced' | 'forest' | 'arid';
export interface WorldConfig { name: string; seed: number; preset: MapPreset; population: number; /** Legacy prototype flag; ignored by M0. */ demoReproduction: boolean }
export interface WorldState {
  config: WorldConfig; seed: number; tick: number; terrain: TerrainGrid;
  creatures: Creature[]; deceased: Record<number, Creature>; resources: FoodResource[];
  events: PrototypeEvent[]; populationHistory: { tick: number; population: number }[];
  statistics: SimulationStatistics;
}
export type PrototypeWorldSnapshot = WorldState;
