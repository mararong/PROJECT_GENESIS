import type { WorldState } from '../types/world.ts';
/** Swap this boundary for M0's engine; React and Pixi only consume snapshots. */
export interface SimulationAdapter {
  getSnapshot():WorldState;
  step():WorldState;
  reset(seed:number):WorldState;
  selectCreature(id:number):WorldState;
  dispose():void;
}
