export type BodyPartType = 'core' | 'locomotion' | 'sensor' | 'feeder' | 'manipulator' | 'defense' | 'signaler';
export interface BodyPartGene { id: string; type: BodyPartType; parentId: string | null; angle: number; size: number; efficiency: number }
export type PrototypeAction = 'wander' | 'seek_food' | 'eat' | 'idle' | 'dead';
export interface Creature {
  id: number; speciesId: number; x: number; y: number; heading: number;
  energy: number; maxEnergy: number; health: number; age: number;
  bodyParts: BodyPartGene[]; genome: Record<string, number>; currentAction: PrototypeAction;
  parentId: number | null;
}
export type PrototypeCreature = Creature;
