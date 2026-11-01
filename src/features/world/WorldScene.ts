import { Application, Container, Graphics } from 'pixi.js';
import type { WorldState } from '../../types/world.ts';
import type { Camera, WorldLayer } from '../../state/uiState.ts';
import { TILE_SIZE } from './camera.ts';
import { createCreatureSprite } from '../creature/CreatureSprite.ts';
import { SPECIES } from '../creature/bodyGeometry.ts';
import { TerrainLayer } from './TerrainLayer';

/** Rendering only. Never mutates a snapshot or performs model updates. */
export class WorldScene {
  private root = new Container(); private terrain = new TerrainLayer(); private food = new Graphics(); private organisms = new Container(); private selection = new Graphics();
  private sprites = new Map<number,{sprite:Container; signature:string}>();
  private previous: WorldState | null = null; private current: WorldState | null = null; private changedAt = 0;
  constructor(app:Application) { this.root.addChild(this.terrain,this.food,this.organisms,this.selection);app.stage.addChild(this.root); }
  setSnapshot(snapshot:WorldState) { if(this.current!==snapshot){this.previous=this.current;this.current=snapshot;this.changedAt=performance.now();} }
  draw(camera:Camera,width:number,height:number,selectedId:number|null,layer:WorldLayer,playing:boolean,speed:number,reducedMotion:boolean) {
    const w=this.current;if(!w)return;
    this.root.position.set(width/2-camera.x*TILE_SIZE*camera.zoom,height/2-camera.y*TILE_SIZE*camera.zoom);this.root.scale.set(camera.zoom);
    const x0=Math.max(0,Math.floor(camera.x-width/(2*TILE_SIZE*camera.zoom))-1),y0=Math.max(0,Math.floor(camera.y-height/(2*TILE_SIZE*camera.zoom))-1);
    const x1=Math.min(w.terrain.width,Math.ceil(camera.x+width/(2*TILE_SIZE*camera.zoom))+1),y1=Math.min(w.terrain.height,Math.ceil(camera.y+height/(2*TILE_SIZE*camera.zoom))+1);
    this.terrain.update(w,x0,y0,x1,y1);
    this.food.clear();
    for(const f of w.resources){if(f.amount<=0||f.x<x0||f.x>x1||f.y<y0||f.y>y1)continue;
      if(layer==='foodHeatmap')this.food.circle(f.x*TILE_SIZE,f.y*TILE_SIZE,12).fill({color:0xb9da73,alpha:f.amount/f.capacity*.3});
      this.food.circle(f.x*TILE_SIZE,f.y*TILE_SIZE,1.4+f.amount/f.capacity).fill({color:0xb2c879,alpha:.7});
    }
    const alive=new Set(w.creatures.map(c=>c.id));
    for(const [id,s]of this.sprites)if(!alive.has(id)){s.sprite.destroy({children:true});this.sprites.delete(id);}
    const alpha=playing&&!reducedMotion?Math.min(1,(performance.now()-this.changedAt)/(100/speed)):1;
    const old=new Map(this.previous?.creatures.map(c=>[c.id,c])??[]);
    this.selection.clear();
    for(const c of w.creatures){
      const signature=JSON.stringify([c.speciesId,c.bodyParts]);let entry=this.sprites.get(c.id);
      if(!entry||entry.signature!==signature){entry?.sprite.destroy({children:true});entry={sprite:createCreatureSprite(c),signature};this.organisms.addChild(entry.sprite);this.sprites.set(c.id,entry);}
      const prev=old.get(c.id)??c,x=prev.x+(c.x-prev.x)*alpha,y=prev.y+(c.y-prev.y)*alpha;
      entry.sprite.visible=x>x0-2&&x<x1+2&&y>y0-2&&y<y1+2;
      entry.sprite.position.set(x*TILE_SIZE,y*TILE_SIZE);entry.sprite.rotation=c.heading;entry.sprite.alpha=c.energy<15?.6:1;
      if(layer==='speciesMap'&&entry.sprite.visible)this.selection.circle(x*TILE_SIZE,y*TILE_SIZE,22).stroke({color:SPECIES[c.speciesId-1].color,width:1.1,alpha:.55});
      if(c.id===selectedId){const px=x*TILE_SIZE,py=y*TILE_SIZE;this.selection.circle(px,py,22).stroke({color:0x69d7ab,width:1.4});this.selection.circle(px,py,26).stroke({color:0x69d7ab,width:.6,alpha:.3});}
    }
    const dead=selectedId===null?null:w.deceased[selectedId];
    if(dead)this.selection.circle(dead.x*TILE_SIZE,dead.y*TILE_SIZE,22).stroke({color:0xf18e8e,width:1});
  }
  destroy(){this.root.destroy({children:true});this.sprites.clear();}
}
