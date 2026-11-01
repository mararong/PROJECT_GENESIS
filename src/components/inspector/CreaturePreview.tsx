import { useState } from 'react';
import type { Creature } from '../../types/creature';
import { PART_NAMES, resolveBody, SPECIES } from '../../features/creature/bodyGeometry';

/** The inspector and Pixi renderer resolve the very same body graph. */
export function CreaturePreview({ creature, highlightedPart, interactive = true }: { creature: Creature; highlightedPart?: string; interactive?: boolean }) {
  const [rotation, setRotation] = useState(0);
  const poses = resolveBody(creature.bodyParts);
  const color = SPECIES[(creature.speciesId - 1) % SPECIES.length].color;
  return <div className="creature-preview">
    <svg viewBox="-42 -42 84 84" role="img" aria-label={`개체 #${creature.id}의 실제 신체 구조, 기관 ${poses.length}개`}>
      <defs><pattern id={`grid-${creature.id}`} width="8" height="8" patternUnits="userSpaceOnUse"><path d="M 8 0 L 0 0 0 8" fill="none" stroke="#304553" strokeWidth=".2"/></pattern></defs>
      <rect x="-42" y="-42" width="84" height="84" fill={`url(#grid-${creature.id})`}/>
      <circle r="30" fill="none" stroke="#304553" strokeWidth=".3" strokeDasharray="1 2"/>
      <g transform={`rotate(${rotation})`}>
        {poses.filter(p => p.part.type !== 'core').map(({ part, x, y, angle, radius }) => {
          const ex = x + Math.cos(angle) * radius * 1.8, ey = y + Math.sin(angle) * radius * 1.8;
          const stroke = highlightedPart === part.id ? '#F2F7FA' : color;
          return <g key={part.id} data-part-id={part.id}><title>{PART_NAMES[part.type]} · {part.id}</title>
            <path d={`M ${x} ${y} Q ${ex - Math.sin(angle) * 3} ${ey + Math.cos(angle) * 3} ${ex} ${ey}`} stroke={stroke} strokeWidth={part.type === 'locomotion' ? 1.3 : .6} fill="none"/>
            {part.type === 'locomotion' ? <ellipse cx={ex} cy={ey} rx={radius * .8} ry={radius * .35} transform={`rotate(${angle * 180 / Math.PI} ${ex} ${ey})`} fill={color} fillOpacity=".4" stroke={stroke} strokeWidth=".4"/> : <circle cx={ex} cy={ey} r={radius * .7} fill={part.type === 'feeder' ? '#102a28' : color} fillOpacity={part.type === 'feeder' ? 1 : .2} stroke={stroke} strokeWidth=".6"/>}
            {part.type === 'sensor' && <circle cx={ex} cy={ey} r=".8" fill="#e2fff3"/>}
          </g>;
        })}
        {poses.filter(p => p.part.type === 'core').map(({ part, x, y, radius }) => <g key={part.id} data-part-id={part.id}><title>{PART_NAMES.core}</title><ellipse cx={x} cy={y} rx={radius * 1.2} ry={radius} fill={color} fillOpacity=".25" stroke={highlightedPart === part.id ? '#F2F7FA' : color} strokeWidth=".7"/><circle cx={x} cy={y} r={radius * .35} fill={color} fillOpacity=".65"/></g>)}
      </g>
    </svg>
    <span className="preview-label mono">BODY / {poses.length} PARTS</span>
    {interactive && <button className="rotate-preview" aria-label="신체 프리뷰 45도 회전" onClick={() => setRotation(r => r + 45)}>↻ 45°</button>}
  </div>;
}
