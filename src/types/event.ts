export type EventKind = 'birth' | 'eat' | 'death' | 'selection' | 'extinction' | 'reproduction' | 'resource_low' | 'resource_recovered';
export interface PrototypeEvent { id: string; tick: number; kind: EventKind; creatureId: number | null; message: string; x?: number; y?: number }
