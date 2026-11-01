/** All rates are per fixed tick (0.1 simulation seconds), distances in tiles. */
export interface SimulationConfig {
  basalCostMultiplier: number;
  movementCost: number;
  energyPerFood: number;
  biteSize: number;
  eatingRadius: number;
  minimumFoodAmount: number;
  restThreshold: number;
  restUntil: number;
  maturityAge: number;
  maxAge: number;
  reproductionAge: number;
  reproductionEnergy: number;
  reproductionCost: number;
  newbornEnergy: number;
  reproductionCooldown: number;
  spawnDistance: number;
  spawnClearance: number;
  maxPopulation: number;
  resourceRegen: number;
  resourceCapacity: number;
  resourceMultiplier: number;
  maxEvents: number;
  maxDeceased: number;
  maxHistory: number;
}

export const DEFAULT_SIMULATION_CONFIG: Readonly<SimulationConfig> = Object.freeze({
  basalCostMultiplier: 1, movementCost: .16, energyPerFood: 1.9,
  // Ignore barely regenerated patches: repeatedly harvesting them loses net energy.
  biteSize: 3, eatingRadius: .55, minimumFoodAmount: .5, restThreshold: .9, restUntil: .75,
  maturityAge: 200, maxAge: 2400, reproductionAge: 220,
  reproductionEnergy: 82, reproductionCost: 38, newbornEnergy: 30,
  reproductionCooldown: 260, spawnDistance: 1.2, spawnClearance: .65,
  maxPopulation: 512, resourceRegen: .006, resourceCapacity: 30,
  resourceMultiplier: 1, maxEvents: 2000, maxDeceased: 256, maxHistory: 600,
});

export function simulationConfig(overrides: Partial<SimulationConfig> = {}): Readonly<SimulationConfig> {
  const config = { ...DEFAULT_SIMULATION_CONFIG, ...overrides };
  for (const [key, value] of Object.entries(config)) {
    if (!Number.isFinite(value) || value < 0) throw new Error(`잘못된 M0 설정: ${key}`);
  }
  for (const key of ['maturityAge', 'maxAge', 'reproductionAge', 'reproductionCooldown', 'maxPopulation', 'maxEvents', 'maxDeceased', 'maxHistory'] as const) {
    if (!Number.isInteger(config[key]) || config[key] < 1) throw new Error(`양의 정수 M0 설정 필요: ${key}`);
  }
  if (config.basalCostMultiplier <= 0 || config.energyPerFood <= 0 || config.resourceCapacity <= 0 ||
      config.biteSize <= 0 || config.eatingRadius <= 0 || config.spawnClearance <= 0 ||
      config.minimumFoodAmount <= 0 || config.minimumFoodAmount > config.resourceCapacity ||
      config.spawnDistance < config.spawnClearance || config.reproductionCost < config.newbornEnergy ||
      config.reproductionEnergy < config.reproductionCost || config.reproductionEnergy > 100 ||
      config.restUntil >= config.restThreshold || config.restThreshold > 1) {
    throw new Error('M0 에너지·번식·자원 설정 범위를 확인하세요.');
  }
  return Object.freeze(config);
}
