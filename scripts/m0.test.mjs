import test from 'node:test';
import assert from 'node:assert/strict';
import { SimulationEngine } from '../src/simulation/SimulationEngine.ts';
import { DEFAULT_CONFIG } from '../src/simulation/worldGenerator.ts';
import { DEFAULT_SIMULATION_CONFIG, simulationConfig } from '../src/simulation/SimulationConfig.ts';
import { SimulationClock } from '../src/simulation/SimulationClock.ts';
import { calculateStatistics } from '../src/simulation/SimulationStatistics.ts';
import { SpatialIndex, canTraverse, isWalkable } from '../src/simulation/World.ts';
import { findBirthPosition, canReproduce } from '../src/simulation/ReproductionSystem.ts';
import { ResourceSystem } from '../src/simulation/ResourceSystem.ts';

// Controlled initial conditions exercise actual engine rules; no scripted lifecycle events.
function fixture(overrides = {}, population = 1) {
  const engine = new SimulationEngine({ ...DEFAULT_CONFIG, population: 10 }, overrides);
  const world = engine.getSnapshot();
  world.terrain = { width: 128, height: 128, tiles: Array.from({ length: 128 * 128 }, () => ({ kind: 'plain', variation: 0 })) };
  world.creatures = world.creatures.slice(0, population).map((creature, i) => ({ ...creature, x: 40.5 + i * 3, y: 40.5, heading: 0, currentAction: 'wander',
    genome: { ...creature.genome, moveSpeed: .2, metabolism: .1, senseRadius: 8 } }));
  world.resources = [];
  world.events = world.events.filter(event => world.creatures.some(creature => creature.id === event.creatureId));
  world.populationHistory = [{ tick: 0, population }];
  world.statistics = calculateStatistics(world.creatures, world.resources, 0, { totalBirths: population, totalDeaths: 0, totalReproductions: 0 });
  return engine;
}
function advance(engine, ticks) { for (let i = 0; i < ticks; i++) engine.step(); return engine.getSnapshot(); }

test('M0: pause/start/resume/step and all speeds use fixed logical ticks', () => {
  for (const speed of [1, 2, 5, 10]) {
    const engine = fixture(), clock = new SimulationClock(), initial = structuredClone(engine.getSnapshot());
    clock.advance(200, false, speed, () => engine.step());
    assert.deepEqual(engine.getSnapshot(), initial);
    for (let frame = 0; frame < 100; frame++) clock.advance(10, true, speed, () => engine.step());
    assert.equal(engine.getSnapshot().tick, 10 * speed);
    clock.advance(250, false, speed, () => engine.step());
    assert.equal(engine.step().tick, 10 * speed + 1);
    clock.advance(100, true, 1, () => engine.step());
    assert.equal(engine.getSnapshot().tick, 10 * speed + 2);
  }
});

test('M0: speed changes preserve fractional simulation time; pause clears debt', () => {
  const clock = new SimulationClock(); let count = 0;
  clock.advance(50, true, 1, () => count++);
  clock.advance(5, true, 10, () => count++);
  assert.equal(count, 1);
  clock.advance(90, true, 1, () => count++);
  clock.advance(0, false, 1, () => count++);
  clock.advance(10, true, 1, () => count++);
  assert.equal(count, 1);
  clock.advance(NaN, true, 1, () => count++);
  clock.advance(100, true, 0, () => count++);
  assert.equal(count, 1);
});

test('M0: movement, basal/distance costs and growth are calculated without mutating earlier snapshots', () => {
  const engine = fixture(), before = engine.getSnapshot(), saved = structuredClone(before), creature = before.creatures[0];
  creature.energy = 50; saved.creatures[0].energy = 50;
  const after = engine.step(), next = after.creatures[0], distance = Math.hypot(next.x - creature.x, next.y - creature.y);
  assert.ok(distance > 0);
  const cost = .1 * (.7 + .3 * next.growth) + distance * engine.rules.movementCost;
  assert.ok(Math.abs(next.energy - (50 - cost)) < 1e-10);
  assert.equal(next.age, 1); assert.ok(next.growth > creature.growth);
  assert.deepEqual(before, saved);
});

test('M0: energy-rich rest still costs energy; starvation cannot accumulate negative energy', () => {
  const engine = fixture(), world = engine.getSnapshot(); world.creatures[0].energy = 100;
  const rested = engine.step().creatures[0];
  assert.equal(rested.currentAction, 'idle'); assert.equal(rested.x, world.creatures[0].x); assert.ok(rested.energy < 100);
  const after = advance(engine, 2500);
  assert.equal(after.creatures.length, 0); assert.equal(after.deceased[1].energy, 0); assert.equal(after.deceased[1].deathCause, 'starvation');
});

