import type { TerrainGrid } from '../types/world.ts';

export interface Position { x: number; y: number }

export function isWalkable(terrain: TerrainGrid, x: number, y: number): boolean {
  if (x < .5 || y < .5 || x > terrain.width - .5 || y > terrain.height - .5) return false;
  const kind = terrain.tiles[Math.floor(y) * terrain.width + Math.floor(x)]?.kind;
  return kind === 'plain' || kind === 'forest';
}

/** Sample the entire segment so large future speeds cannot tunnel through water. */
export function canTraverse(terrain: TerrainGrid, from: Position, to: Position): boolean {
  const steps = Math.max(1, Math.ceil(Math.hypot(to.x - from.x, to.y - from.y) / .2));
  for (let i = 1; i <= steps; i++) {
    if (!isWalkable(terrain, from.x + (to.x - from.x) * i / steps, from.y + (to.y - from.y) * i / steps)) return false;
  }
  return true;
}

/** Stable insertion order keeps local queries deterministic. */
export class SpatialIndex<T extends Position> {
  private cells = new Map<string, Set<T>>();
  private cellSize: number;
  constructor(cellSize: number, items: readonly T[] = []) { this.cellSize = cellSize; items.forEach(item => this.add(item)); }
  private key(x: number, y: number) { return `${Math.floor(x / this.cellSize)},${Math.floor(y / this.cellSize)}`; }
  add(item: T) {
    const key = this.key(item.x, item.y);
    let cell = this.cells.get(key);
    if (!cell) { cell = new Set(); this.cells.set(key, cell); }
    cell.add(item);
  }
  remove(item: T) {
    const key = this.key(item.x, item.y), cell = this.cells.get(key);
    cell?.delete(item);
    if (!cell?.size) this.cells.delete(key);
  }
  *near(position: Position, radius: number): IterableIterator<T> {
    for (let y = Math.floor((position.y - radius) / this.cellSize); y <= Math.floor((position.y + radius) / this.cellSize); y++) {
      for (let x = Math.floor((position.x - radius) / this.cellSize); x <= Math.floor((position.x + radius) / this.cellSize); x++) {
        for (const item of this.cells.get(`${x},${y}`) ?? []) {
          if (Math.hypot(item.x - position.x, item.y - position.y) <= radius) yield item;
        }
      }
    }
  }
}
