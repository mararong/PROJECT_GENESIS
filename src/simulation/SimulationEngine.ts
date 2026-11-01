import type { SimulationAdapter } from './SimulationAdapter.ts';
import type { Creature } from '../types/creature.ts';
import type { PrototypeEvent } from '../types/event.ts';
import type { WorldConfig, WorldState } from '../types/world.ts';
import { generateWorld } from './worldGenerator.ts';
import { seededRandom } from './seededRandom.ts';
import { simulationConfig, type SimulationConfig } from './SimulationConfig.ts';
import { RuleBasedBehavior, type BehaviorPolicy } from './BehaviorSystem.ts';
import { ResourceSystem, regenerateResources } from './ResourceSystem.ts';
import { spendEnergy, eat } from './EnergySystem.ts';
import { updateAge, deathCause, moveCreature } from './CreatureSystem.ts';
import { canReproduce, findBirthPosition, reproduce } from './ReproductionSystem.ts';
import { SpatialIndex } from './World.ts';
import { SimulationEvents, retainEvents } from './SimulationEvents.ts';
import { calculateStatistics } from './SimulationStatistics.ts';

/** Owns fixed-tick state; neither rendering cadence nor UI interactions advance physics. */
export class SimulationEngine implements SimulationAdapter {
  private snapshot: WorldState;
  private random: () => number;
  private nextId: number;
  private disposed = false;
  private events = new SimulationEvents();
  private resourceLow = false;
  private behavior: BehaviorPolicy;
  readonly rules: Readonly<SimulationConfig>;

  constructor(config: WorldConfig, overrides: Partial<SimulationConfig> = {}, behavior: BehaviorPolicy = new RuleBasedBehavior()) {
    this.rules = simulationConfig(overrides);
    this.behavior = behavior;
    this.snapshot = this.initialState(config);
    this.random = seededRandom(config.seed ^ 0xa513f);
    this.nextId = config.population + 1;
  }

  private initialState(config: WorldConfig): WorldState {
    const state = generateWorld(config);
    state.resources = state.resources.map(resource => ({ ...resource,
      capacity: this.rules.resourceCapacity,
      amount: Math.min(this.rules.resourceCapacity, resource.amount / resource.capacity * this.rules.resourceCapacity * this.rules.resourceMultiplier) }));
    state.creatures = state.creatures.map(creature => ({ ...creature, health: creature.energy / creature.maxEnergy * 100 }));
    state.statistics = calculateStatistics(state.creatures, state.resources, 0, state.statistics);
    state.events = state.events.slice(-this.rules.maxEvents);
    return state;
  }

  private ensureAlive() { if (this.disposed) throw new Error('이미 해제된 시뮬레이션입니다.'); }
  getSnapshot() { return this.snapshot; }

  reset(seed: number) {
    this.ensureAlive();
    const state = this.initialState({ ...this.snapshot.config, seed });
    this.random = seededRandom(seed ^ 0xa513f);
    this.nextId = state.config.population + 1;
    this.events = new SimulationEvents();
    this.resourceLow = false;
    this.snapshot = state;
    return state;
  }

  selectCreature(id: number) {
    this.ensureAlive();
    const creature = this.snapshot.creatures.find(creature => creature.id === id) ?? this.snapshot.deceased[id];
    if (creature) this.snapshot = { ...this.snapshot, events: retainEvents(this.snapshot.events,
      [this.events.create(this.snapshot.tick, 'selection', creature, `개체 #${String(id).padStart(3, '0')} 선택`)], this.rules.maxEvents) };
    return this.snapshot;
  }

