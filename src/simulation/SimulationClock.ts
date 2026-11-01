export const BASE_TICKS_PER_SECOND=10;
/** Fixed logical ticks; elapsed rendering time never enters the model itself. */
export class SimulationClock {
  private accumulator=0;
  advance(elapsedMs:number,playing:boolean,speed:number,step:()=>void):number{
    if(!playing){this.accumulator=0;return 0;}
    this.accumulator+=Math.max(0,Math.min(elapsedMs,250));const interval=1000/(BASE_TICKS_PER_SECOND*speed);let count=0;
    while(this.accumulator>=interval){step();this.accumulator-=interval;count++;}return count;
  }
  clear(){this.accumulator=0;}
}
