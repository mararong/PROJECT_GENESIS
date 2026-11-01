import type { PrototypeAction } from '../types/creature.ts';
import type { WorldState } from '../types/world.ts';
export const ACTION_NAMES:Record<PrototypeAction,string>={wander:'탐색',seek_food:'먹이 접근',eat:'섭취',idle:'휴식',reproduce:'번식',dead:'사망'};
export function findCreature(snapshot:WorldState,id:number|null){return id===null?null:snapshot.creatures.find(c=>c.id===id)??snapshot.deceased[id]??null;}
