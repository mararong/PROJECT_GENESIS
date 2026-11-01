import { useCallback, useEffect, useRef, useState } from 'react';
import { SimulationEngine } from '../simulation/SimulationEngine.ts';
import { SimulationClock } from '../simulation/SimulationClock.ts';
import type { WorldConfig, WorldState } from '../types/world.ts';
import type { SimulationAdapter } from '../simulation/SimulationAdapter.ts';
export function useSimulation(){
  const adapter=useRef<SimulationAdapter|null>(null),clock=useRef(new SimulationClock());
  const [snapshot,setSnapshot]=useState<WorldState|null>(null),[isPlaying,setPlaying]=useState(false),[speed,setSpeed]=useState(1),[tickRate,setTickRate]=useState(0);
  const control=useRef({isPlaying,speed});control.current={isPlaying,speed};
  const create=useCallback((config:WorldConfig)=>{const next=new SimulationEngine(config);adapter.current?.dispose();adapter.current=next;clock.current.clear();control.current={isPlaying:false,speed:1};setSnapshot(adapter.current.getSnapshot());setPlaying(false);setSpeed(1);setTickRate(0);},[]);
  const step=useCallback(()=>{if(!control.current.isPlaying&&adapter.current)setSnapshot(adapter.current.step());},[]);
  const select=useCallback((id:number)=>{if(adapter.current)setSnapshot(adapter.current.selectCreature(id));},[]);
  useEffect(()=>{
    let frame=0,last=performance.now(),rateAt=last,count=0;
    const loop=(now:number)=>{const c=control.current;const processed=clock.current.advance(now-last,c.isPlaying&&!document.hidden,c.speed,()=>adapter.current?.step());if(processed&&adapter.current)setSnapshot(adapter.current.getSnapshot());count+=processed;if(now-rateAt>=1000){setTickRate(count*1000/(now-rateAt));count=0;rateAt=now;}last=now;frame=requestAnimationFrame(loop);};frame=requestAnimationFrame(loop);
    const hidden=()=>{if(document.hidden){setPlaying(false);clock.current.clear();}};document.addEventListener('visibilitychange',hidden);
    return()=>{cancelAnimationFrame(frame);document.removeEventListener('visibilitychange',hidden);};
  },[]);
  useEffect(()=>{if(snapshot&&snapshot.creatures.length===0)setPlaying(false);},[snapshot]);
  useEffect(()=>()=>{adapter.current?.dispose()},[]);
  return {snapshot,isPlaying,setPlaying,speed,setSpeed,tickRate,create,step,select};
}