test('M0: visible food is approached, consumed and converted to bounded energy', () => {
  const engine = fixture({ resourceRegen: 0 }), world = engine.getSnapshot(), creature = world.creatures[0];
  creature.energy = 20;
  world.resources = [{ id: 0, x: creature.x + 1, y: creature.y, amount: 30, capacity: 30 }];
  const first = engine.step(); assert.equal(first.creatures[0].currentAction, 'seek_food'); assert.equal(first.resources[0].amount, 30);
  const after = advance(engine, 8);
  assert.ok(after.resources[0].amount < 30); assert.ok(after.creatures[0].energy > 20);
  assert.ok(after.creatures[0].energy <= after.creatures[0].maxEnergy);
  assert.ok(after.events.some(event => event.kind === 'eat' && event.creatureId === creature.id));
  assert.equal(world.resources[0].amount, 30);
});

test('M0: sensing ignores food outside the radius and movement never tunnels through terrain or boundaries', () => {
  const engine = fixture(), world = engine.getSnapshot(), creature = world.creatures[0]; creature.energy = 20;
  world.resources = [{ id: 0, x: creature.x + 20, y: creature.y, amount: 30, capacity: 30 }];
  assert.equal(engine.step().creatures[0].currentAction, 'wander');
  world.terrain.tiles[40 * 128 + 42].kind = 'water';
  assert.equal(canTraverse(world.terrain, { x: 40.5, y: 40.5 }, { x: 44.5, y: 40.5 }), false);
  assert.equal(isWalkable(world.terrain, -.1, 40), false);
  const after = advance(engine, 500);
  for (const c of after.creatures) assert.ok(isWalkable(after.terrain, c.x, c.y));
});

test('M0: depleted resources regrow after extinction; regen respects climate and capacity', () => {
  const engine = fixture({ resourceRegen: 1 }), world = engine.getSnapshot(); world.creatures[0].energy = .001;
  world.resources = [{ id: 0, x: 10.5, y: 10.5, amount: 0, capacity: 30 }];
  const first = engine.step(); assert.equal(first.creatures.length, 0); assert.ok(first.resources[0].amount > 0);
  const after = advance(engine, 200); assert.equal(after.tick, 201); assert.ok(after.resources[0].amount > first.resources[0].amount); assert.ok(after.resources[0].amount <= 30);
  assert.equal(after.events.filter(event => event.kind === 'extinction').length, 1);
  const arid = fixture({ resourceRegen: 1 }); arid.getSnapshot().config.preset = 'arid';
  arid.getSnapshot().resources = [{ id: 0, x: 10.5, y: 10.5, amount: 0, capacity: 30 }];
  assert.ok(arid.step().resources[0].amount < first.resources[0].amount);
});

test('M0: maturity, energy, cooldown and available space are required for reproduction', () => {
  const config = DEFAULT_SIMULATION_CONFIG, engine = fixture(), world = engine.getSnapshot(), parent = world.creatures[0];
  parent.age = config.reproductionAge - 1; parent.energy = 99;
  assert.equal(canReproduce(parent, 260, config), false);
  parent.age = config.reproductionAge; parent.energy = config.reproductionEnergy - 1;
  assert.equal(canReproduce(parent, 260, config), false);
  parent.energy = 99;
  assert.equal(canReproduce(parent, 259, config), false); assert.equal(canReproduce(parent, 260, config), true);
  const blockers = Array.from({ length: 72 }, (_, i) => ({ ...parent, id: 100 + i, x: parent.x + Math.cos(i * Math.PI / 36) * config.spawnDistance, y: parent.y + Math.sin(i * Math.PI / 36) * config.spawnDistance }));
  assert.equal(findBirthPosition(parent, world.terrain, new SpatialIndex(2, [parent, ...blockers]), config, () => 0), null);
  // At tick 260 the actual engine creates a distinct child at a free position.
  world.tick = 259; parent.age = 259;
  const after = engine.step(), child = after.creatures.find(c => c.parentId === parent.id), updated = after.creatures.find(c => c.id === parent.id);
  assert.ok(child); assert.notEqual(child.id, parent.id); assert.equal(child.birthTick, 260); assert.equal(child.age, 0);
  assert.ok(Math.hypot(child.x - parent.x, child.y - parent.y) >= config.spawnClearance);
  assert.equal(child.energy, config.newbornEnergy); assert.ok(updated.energy < 99 - config.reproductionCost);
  assert.deepEqual(child.bodyParts, parent.bodyParts); assert.notEqual(child.bodyParts, parent.bodyParts); assert.deepEqual(child.genome, parent.genome);
  assert.equal(updated.offspringCount, 1); assert.equal(updated.lastReproductionTick, 260);
  assert.ok(after.events.some(event => event.kind === 'reproduction')); assert.ok(after.events.some(event => event.kind === 'birth' && event.tick === 260));
  assert.equal(after.statistics.totalBirths, 2); assert.equal(after.statistics.totalReproductions, 1);
  updated.energy = 99; assert.equal(engine.step().creatures.length, 2);
});

