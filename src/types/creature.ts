export type BodyPartType = 'core' | 'locomotion' | 'sensor' | 'feeder' | 'manipulator' | 'defense' | 'signaler';
export interface BodyPartGene { id: string; type: BodyPartType; parentId: string | null; angle: number; size: number; efficiency: number }
export type PrototypeAction = 'wander' | 'seek_food' | 'eat' | 'idle' | 'reproduce' | 'dead';
export type DeathCause = 'starvation' | 'old_age';
export interface Creature {
  id: number; speciesId: number; x: number; y: number; heading: number;
  energy: number; maxEnergy: number; health: number; age: number;
  bodyParts: BodyPartGene[]; genome: Record<string, number>; currentAction: PrototypeAction;
  parentId: number | null;
  alive: boolean; birthTick: number; lastReproductionTick: number;
  growth: number; offspringCount: number; deathCause: DeathCause | null;
  deathTick: number | null;
}
export type PrototypeCreature = Creature;
