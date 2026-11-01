import { useEffect, useRef, useState } from 'react';
import { Crosshair, Minus, Plus } from 'lucide-react';
import { Application } from 'pixi.js';
import type { WorldState } from '../../types/world';
import type { Camera, WorldLayer } from '../../state/uiState';
import { screenToWorld, TILE_SIZE, zoomAt } from './camera';
import { WorldScene } from './WorldScene';
import { SPECIES } from '../creature/bodyGeometry';
import { INITIAL_CAMERA } from '../../state/uiState';
import { MiniMap } from './MiniMap';

interface Props {
  world: WorldState; camera: Camera; onCamera: (camera: Camera) => void;
  selectedId: number | null; layer: WorldLayer; playing: boolean; speed: number;
  onSelect: (id: number) => void; onTrack: (id: number) => void; onPan: () => void;
}
/** Mount/unmount ownership stays here. The scene is exclusively a snapshot renderer. */
function WorldCanvasRenderer(props: Props) {
  const host = useRef<HTMLDivElement>(null), latest = useRef(props);
  latest.current = props;
  const [error, setError] = useState(''), [attempt, setAttempt] = useState(0);
  const [hover, setHover] = useState<{ id: number; x: number; y: number } | null>(null);
  useEffect(() => {
    const element = host.current!;
    let disposed = false, initialized = false, app: Application | undefined, scene: WorldScene | undefined;
    let observer: ResizeObserver | undefined;
    const cleanups: (() => void)[] = [];
    const pointers = new Map<number, { x: number; y: number }>();
    let start = { x: 0, y: 0 }, dragged = false, pinched = false;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const point = (event: PointerEvent | WheelEvent) => { const bounds = element.getBoundingClientRect(); return { x: event.clientX - bounds.left, y: event.clientY - bounds.top }; };
    const dimensions = () => ({ width: element.clientWidth, height: element.clientHeight });
    const pick = (x: number, y: number) => {
      const p = latest.current, { width, height } = dimensions(), wp = screenToWorld(p.camera, x, y, width, height);
      let best = Math.max(1.6, 14 / (TILE_SIZE * p.camera.zoom)), id: number | null = null;
      for (const creature of p.world.creatures) { const d = Math.hypot(creature.x - wp.x, creature.y - wp.y); if (d < best) { best = d; id = creature.id; } }
      return id;
    };
    function listen<K extends keyof HTMLElementEventMap>(type: K, handler: (e: HTMLElementEventMap[K]) => void, options?: AddEventListenerOptions) { element.addEventListener(type, handler, options); cleanups.push(() => element.removeEventListener(type, handler, options)); }
    async function mount() {
      try {
        const instance = new Application(); app = instance;
        await instance.init({ width: Math.max(1, element.clientWidth), height: Math.max(1, element.clientHeight), background: '#0c1c22', antialias: true, autoDensity: true, resolution: Math.min(window.devicePixelRatio || 1, 2), preference: 'webgl' });
        initialized = true;
        if (disposed) { instance.destroy(true, { children: true }); return; }
        instance.canvas.setAttribute('aria-hidden', 'true'); element.appendChild(instance.canvas);
        scene = new WorldScene(instance);
        observer = new ResizeObserver(() => { if (!disposed) instance.renderer.resize(Math.max(1, element.clientWidth), Math.max(1, element.clientHeight)); }); observer.observe(element);
        instance.ticker.maxFPS = 60;
        instance.ticker.add(() => {
          if (disposed) return;
          const p = latest.current; scene!.setSnapshot(p.world);
          scene!.draw(p.camera, instance.screen.width, instance.screen.height, p.selectedId, p.layer, p.playing, p.speed, reducedMotion);
        });
        listen('wheel', e => { e.preventDefault(); const p = point(e), size = dimensions(); latest.current.onCamera(zoomAt(latest.current.camera, Math.exp(-Math.max(-100, Math.min(100, e.deltaY)) * .003), p.x, p.y, size.width, size.height)); }, { passive: false });
        listen('pointerdown', e => { if (e.button !== 0) return; const p = point(e); element.setPointerCapture(e.pointerId); pointers.set(e.pointerId, p); start = p; dragged = false; pinched = pointers.size > 1; setHover(null); });
        listen('pointermove', e => {
          const p = point(e), previous = pointers.get(e.pointerId);
          if (!previous) { if (e.pointerType === 'mouse') { const id = pick(p.x, p.y); setHover(id === null ? null : { id, ...p }); } return; }
          if (pointers.size === 2) {
            const other = [...pointers.entries()].find(([id]) => id !== e.pointerId)![1];
            const oldDistance = Math.hypot(previous.x - other.x, previous.y - other.y), distance = Math.hypot(p.x - other.x, p.y - other.y);
            const size = dimensions(), center = { x: (p.x + other.x) / 2, y: (p.y + other.y) / 2 };
            if (oldDistance > 1) latest.current.onCamera(zoomAt(latest.current.camera, distance / oldDistance, center.x, center.y, size.width, size.height));
            dragged = true; pinched = true;
          } else {
            if (Math.hypot(p.x - start.x, p.y - start.y) > 4) dragged = true;
            if (dragged) { latest.current.onPan(); const c = latest.current.camera; latest.current.onCamera({ ...c, x: Math.max(-16, Math.min(144, c.x - (p.x - previous.x) / (TILE_SIZE * c.zoom))), y: Math.max(-16, Math.min(144, c.y - (p.y - previous.y) / (TILE_SIZE * c.zoom))) }); }
          }
          pointers.set(e.pointerId, p);
        });
        listen('pointerup', e => { const p = point(e); if (pointers.has(e.pointerId) && !dragged && !pinched) { const id = pick(p.x, p.y); if (id !== null) latest.current.onSelect(id); } pointers.delete(e.pointerId); if (!pointers.size) pinched = false; });
        listen('pointercancel', e => { pointers.delete(e.pointerId); dragged = false; });
        listen('pointerleave', () => setHover(null));
        listen('dblclick', e => { const bounds = element.getBoundingClientRect(), id = pick(e.clientX - bounds.left, e.clientY - bounds.top); if (id !== null) latest.current.onTrack(id); });
      } catch (issue) { if (!disposed) setError(`월드 렌더러를 시작하지 못했습니다. WebGL 지원을 확인하고 다시 시도하세요. ${issue instanceof Error ? issue.message : ''}`); }
    }
    void mount();
    return () => { disposed = true; observer?.disconnect(); cleanups.forEach(fn => fn()); scene?.destroy(); if (initialized && app?.renderer) app.destroy(true, { children: true }); };
  }, [attempt]);
  const hovered = hover ? props.world.creatures.find(c => c.id === hover.id) : undefined;
  return <><div ref={host} className="pixi-host" role="img" aria-label={`생태계 지도. 생명체 ${props.world.creatures.length}마리. 드래그로 이동, 휠 또는 핀치로 확대. 키보드 사용자는 세계 개요의 개체 목록에서 선택하세요.`}/>
    {hover && hovered && <div className="canvas-tooltip" style={{ left: Math.min(hover.x + 16, (host.current?.clientWidth ?? 400) - 170), top: Math.max(80, hover.y - 50) }}><strong>{SPECIES[(hovered.speciesId - 1) % 3].name} #{String(hovered.id).padStart(3, '0')}</strong><span>에너지 {hovered.energy.toFixed(1)} · 클릭하여 분석</span></div>}
    {error && <div role="alert" className="renderer-error"><p>{error}</p><button onClick={() => { setError(''); setAttempt(n => n + 1); }}>렌더러 다시 시도</button></div>}
  </>;
}

interface WorldCanvasProps {
  snapshot: WorldState; selectedId: number | null; followId: number | null;
  layer: WorldLayer; isPlaying: boolean; speed: number;
  onSelect: (id: number) => void; onFollow: (id: number | null) => void;
  focusPoint: { x: number; y: number; nonce: number } | null;
}
export function WorldCanvas(p: WorldCanvasProps) {
  const [camera, setCamera] = useState<Camera>({ ...INITIAL_CAMERA, zoom: .8 });
  const bounds = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const creature = p.snapshot.creatures.find(c => c.id === p.followId);
    if (creature) setCamera(c => ({ ...c, x: creature.x, y: creature.y }));
  }, [p.followId, p.snapshot]);
  useEffect(() => { if (p.focusPoint) setCamera(c => ({ ...c, x: p.focusPoint!.x, y: p.focusPoint!.y })); }, [p.focusPoint]);
  function zoom(factor: number) { setCamera(c => { const r = bounds.current?.getBoundingClientRect(); return zoomAt(c, factor, (r?.width ?? 800) / 2, (r?.height ?? 600) / 2, r?.width ?? 800, r?.height ?? 600); }); }
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest('input,select,textarea,[contenteditable=true]') || document.querySelector('[role=dialog]')) return;
      if (e.key === '+' || e.key === '=') { e.preventDefault(); zoom(1.2); }
      if (e.key === '-' || e.key === '_') { e.preventDefault(); zoom(1 / 1.2); }
    }; window.addEventListener('keydown', key); return () => window.removeEventListener('keydown', key);
  }, []);
  return <><div className="world-renderer" ref={bounds} data-camera-x={camera.x} data-camera-y={camera.y} data-camera-zoom={camera.zoom} data-selected-id={p.selectedId ?? ''}><WorldCanvasRenderer world={p.snapshot} camera={camera} onCamera={setCamera} selectedId={p.selectedId} layer={p.layer} playing={p.isPlaying} speed={p.speed} onSelect={p.onSelect} onTrack={id => { p.onSelect(id); p.onFollow(id); }} onPan={() => p.onFollow(null)}/></div>
    <div className="zoom-controls"><button aria-label="확대" title="확대 (+)" onClick={() => zoom(1.2)}><Plus size={17}/></button><span className="mono">{Math.round(camera.zoom * 100)}%</span><button aria-label="축소" title="축소 (-)" onClick={() => zoom(1 / 1.2)}><Minus size={17}/></button><span className="tool-divider"/><button aria-label="카메라 초기화" title="전체 지도 중심으로" onClick={() => { p.onFollow(null); setCamera({ ...INITIAL_CAMERA, zoom: .8 }); }}><Crosshair size={17}/></button></div>
    <div className="map-overview"><MiniMap world={p.snapshot} camera={camera} onNavigate={(x, y) => { p.onFollow(null); setCamera(c => ({ ...c, x, y })); }}/><span>WORLD MAP</span></div>
  </>;
}