test('M0: population cap and blocked terrain do not charge reproduction energy', () => {
  for (const capped of [true, false]) {
    const engine = fixture(capped ? { maxPopulation: 1 } : {}), world = engine.getSnapshot(), parent = world.creatures[0];
    world.tick = 259; parent.age = 259; parent.energy = 99;
    if (!capped) for (let y = 38; y < 44; y++) for (let x = 38; x < 44; x++) if (x !== 40 || y !== 40) world.terrain.tiles[y * 128 + x].kind = 'rock';
    const after = engine.step(); assert.equal(after.creatures.length, 1); assert.ok(after.creatures[0].energy > 98); assert.equal(after.statistics.totalReproductions, 0);
  }
});

test('M0: aging death archives the actual cause despite available food and energy', () => {
  const engine = fixture({ maxAge: 10 }), world = engine.getSnapshot(); world.creatures[0].age = 9; world.creatures[0].energy = 99;
  const after = engine.step(); assert.equal(after.creatures.length, 0); assert.equal(after.deceased[1].deathCause, 'old_age');
  assert.equal(after.deceased[1].alive, false); assert.equal(after.deceased[1].deathTick, 1); assert.ok(after.deceased[1].energy > 0);
  assert.ok(after.events.some(event => event.kind === 'death' && event.message.includes('노화')));
});

test('M0: ecological abundance enables growth; finite food causes depletion, decline and extinction', () => {
  const engine = fixture({ reproductionAge: 10, reproductionCooldown: 10, maturityAge: 10, maxAge: 300, resourceRegen: 0 }), world = engine.getSnapshot();
  world.creatures[0].energy = 99;
  // Many finite patches around a founder; never inject creatures or lifecycle events.
  world.resources = Array.from({ length: 25 }, (_, id) => ({ id, x: 38.5 + id % 5, y: 38.5 + Math.floor(id / 5), amount: 30, capacity: 30 }));
  let peak = 1, lowestFood = 750;
  for (let tick = 0; tick < 3000; tick++) {
    const state = engine.step(); peak = Math.max(peak, state.creatures.length); lowestFood = Math.min(lowestFood, state.statistics.totalResources);
  }
  const after = engine.getSnapshot();
  assert.ok(peak > 1); assert.ok(lowestFood < 750); assert.equal(after.creatures.length, 0);
  assert.equal(after.statistics.totalBirths, after.statistics.totalDeaths);
  assert.ok(after.statistics.totalReproductions > 0);
});

test('M0: same seed and conditions reproduce trajectories, reset and selection cannot perturb physics', () => {
  const a = new SimulationEngine(DEFAULT_CONFIG), b = new SimulationEngine(DEFAULT_CONFIG);
  for (let tick = 0; tick < 600; tick++) { a.step(); b.step(); }
  assert.deepEqual(a.getSnapshot(), b.getSnapshot());
  a.selectCreature(a.getSnapshot().creatures[0].id);
  for (let tick = 0; tick < 50; tick++) { a.step(); b.step(); }
  assert.deepEqual(a.getSnapshot().creatures, b.getSnapshot().creatures); assert.deepEqual(a.getSnapshot().resources, b.getSnapshot().resources);
  a.reset(DEFAULT_CONFIG.seed); assert.deepEqual(a.getSnapshot(), new SimulationEngine(DEFAULT_CONFIG).getSnapshot());
  a.dispose(); assert.throws(() => a.step()); assert.throws(() => a.selectCreature(1)); assert.throws(() => a.reset(1));
});

