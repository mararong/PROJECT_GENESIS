import type { SimulationAdapter } from './SimulationAdapter.ts';
import type { Creature } from '../types/creature.ts';
import type { PrototypeEvent, EventKind } from '../types/event.ts';
import type { WorldConfig, WorldState } from '../types/world.ts';
import { generateWorld } from './worldGenerator.ts';
import { seededRandom } from './seededRandom.ts';
/** Deliberately simple demo rules: no neural network, selection or evolution. */
export class MockEngine implements SimulationAdapter {
  private snapshot:WorldState; private random:()=>number; private disposed=false; private nextId:number;
  constructor(config:WorldConfig){this.snapshot=generateWorld(config);this.random=seededRandom(config.seed ^ 0xa513f);this.nextId=config.population+1;}
  getSnapshot(){return this.snapshot;}
  private ensureAlive(){if(this.disposed)throw new Error('이미 해제된 시뮬레이션입니다.');}
  reset(seed:number){this.ensureAlive();this.snapshot=generateWorld({...this.snapshot.config,seed});this.random=seededRandom(seed ^ 0xa513f);this.nextId=this.snapshot.config.population+1;return this.snapshot;}
  selectCreature(id:number){this.ensureAlive();const c=this.snapshot.creatures.find(c=>c.id===id)??this.snapshot.deceased[id];if(!c)return this.snapshot;
    const event:PrototypeEvent={id:`${this.snapshot.tick}-selection-${this.snapshot.events.length}`,tick:this.snapshot.tick,kind:'selection',creatureId:id,message:`개체 #${String(id).padStart(3,'0')} 선택`,x:c.x,y:c.y};
    this.snapshot={...this.snapshot,events:[...this.snapshot.events,event]};return this.snapshot;
  }
  step(){
    this.ensureAlive();const before=this.snapshot;if(!before.creatures.length)return before;
    const tick=before.tick+1,resources=before.resources.map(f=>({...f,amount:Math.min(f.capacity,f.amount+.006)})),deceased={...before.deceased},creatures:Creature[]=[],newborns:Creature[]=[],events:PrototypeEvent[]=[];
    const log=(kind:EventKind,c:Creature|null,message:string)=>events.push({id:`${tick}-${kind}-${before.events.length+events.length}`,tick,kind,creatureId:c?.id??null,message,x:c?.x,y:c?.y});
    for(const original of before.creatures){
      const c={...original,age:original.age+1};let closest:typeof resources[number]|undefined,distance=c.genome.senseRadius;
      for(const f of resources){if(f.amount<.5)continue;const d=Math.hypot(f.x-c.x,f.y-c.y);if(d<distance){distance=d;closest=f;}}
      if(closest&&distance<.55&&c.energy<c.maxEnergy-1){const consumed=Math.min(closest.amount,8,(c.maxEnergy-c.energy)/1.9);closest.amount-=consumed;c.energy+=consumed*1.9;c.currentAction='eat';log('eat',c,`#${String(c.id).padStart(3,'0')} 먹이 섭취 +${(consumed*1.9).toFixed(1)} E`);}
      else{
        if(closest){c.heading=Math.atan2(closest.y-c.y,closest.x-c.x);c.currentAction='seek_food';}
        else{if(this.random()<.12)c.heading+=(this.random()-.5)*1.8;c.currentAction='wander';}
        const speed=c.genome.moveSpeed,nx=Math.max(.5,Math.min(127.5,c.x+Math.cos(c.heading)*speed)),ny=Math.max(.5,Math.min(127.5,c.y+Math.sin(c.heading)*speed));
        const terrain=before.terrain.tiles[Math.floor(ny)*before.terrain.width+Math.floor(nx)].kind;
        if(terrain==='water'||terrain==='rock'){c.heading+=Math.PI*.5+this.random();c.currentAction='idle';}else{c.x=nx;c.y=ny;c.energy-=speed*.16;}
      }
      c.energy=Math.max(0,Math.min(c.maxEnergy,c.energy-c.genome.metabolism));c.health=c.energy===0?0:Math.min(100,40+c.energy*1.2);
      if(c.energy<=0){c.currentAction='dead';deceased[c.id]=c;log('death',c,`#${String(c.id).padStart(3,'0')} 에너지 고갈로 사망`);continue;}
      if(before.config.demoReproduction&&c.energy>92&&c.age>=300&&c.age%300===0&&before.creatures.length+newborns.length<120){
        c.energy-=35;const child:Creature={...c,id:this.nextId++,parentId:c.id,energy:35,age:0,health:82,currentAction:'idle',bodyParts:c.bodyParts.map(p=>({...p})),genome:{...c.genome}};
        newborns.push(child);log('birth',child,`데모 번식 · #${c.id} → #${child.id} (변이 없는 복제)`);
      }
      creatures.push(c);
    }
    creatures.push(...newborns);
    if(creatures.length===0)log('extinction',null,'이 세계의 생명체가 모두 멸종했습니다.');
    this.snapshot={...before,tick,creatures,deceased,resources,events:[...before.events,...events],populationHistory:tick%10===0||creatures.length!==before.creatures.length?[...before.populationHistory,{tick,population:creatures.length}]:before.populationHistory};return this.snapshot;
  }
  dispose(){this.disposed=true;}
}
