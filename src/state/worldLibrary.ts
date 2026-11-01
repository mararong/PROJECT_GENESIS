import type { WorldConfig } from '../types/world.ts';
import { validateConfig } from '../simulation/worldGenerator.ts';
export interface SavedWorldConfig {config:WorldConfig;createdAt:string}
const KEY='genesis.world-configs.v1';
export function loadWorldLibrary():{items:SavedWorldConfig[];error:string}{
  try{const raw=localStorage.getItem(KEY);if(!raw)return{items:[],error:''};const data:unknown=JSON.parse(raw);
    if(!Array.isArray(data))throw new Error('잘못된 저장 형식');
    const items=data.filter((item):item is SavedWorldConfig=>item&&typeof item==='object'&&item.config&&typeof item.config.name==='string'&&validateConfig(item.config)===null&&typeof item.config.demoReproduction==='boolean'&&typeof item.createdAt==='string'&&!Number.isNaN(Date.parse(item.createdAt))).slice(0,8);
    return {items,error:items.length!==data.length?'일부 손상된 생성 설정을 불러오지 못했습니다.':''};
  }catch{return{items:[],error:'브라우저의 생성 설정을 불러오지 못했습니다. 새 세계는 만들 수 있습니다.'};}
}
export function saveWorldConfig(config:WorldConfig):{items:SavedWorldConfig[];error:string}{
  const existing=loadWorldLibrary().items;
  const items=[{config,createdAt:new Date().toISOString()},...existing.filter(i=>JSON.stringify(i.config)!==JSON.stringify(config))].slice(0,8);
  try{localStorage.setItem(KEY,JSON.stringify(items));return{items,error:''};}catch{return{items:existing,error:'생성 설정을 저장하지 못했습니다. 세계 관찰은 계속할 수 있습니다.'};}
}
