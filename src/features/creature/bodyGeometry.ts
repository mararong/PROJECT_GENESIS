import type { BodyPartGene } from '../../types/creature.ts';
export const SPECIES = [{id:1,name:'청록형',color:'#75D6C0',symbol:'●'},{id:2,name:'보라형',color:'#B9A3E3',symbol:'◆'},{id:3,name:'주황형',color:'#E5B17D',symbol:'▲'}];
export const PART_NAMES = {core:'몸통',locomotion:'이동기관',sensor:'감각기관',feeder:'섭식기관',manipulator:'조작기관',defense:'방어기관',signaler:'신호기관'};
export interface PartPose { part: BodyPartGene; x:number; y:number; angle:number; radius:number }
/** A shared body graph resolver is used by both Pixi and the SVG inspector. */
export function resolveBody(parts: BodyPartGene[]): PartPose[] {
  const resolved = new Map<string,PartPose>(), visiting = new Set<string>();
  function visit(part:BodyPartGene):PartPose {
    const cached = resolved.get(part.id); if(cached) return cached;
    if(visiting.has(part.id)) throw new Error('신체 부품 연결에 순환이 있습니다.');
    visiting.add(part.id);
    const parentGene = parts.find(p=>p.id===part.parentId), parent = parentGene ? visit(parentGene) : null;
    const angle = (parent?.angle ?? 0) + part.angle, radius = part.type==='core' ? part.size * 7 : part.size * 4;
    const pose = {part,angle,radius,x:parent ? parent.x + Math.cos(angle) * parent.radius : 0,y:parent ? parent.y + Math.sin(angle) * parent.radius : 0};
    visiting.delete(part.id); resolved.set(part.id,pose); return pose;
  }
  return parts.map(visit);
}
