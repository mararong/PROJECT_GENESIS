import { useEffect, useRef } from 'react';
import type { WorldState } from '../../types/world';
import type { Camera } from '../../state/uiState';
const COLORS = { water: [19, 49, 62], plain: [45, 75, 57], forest: [25, 48, 39], rock: [89, 103, 98] };
export function MiniMap({ world, camera, onNavigate }: { world: WorldState; camera?: Camera; onNavigate?: (x: number, y: number) => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const context = ref.current?.getContext('2d'); if (!context) return;
    const { width, height, tiles } = world.terrain, pixels = context.createImageData(width, height);
    tiles.forEach((tile, i) => { const color = COLORS[tile.kind]; pixels.data.set([...color.map(n => n + Math.round(tile.variation * 8)), 255], i * 4); });
    context.putImageData(pixels, 0, 0);
    context.fillStyle = '#b4ead5'; for (const c of world.creatures) context.fillRect(c.x, c.y, 1, 1);
    if (camera) { context.strokeStyle = '#69d7ab'; context.lineWidth = .7; context.strokeRect(camera.x - 16 / camera.zoom, camera.y - 12 / camera.zoom, 32 / camera.zoom, 24 / camera.zoom); }
  }, [world.terrain, world.tick, world.creatures, camera]);
  return <canvas ref={ref} className="minimap" width={world.terrain.width} height={world.terrain.height} role={onNavigate ? 'button' : 'img'} aria-label={onNavigate ? '전체 지도: 클릭 또는 방향키로 카메라 이동' : '씨드 기반 지형 미리보기'} tabIndex={onNavigate ? 0 : undefined} onClick={e => { const r = e.currentTarget.getBoundingClientRect(); onNavigate?.((e.clientX - r.left) / r.width * world.terrain.width, (e.clientY - r.top) / r.height * world.terrain.height); }} onKeyDown={e => { if (!camera || !onNavigate) return; const d: Record<string, [number, number]> = { ArrowLeft: [-5, 0], ArrowRight: [5, 0], ArrowUp: [0, -5], ArrowDown: [0, 5] }; if (d[e.key]) { e.preventDefault(); onNavigate(Math.max(0, Math.min(128, camera.x + d[e.key][0])), Math.max(0, Math.min(128, camera.y + d[e.key][1]))); } }}/ >;
}
