export const BASE_TICKS_PER_SECOND=10;
/** Fixed logical ticks; elapsed rendering time never enters the model itself. */
export class SimulationClock {
  private accumulator=0;
  advance(elapsedMs:number,playing:boolean,speed:number,step:()=>void):number{
    if(!playing){this.accumulator=0;return 0;}
    if(!Number.isFinite(elapsedMs)||![1,2,5,10].includes(speed))return 0;
    // Accumulate simulation milliseconds so speed changes preserve fractional tick progress.
    this.accumulator+=Math.max(0,Math.min(elapsedMs,250))*speed;const interval=1000/BASE_TICKS_PER_SECOND;let count=0;
    while(this.accumulator>=interval){step();this.accumulator-=interval;count++;}return count;
  }
  clear(){this.accumulator=0;}
}
