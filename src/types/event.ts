export type EventKind = 'birth' | 'eat' | 'death' | 'selection' | 'extinction';
export interface PrototypeEvent { id: string; tick: number; kind: EventKind; creatureId: number | null; message: string; x?: number; y?: number }
