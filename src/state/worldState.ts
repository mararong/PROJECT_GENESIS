import type { PrototypeAction } from '../types/creature.ts';
import type { WorldState } from '../types/world.ts';
export const ACTION_NAMES:Record<PrototypeAction,string>={wander:'이동',seek_food:'먹이 탐색',eat:'섭취',idle:'대기',dead:'사망'};
export function findCreature(snapshot:WorldState,id:number|null){return id===null?null:snapshot.creatures.find(c=>c.id===id)??snapshot.deceased[id]??null;}
