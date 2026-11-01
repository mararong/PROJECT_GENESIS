import { Container, Graphics } from 'pixi.js';
import type { WorldState } from '../../types/world';
import { TILE_SIZE } from './camera';

const CHUNK_SIZE = 16;
const PALETTE = { water: [0x102b38, 0x12313e, 0x153643], plain: [0x203831, 0x223b32, 0x263d34], forest: [0x162e28, 0x183229, 0x1b352c], rock: [0x354141, 0x394545, 0x313d3e] };

/** Small cached meshes avoid a single oversized graphics batch and costly rebuilds on pan. */
export class TerrainLayer extends Container {
  private chunks = new Map<string, Graphics>();
  private worldKey = '';

  update(world: WorldState, x0: number, y0: number, x1: number, y1: number) {
    const worldKey = `${world.seed}-${world.config.preset}`;
    if (worldKey !== this.worldKey) {
      this.worldKey = worldKey;
      for (const graphic of this.chunks.values()) graphic.destroy();
      this.chunks.clear();
    }
    for (const graphic of this.chunks.values()) graphic.visible = false;
    for (let cy = Math.floor(y0 / CHUNK_SIZE); cy < Math.ceil(y1 / CHUNK_SIZE); cy++) {
      for (let cx = Math.floor(x0 / CHUNK_SIZE); cx < Math.ceil(x1 / CHUNK_SIZE); cx++) {
        const key = `${cx}-${cy}`;
        let graphic = this.chunks.get(key);
        if (!graphic) {
          graphic = new Graphics();
          this.buildChunk(graphic, world, cx * CHUNK_SIZE, cy * CHUNK_SIZE);
          this.chunks.set(key, graphic); this.addChild(graphic);
        }
        graphic.visible = true;
      }
    }
  }

  private buildChunk(g: Graphics, world: WorldState, x0: number, y0: number) {
    for (let y = y0; y < Math.min(y0 + CHUNK_SIZE, world.terrain.height); y++) {
      for (let x = x0; x < Math.min(x0 + CHUNK_SIZE, world.terrain.width); x++) {
        const tile = world.terrain.tiles[y * world.terrain.width + x];
        const v = tile.variation, color = PALETTE[tile.kind][Math.min(2, Math.floor(v * 3))];
        const px = x * TILE_SIZE, py = y * TILE_SIZE;
        g.rect(px, py, TILE_SIZE + .3, TILE_SIZE + .3).fill(color);
        if (tile.kind === 'forest' && v > .42) {
          g.circle(px + 4 + v * 6, py + 6, 3 + v * 2).fill({ color: 0x3a5f43, alpha: .48 });
          g.circle(px + 7, py + 10, 2).fill({ color: 0x466b49, alpha: .3 });
        } else if (tile.kind === 'water' && v > .83) {
          g.moveTo(px + 3, py + 8).lineTo(px + 11, py + 8).stroke({ color: 0x52808c, alpha: .25, width: .6 });
        } else if (tile.kind === 'rock' && v > .6) {
          g.poly([px + 3, py + 11, px + 7, py + 4, px + 12, py + 10]).fill({ color: 0x63716a, alpha: .4 });
        } else if (tile.kind === 'plain' && v > .76) {
          g.circle(px + v * 10, py + v * 12, 1).fill({ color: 0x6b8a61, alpha: .3 });
        }
      }
    }
  }
}
