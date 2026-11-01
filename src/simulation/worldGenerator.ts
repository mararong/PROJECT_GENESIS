import type { BodyPartGene, Creature } from '../types/creature.ts';
import type { WorldConfig, WorldState } from '../types/world.ts';
import { seededRandom, smoothNoise, coordinateNoise } from './seededRandom.ts';
import { calculateStatistics } from './SimulationStatistics.ts';
export const MAP_SIZE = 128;
export const DEFAULT_CONFIG: WorldConfig = { name: '첫 번째 생태계', seed: 2026, preset: 'balanced', population: 50, demoReproduction: false };
export function validateConfig(config: WorldConfig): string | null {
  if (!config.name.trim() || config.name.trim().length > 40) return '세계 이름은 1~40자로 입력하세요.';
  if (!Number.isInteger(config.seed) || config.seed < 0 || config.seed > 4294967295) return '씨드는 0~4,294,967,295 사이의 정수여야 합니다.';
  if (!Number.isInteger(config.population) || config.population < 10 || config.population > 100) return '개체수는 10~100 사이의 정수로 입력하세요.';
  if (!['balanced', 'forest', 'arid'].includes(config.preset)) return '올바른 맵 프리셋을 선택하세요.';
  return null;
}
export function generateBody(random: () => number): BodyPartGene[] {
  const parts: BodyPartGene[] = [{ id: 'core', type: 'core', parentId: null, angle: 0, size: .8 + random() * .6, efficiency: 1 }];
  const legs = 1 + Math.floor(random() * 4), sensors = 1 + Math.floor(random() * 3);
  for (let i = 0; i < legs; i++) parts.push({ id: `limb-${i}`, type: 'locomotion', parentId: 'core', angle: Math.PI * .5 + (i + .5) / legs * Math.PI, size: .6 + random() * .8, efficiency: .7 + random() * .3 });
  for (let i = 0; i < sensors; i++) parts.push({ id: `sensor-${i}`, type: 'sensor', parentId: 'core', angle: -.8 + (i + .5) / sensors * 1.6, size: .6 + random() * .6, efficiency: .5 + random() * .5 });
  parts.push({ id: 'feeder', type: 'feeder', parentId: 'core', angle: 0, size: .6 + random() * .6, efficiency: .7 + random() * .3 });
  return parts;
}
export function generateWorld(config: WorldConfig): WorldState {
  const error = validateConfig(config); if (error) throw new Error(error);
  const random = seededRandom(config.seed), tiles: WorldState['terrain']['tiles'] = [], land: {x:number;y:number}[] = [], central: {x:number;y:number}[] = [];
  for (let y = 0; y < MAP_SIZE; y++) for (let x = 0; x < MAP_SIZE; x++) {
    const n = smoothNoise(x / 21, y / 21, config.seed) * .72 + smoothNoise(x / 7, y / 7, config.seed + 13) * .28;
    const edge = Math.max(Math.abs(x - 64), Math.abs(y - 64)) / 64;
    const water = config.preset === 'arid' ? .2 : .32;
    const height = n - Math.max(0, edge - .72) * .9;
    const kind = height < water ? 'water' : height > .76 ? 'rock' : n > (config.preset === 'forest' ? .39 : config.preset === 'arid' ? .68 : .54) ? 'forest' : 'plain';
    tiles.push({ kind, variation: coordinateNoise(x, y, config.seed) });
    if (kind !== 'water' && kind !== 'rock') { const p = {x:x + .5,y:y + .5}; land.push(p); if (x > 35 && x < 92 && y > 35 && y < 92) central.push(p); }
  }
  // The fallback prevents invalid spawns even for unusual seeds.
  if (!land.length) { tiles[64 * MAP_SIZE + 64].kind = 'plain'; land.push({x:64.5,y:64.5}); }
  const spawn = central.length ? central : land;
  const creatures: Creature[] = Array.from({length:config.population}, (_, i) => {
    const position = spawn[Math.floor(random() * spawn.length)], bodyParts = generateBody(random);
    return { id:i + 1,speciesId:i % 3 + 1,...position,heading:random() * Math.PI * 2,energy:65 + random() * 25,maxEnergy:100,health:100,age:0,bodyParts,parentId:null,
      alive:true,birthTick:0,lastReproductionTick:0,growth:.55,offspringCount:0,deathCause:null,deathTick:null,
      genome:{bodySize:bodyParts[0].size,moveSpeed:.1 + random() * .12,senseRadius:5 + random() * 7,metabolism:.07 + random() * .06},currentAction:'idle' };
  });
  const resources = Array.from({length:config.preset === 'arid' ? 180 : config.preset === 'forest' ? 650 : 440}, (_,id) => ({id,...land[Math.floor(random() * land.length)],amount:12 + random() * 18,capacity:30}));
  return {config:{...config,name:config.name.trim()},seed:config.seed,tick:0,terrain:{width:MAP_SIZE,height:MAP_SIZE,tiles},creatures,deceased:{},resources,
    statistics:calculateStatistics(creatures,resources,0,{totalBirths:creatures.length,totalDeaths:0,totalReproductions:0}),
    events:creatures.map(c=>({id:`0-birth-${c.id}`,tick:0,kind:'birth',creatureId:c.id,message:`초기 생명체 #${String(c.id).padStart(3,'0')} 배치`,x:c.x,y:c.y})),populationHistory:[{tick:0,population:creatures.length}]};
}
