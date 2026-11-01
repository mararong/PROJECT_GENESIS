import { act, fireEvent, render, renderHook, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { SimulationEngine } from '../simulation/SimulationEngine.ts';
import { DEFAULT_CONFIG } from '../simulation/worldGenerator.ts';
import { useSimulation } from '../state/useSimulation.ts';
import { CreatureInspector } from '../components/inspector/CreatureInspector.tsx';
import { EventTimeline } from '../components/timeline/EventTimeline.tsx';
import type { Creature } from '../types/creature.ts';

beforeEach(() => { vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null); });
afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); });
const handlers = { tab: 'overview' as const, setTab: vi.fn(), followId: null, onFollow: vi.fn(), onClose: vi.fn(),
  onClear: vi.fn(), onSelect: vi.fn(), sheetSize: 'full' as const, onSheetSize: vi.fn() };

it('M0: every world statistic renders the real evolved snapshot and cumulative totals survive archive eviction', () => {
  const engine = new SimulationEngine(DEFAULT_CONFIG, { maxDeceased: 2 });
  const world = engine.getSnapshot(); world.resources = []; world.creatures.forEach(creature => creature.energy = .001);
  const state = engine.step();
  render(<CreatureInspector {...handlers} snapshot={state} creature={null}/>);
  expect(screen.getByTestId('population')).toHaveTextContent('0 organisms');
  expect(screen.getByTestId('total-births')).toHaveTextContent('50');
  expect(screen.getByTestId('total-deaths')).toHaveTextContent('50');
  expect(Object.keys(state.deceased)).toHaveLength(2);
  expect(screen.getByTestId('average-energy').textContent).toBe(state.statistics.averageEnergy.toFixed(1));
  expect(screen.getByTestId('total-resources').textContent).toBe(state.statistics.totalResources.toFixed(1));
  expect(screen.getByTestId('simulation-time').textContent).toBe(`${state.statistics.timeSeconds.toFixed(1)} s`);
});

it('M0: selected child exposes parent, actual birth tick, age, growth, energy and behavior', () => {
  const engine = new SimulationEngine(DEFAULT_CONFIG);
  const world = engine.getSnapshot();
  world.terrain = { ...world.terrain, tiles: world.terrain.tiles.map(tile => ({ ...tile, kind: 'plain' })) };
  world.tick = 259; world.creatures.forEach((creature, i) => { creature.age = 259; creature.energy = 99; creature.x = 30.5 + i % 10 * 4; creature.y = 30.5 + Math.floor(i / 10) * 4; });
  const state = engine.step(), child = state.creatures.find(creature => creature.parentId !== null)!;
  expect(child).toBeDefined();
  render(<CreatureInspector {...handlers} snapshot={state} creature={child}/>);
  const panel = screen.getByRole('complementary', { name: '개체 상세' });
  expect(within(panel).getByText(`#${child.parentId}`)).toBeInTheDocument();
  expect(within(panel).getByText(`T${child.birthTick} · ${(child.birthTick / 10).toFixed(1)} s`)).toBeInTheDocument();
  expect(within(panel).getByText('0 ticks')).toBeInTheDocument();
  expect(within(panel).getByText('생존')).toBeInTheDocument();
  expect(within(panel).getByRole('meter', { name: '에너지' })).toHaveAttribute('value', String(child.energy));
});

it('M0: aging death displays the actual cause and disables following', () => {
  const engine = new SimulationEngine(DEFAULT_CONFIG, { maxAge: 1 });
  const state = engine.step(), creature: Creature = state.deceased[1];
  render(<CreatureInspector {...handlers} snapshot={state} creature={creature}/>);
  expect(screen.getByRole('status')).toHaveTextContent('노화로 사망');
  expect(screen.getByRole('button', { name: /이 개체 추적/ })).toBeDisabled();
});

it('M0: timeline exposes actual reproduction and measured ecological changes in important events', () => {
  const engine = new SimulationEngine(DEFAULT_CONFIG);
  const world = engine.getSnapshot(); world.tick = 259; world.resources = [];
  world.terrain = { ...world.terrain, tiles: world.terrain.tiles.map(tile => ({ ...tile, kind: 'plain' })) };
  world.creatures.forEach((creature, i) => { creature.age = 259; creature.energy = 99; creature.x = 30.5 + i % 10 * 4; creature.y = 30.5 + Math.floor(i / 10) * 4; });
  const state = engine.step(), selected = vi.fn();
  render(<EventTimeline events={state.events} selectedEventId={null} onEvent={selected}/>);
  expect(screen.getByRole('button', { name: /전체 먹이 자원량/ })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '번식' }));
  fireEvent.click(screen.getByRole('button', { name: /회 번식/ }));
  const event = [...state.events].reverse().find(event => event.kind === 'reproduction')!;
  fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: new RegExp(`#${event.creatureId} 번식 →`) }));
  expect(selected).toHaveBeenCalledWith(event);
});

it('M0: React controls drive the real engine, preserve pause and honor all four speeds', async () => {
  vi.useFakeTimers();
  const { result } = renderHook(() => useSimulation());
  act(() => result.current.create(DEFAULT_CONFIG));
  expect(result.current.snapshot).toEqual(new SimulationEngine(DEFAULT_CONFIG).getSnapshot());
  act(() => result.current.step());
  expect(result.current.snapshot!.tick).toBe(1);
  for (const speed of [1, 2, 5, 10]) {
    const before = result.current.snapshot!.tick;
    act(() => { result.current.setSpeed(speed); result.current.setPlaying(true); });
    await act(async () => { vi.advanceTimersByTime(1000); });
    const delta = result.current.snapshot!.tick - before;
    expect(delta).toBeGreaterThanOrEqual(9 * speed); expect(delta).toBeLessThanOrEqual(11 * speed);
    act(() => result.current.setPlaying(false));
    const paused = result.current.snapshot;
    await act(async () => { vi.advanceTimersByTime(200); });
    expect(result.current.snapshot).toBe(paused);
  }
  const state = result.current.snapshot!;
  expect(state.statistics.population).toBe(state.creatures.length);
  expect(state.statistics.totalResources).toBe(state.resources.reduce((sum, resource) => sum + resource.amount, 0));
});
