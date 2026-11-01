import { Container, Graphics } from 'pixi.js';
import type { Creature } from '../../types/creature.ts';
import { resolveBody, SPECIES } from './bodyGeometry.ts';
export function createCreatureSprite(creature: Creature): Container {
  const root = new Container(), g = new Graphics(); root.addChild(g);
  const color = SPECIES[(creature.speciesId - 1) % SPECIES.length].color;
  const poses = resolveBody(creature.bodyParts);
  for(const {part,x,y,angle,radius} of poses.filter(p=>p.part.type!=='core')) {
    const ex = x + Math.cos(angle) * radius * 1.8, ey = y + Math.sin(angle) * radius * 1.8;
    if(part.type==='locomotion') { g.moveTo(x,y).quadraticCurveTo(ex - Math.sin(angle) * 3,ey + Math.cos(angle) * 3,ex,ey).stroke({color,width:2.2,alpha:.7}); g.ellipse(ex,ey,radius * .8,radius * .35).fill({color,alpha:.4}); }
    else if(part.type==='sensor') { g.moveTo(x,y).lineTo(ex,ey).stroke({color,width:1,alpha:.5}); g.circle(ex,ey,radius * .7).fill({color,alpha:.15}).stroke({color,width:.7,alpha:.7}); g.circle(ex,ey,1).fill('#e2fff3'); }
    else if(part.type==='feeder') { g.circle(ex,ey,radius * .7).fill('#102a28').stroke({color,width:1.2,alpha:.8}); }
    else { g.circle(ex,ey,radius).fill({color,alpha:.4}); }
  }
  for(const {x,y,radius} of poses.filter(p=>p.part.type==='core')) {
    g.ellipse(x,y,radius * 1.2,radius).fill({color,alpha:.28}).stroke({color,width:1.1,alpha:.9});
    g.circle(x - radius * .2,y,radius * .38).fill({color,alpha:.35});
    // Species-specific nucleus pattern supplements colour.
    if(creature.speciesId===2) g.poly([x,y-3,x+3,y,x,y+3,x-3,y]).fill(color);
    else if(creature.speciesId===3) g.poly([x,y-3,x+3,y+2,x-3,y+2]).fill(color);
    else g.circle(x,y,1.8).fill(color);
  }
  return root;
}
