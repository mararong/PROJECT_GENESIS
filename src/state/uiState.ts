export type WorldLayer = 'normal' | 'foodHeatmap' | 'speciesMap';
export type InspectorTab = 'overview' | 'body' | 'genome';
export interface Camera { x: number; y: number; zoom: number }
export const INITIAL_CAMERA: Camera = {x:64,y:64,zoom:1};
export const MIN_ZOOM = .28, MAX_ZOOM = 4;
