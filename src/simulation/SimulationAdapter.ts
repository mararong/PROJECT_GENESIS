import type { WorldState } from '../types/world.ts';
/** UI boundary: React and Pixi consume snapshots; policies and physics live in the engine. */
export interface SimulationAdapter {
  getSnapshot():WorldState;
  step():WorldState;
  reset(seed:number):WorldState;
  selectCreature(id:number):WorldState;
  dispose():void;
}
