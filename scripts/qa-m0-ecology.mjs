import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { SimulationEngine } from '../src/simulation/SimulationEngine.ts';
import { DEFAULT_CONFIG } from '../src/simulation/worldGenerator.ts';
import { canTraverse } from '../src/simulation/World.ts';

// Offline measurements of the SAME fixed-tick engine consumed by React/Pixi.
// No world edits, injected births/deaths, or state changes after initialization.
const tuning = process.argv.includes('--tuned');
const output = tuning ? 'docs/qa/m0/tuned' : 'docs/qa/m0';
const ticks = 20000;
await mkdir(output, { recursive: true });
const sources = ['SimulationEngine', 'SimulationConfig', 'BehaviorSystem', 'CreatureSystem', 'EnergySystem', 'ResourceSystem', 'ReproductionSystem', 'worldGenerator', 'seededRandom'];
const { readFile } = await import('node:fs/promises');
const sourceHash = createHash('sha256');
for (const source of sources) sourceHash.update(await readFile(`src/simulation/${source}.ts`));
const results = { generatedAt: new Date().toISOString(), node: process.version, sourceHash: sourceHash.digest('hex'), ticks, runs: [] };

async function run(name, seed, preset, population = 50, overrides = {}) {
  const config = { ...DEFAULT_CONFIG, seed, preset, population };
  const engine = new SimulationEngine(config, overrides);
  const initial = engine.getSnapshot();
  const capacity = initial.resources.reduce((sum, r) => sum + r.capacity, 0);
  const initialFood = initial.statistics.totalResources;
  const hash = createHash('sha256');
  const rows = ['tick,population,resources,average_energy,total_births,total_deaths,reproductions,starvation_deaths,old_age_deaths,food_consumed,food_regenerated'];
  const samples = [], windows = [], deaths = [];
  let peak = population, peakTick = 0, minimumFood = initialFood, minimumFoodTick = 0, extinctTick = null, capTicks = 0;
  let exposure = 0, hungryExposure = 0, depletedExposure = 0;
  let windowStart = initial.statistics, windowPopulation = population, windowExposure = 0, windowHungry = 0;
  let last1000Population = population, greatest1000Drop = { fromTick: 0, toTick: 0, fromPopulation: population, toPopulation: population, drop: 0 };
  const actionCounts = {}, memory = [];
  const record = state => {
    const s = state.statistics;
    const row = [state.tick, s.population, s.totalResources, s.averageEnergy, s.totalBirths, s.totalDeaths, s.totalReproductions,
      s.starvationDeaths, s.oldAgeDeaths, s.totalFoodConsumed, s.totalFoodRegenerated];
    rows.push(row.join(',')); hash.update(JSON.stringify(row));
    if (state.tick % 1000 === 0) samples.push({ tick: state.tick, ...s });
  };
  record(initial);
  const started = performance.now();
  for (let tick = 1; tick <= ticks; tick++) {
    const before = engine.getSnapshot();
    const n = before.creatures.length;
    exposure += n; windowExposure += n;
    const hungry = before.creatures.filter(c => c.energy < .2 * c.maxEnergy).length;
    hungryExposure += hungry; windowHungry += hungry;
    if (before.statistics.totalResources / capacity < .15) depletedExposure += n;
    for (const c of before.creatures) actionCounts[c.currentAction] = (actionCounts[c.currentAction] ?? 0) + 1;
    const state = engine.step(), s = state.statistics;
    assert.equal(s.totalBirths - s.totalDeaths, s.population);
    assert.equal(s.starvationDeaths + s.oldAgeDeaths, s.totalDeaths);
    assert.ok(Number.isFinite(s.totalResources));
    assert.ok(Math.abs(initialFood + s.totalFoodRegenerated - s.totalFoodConsumed - s.totalResources) < 1e-6, 'resource mass balance');
    if (s.population > peak) { peak = s.population; peakTick = tick; }
    if (s.totalResources < minimumFood) { minimumFood = s.totalResources; minimumFoodTick = tick; }
    if (!s.population && extinctTick === null) extinctTick = tick;
    if (s.population >= engine.rules.maxPopulation) capTicks++;
    if (s.totalDeaths > before.statistics.totalDeaths) {
      for (const event of state.events.filter(e => e.tick === tick && e.kind === 'death')) {
        const old = before.creatures.find(c => c.id === event.creatureId);
        const dead = state.deceased[event.creatureId];
        assert.ok(old && dead, 'all deaths in these measured scenarios fit the death archive');
        const local = state.resources.filter(r => r.amount >= .01 && Math.hypot(r.x - dead.x, r.y - dead.y) <= dead.genome.senseRadius);
        deaths.push({ tick, id: dead.id, cause: dead.deathCause, age: dead.age, energy: dead.energy, priorAction: old.currentAction,
          worldFood: s.totalResources, localFood: local.reduce((sum, r) => sum + r.amount, 0), localPatches: local.length,
          directPathPatches: local.filter(r => canTraverse(state.terrain, dead, r)).length });
      }
    }
    record(state);
    if (tick % 1000 === 0) {
      const window = { fromTick: tick - 1000, toTick: tick, startPopulation: windowPopulation, endPopulation: s.population,
        births: s.totalBirths - windowStart.totalBirths, deaths: s.totalDeaths - windowStart.totalDeaths,
        starvationDeaths: s.starvationDeaths - windowStart.starvationDeaths, oldAgeDeaths: s.oldAgeDeaths - windowStart.oldAgeDeaths,
        foodConsumed: s.totalFoodConsumed - windowStart.totalFoodConsumed, foodRegenerated: s.totalFoodRegenerated - windowStart.totalFoodRegenerated,
        startFood: windowStart.totalResources, endFood: s.totalResources,
        organismTicks: windowExposure, hungryOrganismTicks: windowHungry,
        deathsPer1000OrganismTicks: windowExposure ? (s.totalDeaths - windowStart.totalDeaths) / windowExposure * 1000 : null };
      windows.push(window);
      const drop = last1000Population - s.population;
      if (drop > greatest1000Drop.drop) greatest1000Drop = { fromTick: tick - 1000, toTick: tick, fromPopulation: last1000Population, toPopulation: s.population, drop };
      last1000Population = s.population;
      windowStart = s; windowPopulation = s.population; windowExposure = 0; windowHungry = 0;
      global.gc?.();
      memory.push({ tick, heapUsed: process.memoryUsage().heapUsed });
    }
  }
  const final = engine.getSnapshot(), s = final.statistics;
  const summary = { name, config, rules: engine.rules, peak, peakTick, minimumFood, minimumFoodTick, capacity, initialFood,
    extinctTick, capTicks, final: s, resourceBalanceError: initialFood + s.totalFoodRegenerated - s.totalFoodConsumed - s.totalResources,
    exposure, hungryExposure, depletedExposure, actionCounts, greatest1000Drop, windows, samples,
    starvationWithNoLocalFood: deaths.filter(d => d.cause === 'starvation' && d.localPatches === 0).length,
    starvationWithLocalFood: deaths.filter(d => d.cause === 'starvation' && d.localPatches > 0).length,
    starvationWithDirectPathFood: deaths.filter(d => d.cause === 'starvation' && d.directPathPatches > 0).length,
    elapsedMs: Math.round(performance.now() - started), trajectoryHash: hash.digest('hex'), memory,
    retained: { events: final.events.length, deceased: Object.keys(final.deceased).length, history: final.populationHistory.length } };
  await writeFile(`${output}/${name}.csv`, rows.join('\n') + '\n');
  await writeFile(`${output}/${name}-deaths.json`, JSON.stringify(deaths, null, 2));
  results.runs.push(summary);
  await writeFile(`${output}/ecology-results.json`, JSON.stringify(results, null, 2));
  console.log(JSON.stringify({ name, peak, peakTick, extinctTick, finalPopulation: s.population, births: s.totalBirths,
    deaths: s.totalDeaths, starvation: s.starvationDeaths, oldAge: s.oldAgeDeaths, food: s.totalResources,
    consumed: s.totalFoodConsumed, regenerated: s.totalFoodRegenerated, elapsedMs: summary.elapsedMs }));
  engine.dispose();
  return summary;
}

const overrides = tuning ? { minimumFoodAmount: .5 } : { minimumFoodAmount: .01 };
// First reproduce the existing 100-founder stress-test observation separately.
if (!tuning) await run('control-100-balanced-2026', 2026, 'balanced', 100, overrides);
for (const preset of ['balanced', 'forest', 'arid']) {
  for (const seed of [2026, 42, 99]) await run(`${tuning ? 'tuned' : 'baseline'}-50-${preset}-${seed}`, seed, preset, 50, overrides);
}
const replay = await run('replay-50-balanced-2026', 2026, 'balanced', 50, overrides);
assert.equal(replay.trajectoryHash, results.runs.find(r => r.name === `${tuning ? 'tuned' : 'baseline'}-50-balanced-2026`).trajectoryHash, 'same-seed 20000-tick replay');
console.log('Completed measured ecology runs; no model defaults were changed.');
