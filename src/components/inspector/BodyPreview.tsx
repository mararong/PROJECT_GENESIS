import type { Creature } from '../../types/creature.ts';
import { PART_NAMES, resolveBody, SPECIES } from '../../features/creature/bodyGeometry.ts';
export function BodyPreview({creature,highlight=null,onPart}:{creature:Creature;highlight?:string|null;onPart?:(id:string)=>void}){
  const color=SPECIES[(creature.speciesId-1)%3].color;
  return <svg className="body-preview" viewBox="-38 -34 76 68" role="img" aria-label={`개체 ${creature.id}의 신체 구조, ${creature.bodyParts.length}개 부품`}>
    <defs><pattern id={`grid-${creature.id}`} width="8" height="8" patternUnits="userSpaceOnUse"><path d="M 8 0 L 0 0 0 8" fill="none" stroke="#304553" strokeWidth=".15"/></pattern></defs><rect x="-38" y="-34" width="76" height="68" fill={`url(#grid-${creature.id})`}/>
    <circle r="26" fill="none" stroke="#304553" strokeWidth=".2"/><path d="M-32 0H32M0-30V30" stroke="#304553" strokeWidth=".2"/>
    {resolveBody(creature.bodyParts).sort((a,b)=>Number(a.part.type==='core')-Number(b.part.type==='core')).map(({part,x,y,angle,radius})=>{
      const ex=x+Math.cos(angle)*radius*1.8,ey=y+Math.sin(angle)*radius*1.8,selected=highlight===part.id;
      return <g key={part.id} onClick={()=>onPart?.(part.id)} style={{cursor:onPart?'pointer':undefined}} stroke={selected?'#F2F7FA':color} strokeWidth={selected?.9:.5} fill={color} fillOpacity=".25"><title>{PART_NAMES[part.type]} · {part.id} · 크기 {part.size.toFixed(2)}</title>
        {part.type==='core'?<><ellipse cx={x} cy={y} rx={radius*1.2} ry={radius}/><circle cx={x} cy={y} r={radius*.35} fillOpacity=".7"/></>:part.type==='locomotion'?<><path d={`M${x} ${y}Q${ex-Math.sin(angle)*3} ${ey+Math.cos(angle)*3} ${ex} ${ey}`} fill="none" strokeWidth="1"/><ellipse cx={ex} cy={ey} rx={radius*.8} ry={radius*.35}/></>:<><line x1={x} y1={y} x2={ex} y2={ey}/><circle cx={ex} cy={ey} r={radius*.7}/>{part.type==='sensor'&&<circle cx={ex} cy={ey} r=".7" fill="#f2f7fa"/>}</>}
      </g>;
    })}
    <text x="-33" y="29" fontSize="2.3" fill="#AEC1CC" fontFamily="monospace">BODY / PROCEDURAL VIEW</text>
  </svg>;
}