  step(): WorldState {
    this.ensureAlive();
    const before = this.snapshot, tick = before.tick + 1, config = this.rules;
    const resources = regenerateResources(before.resources, before.terrain, before.config.preset, config);
    const regenerated = resources.reduce((sum, resource, index) => sum + resource.amount - before.resources[index].amount, 0);
    const resourceSystem = new ResourceSystem(resources, config.minimumFoodAmount);
    const events: PrototypeEvent[] = [], deceased = { ...before.deceased };
    const log = (kind: PrototypeEvent['kind'], creature: Creature | null, message: string) => events.push(this.events.create(tick, kind, creature, message));
    const creatures: Creature[] = [], newborns: Creature[] = [];
    let deaths = 0, births = 0;
    let consumedFood = 0, starvationDeaths = 0, oldAgeDeaths = 0;

    // First complete movement, feeding and mortality for all existing organisms.
    for (const original of before.creatures) {
      const creature = { ...original };
      updateAge(creature, config);
      const decision = this.behavior.decide({ creature, resources: resourceSystem, config, tick,
        canReproduce: canReproduce(creature, tick, config) });
      creature.currentAction = decision.action;
      const distance = moveCreature(creature, decision, before.terrain, this.random);
      spendEnergy(creature, distance, config);
      // A creature whose energy ran out cannot revive by eating on the same tick.
      if (creature.energy > 0 && creature.age < config.maxAge && decision.action === 'eat' && decision.target) {
        const consumed = eat(creature, decision.target, config);
        consumedFood += consumed;
        if (consumed > 0) log('eat', creature, `#${String(creature.id).padStart(3, '0')} 먹이 섭취 +${(consumed * config.energyPerFood).toFixed(1)} E`);
      }
      creature.health = 100 * creature.energy / creature.maxEnergy;
      const cause = deathCause(creature, config);
      if (cause) {
        creature.alive = false; creature.deathCause = cause; creature.deathTick = tick; creature.currentAction = 'dead'; creature.health = 0;
        deceased[creature.id] = creature; deaths++;
        if (cause === 'starvation') starvationDeaths++; else oldAgeDeaths++;
        log('death', creature, `#${String(creature.id).padStart(3, '0')} ${cause === 'starvation' ? '에너지 고갈' : '노화'}로 사망`);
      } else creatures.push(creature);
    }

    const occupied = new SpatialIndex(2, creatures);
    for (const creature of creatures) {
      if (creature.currentAction !== 'reproduce') continue;
      if (!canReproduce(creature, tick, config) || creatures.length + newborns.length >= config.maxPopulation) { creature.currentAction = 'idle'; continue; }
      const position = findBirthPosition(creature, before.terrain, occupied, config, this.random);
      if (!position) { creature.currentAction = 'idle'; continue; }
      const child = reproduce(creature, position, this.nextId++, tick, config);
      creature.health = 100 * creature.energy / creature.maxEnergy;
      newborns.push(child); occupied.add(child); births++;
      log('reproduction', creature, `#${creature.id} 번식 → #${child.id} · 에너지 ${config.reproductionCost} E 소비`);
      log('birth', child, `새 생명체 #${child.id} 탄생 · 부모 #${creature.id}`);
    }
    creatures.push(...newborns);
    if (before.creatures.length && !creatures.length) log('extinction', null, '이 세계의 생명체가 모두 멸종했습니다.');

    const statistics = calculateStatistics(creatures, resources, tick, {
      totalBirths: before.statistics.totalBirths + births,
      totalDeaths: before.statistics.totalDeaths + deaths,
      totalReproductions: before.statistics.totalReproductions + births,
      totalFoodConsumed: before.statistics.totalFoodConsumed + consumedFood,
      totalFoodRegenerated: before.statistics.totalFoodRegenerated + regenerated,
      starvationDeaths: before.statistics.starvationDeaths + starvationDeaths,
      oldAgeDeaths: before.statistics.oldAgeDeaths + oldAgeDeaths,
    });
    const capacity = resources.reduce((sum, resource) => sum + resource.capacity, 0);
    const ratio = capacity ? statistics.totalResources / capacity : 0;
    if (!this.resourceLow && ratio < .15) { this.resourceLow = true; log('resource_low', null, '전체 먹이 자원량이 수용량의 15% 미만으로 감소했습니다.'); }
    else if (this.resourceLow && ratio > .35) { this.resourceLow = false; log('resource_recovered', null, '전체 먹이 자원량이 수용량의 35% 이상으로 회복되었습니다.'); }

    // Keep recent deaths by actual event order, not by numeric creature ID.
    const deathOrder = Object.values(deceased).sort((a, b) => (a.deathTick ?? 0) - (b.deathTick ?? 0) || a.id - b.id);
    for (const creature of deathOrder.slice(0, Math.max(0, deathOrder.length - config.maxDeceased))) delete deceased[creature.id];
    const populationHistory = tick % 10 === 0 || creatures.length !== before.creatures.length
      ? [...before.populationHistory, { tick, population: creatures.length }].slice(-config.maxHistory) : before.populationHistory;
    this.snapshot = { ...before, tick, creatures, resources, deceased, statistics, populationHistory,
      events: retainEvents(before.events, events, config.maxEvents) };
    return this.snapshot;
  }

  dispose() { this.disposed = true; }
}
