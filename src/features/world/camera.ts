import type { Camera } from '../../state/uiState.ts';
import { MIN_ZOOM, MAX_ZOOM } from '../../state/uiState.ts';
export const TILE_SIZE = 16;
export function screenToWorld(camera: Camera, x: number, y: number, width: number, height: number) { return {x:camera.x + (x - width / 2) / (TILE_SIZE * camera.zoom),y:camera.y + (y - height / 2) / (TILE_SIZE * camera.zoom)}; }
export function worldToScreen(camera: Camera, x: number, y: number, width: number, height: number) { return {x:width / 2 + (x - camera.x) * TILE_SIZE * camera.zoom,y:height / 2 + (y - camera.y) * TILE_SIZE * camera.zoom}; }
export function zoomAt(camera: Camera, factor: number, x: number, y: number, width: number, height: number): Camera {
  const before = screenToWorld(camera,x,y,width,height), zoom = Math.max(MIN_ZOOM,Math.min(MAX_ZOOM,camera.zoom * factor));
  return {...camera,zoom,x:before.x - (x - width / 2) / (TILE_SIZE * zoom),y:before.y - (y - height / 2) / (TILE_SIZE * zoom)};
}