test('M0: long run of 100 founders keeps finite state, counters and bounded memory collections', () => {
  const engine = new SimulationEngine({ ...DEFAULT_CONFIG, population: 100 }, { maxEvents: 80, maxDeceased: 20, maxHistory: 30 });
  const start = performance.now();
  let peak = 100;
  for (let tick = 0; tick < 20000; tick++) {
    if (tick % 7 === 0) { const c = engine.getSnapshot().creatures[0]; if (c) engine.selectCreature(c.id); }
    const state = engine.step(); peak = Math.max(peak, state.creatures.length);
    assert.ok(state.events.length <= 80); assert.ok(Object.keys(state.deceased).length <= 20); assert.ok(state.populationHistory.length <= 30);
    assert.equal(state.statistics.totalBirths - state.statistics.totalDeaths, state.creatures.length);
    assert.equal(state.statistics.population, state.creatures.length);
    for (const c of state.creatures) { assert.ok(Number.isFinite(c.x + c.y + c.energy)); assert.ok(c.energy > 0 && c.energy <= c.maxEnergy); assert.ok(c.alive); }
    for (const r of state.resources) assert.ok(Number.isFinite(r.amount) && r.amount >= 0 && r.amount <= r.capacity);
  }
  const state = engine.getSnapshot();
  assert.deepEqual(state.statistics, calculateStatistics(state.creatures, state.resources, state.tick, state.statistics));
  assert.equal(new Set(state.events.map(event => event.id)).size, state.events.length);
  assert.ok(state.statistics.totalDeaths > Object.keys(state.deceased).length);
  console.log(JSON.stringify({ scenario: 'M0-long-run', ticks: state.tick, peak, finalPopulation: state.creatures.length,
    births: state.statistics.totalBirths, deaths: state.statistics.totalDeaths, elapsedMs: Math.round(performance.now() - start),
    retainedEvents: state.events.length, retainedDeaths: Object.keys(state.deceased).length, retainedHistory: state.populationHistory.length }));
});

test('M0: resource shortage/recovery events use measured amounts with hysteresis', () => {
  const engine = fixture({ resourceRegen: 1 }), world = engine.getSnapshot();
  world.resources = [{ id: 0, x: 10.5, y: 10.5, amount: 0, capacity: 30 }];
  engine.step(); assert.equal(engine.getSnapshot().events.filter(event => event.kind === 'resource_low').length, 1);
  const after = advance(engine, 100);
  assert.equal(after.events.filter(event => event.kind === 'resource_low').length, 1);
  assert.equal(after.events.filter(event => event.kind === 'resource_recovered').length, 1);
});

test('M0: invalid rates and energy-creating reproduction configs are rejected', () => {
  for (const overrides of [{ resourceRegen: NaN }, { maxEvents: 0 }, { maxAge: 2.5 }, { movementCost: -1 }, { newbornEnergy: 50 }, { restUntil: 1 }]) {
    assert.throws(() => simulationConfig(overrides));
  }
});

test('M0: depleted-patch trap is avoided by choosing a sufficiently stocked food target', () => {
  const engine = fixture({ resourceRegen: 0 }), world = engine.getSnapshot(), creature = world.creatures[0];
  creature.energy = 20;
  world.resources = [{ id: 0, x: creature.x, y: creature.y, amount: .02, capacity: 30 },
    { id: 1, x: creature.x + 1, y: creature.y, amount: 30, capacity: 30 }];
  assert.equal(new ResourceSystem(world.resources, .01).nearest(creature, 8).id, 0, 'old threshold selected a net-energy-loss patch');
  assert.equal(new ResourceSystem(world.resources, engine.rules.minimumFoodAmount).nearest(creature, 8).id, 1);
  assert.equal(engine.step().creatures[0].currentAction, 'seek_food');
  const after = advance(engine, 8);
  assert.ok(after.creatures[0].energy > 20);
  assert.equal(after.resources[0].amount, .02, 'small patch remains available for regeneration');
  assert.ok(after.resources[1].amount < 30);
});

test('M0: measured resource flux and cause counters reconcile despite event/death eviction', () => {
  const engine = fixture({ maxEvents: 2, maxDeceased: 1, maxAge: 10, resourceRegen: 1 }, 2), world = engine.getSnapshot();
  world.creatures[0].energy = .001; world.creatures[1].energy = 99; world.creatures[1].age = 9;
  world.resources = [{ id: 0, x: 10.5, y: 10.5, amount: 0, capacity: 30 }];
  const after = engine.step(), s = after.statistics;
  assert.equal(s.starvationDeaths, 1); assert.equal(s.oldAgeDeaths, 1); assert.equal(s.totalDeaths, 2);
  assert.equal(Object.keys(after.deceased).length, 1); assert.equal(after.events.length, 2);
  assert.ok(Math.abs(s.totalResources - (s.totalFoodRegenerated - s.totalFoodConsumed)) < 1e-9);
});
