import type { Quality } from './settings';
export type Tier='low'|'medium'|'high';
export class PerformanceController {
  tier:Tier;fps=60;private elapsed=0;private frames=0;private slow=0;private fast=0;private warmup=5;
  constructor(private changed:(tier:Tier)=>void){this.tier=matchMedia('(pointer: coarse)').matches?'medium':'high';}
  get ratio(){return Math.min(devicePixelRatio,this.tier==='high'?1.75:this.tier==='medium'?1.25:1);}
  get resolution(){return this.tier==='high'?384:this.tier==='medium'?256:128;}
  get fishLimit(){return this.tier==='low'?22:this.tier==='medium'?35:50;}
  setQuality(q:Quality){this.tier=q==='auto'?(matchMedia('(pointer: coarse)').matches?'medium':'high'):q;this.slow=0;this.fast=0;this.warmup=5;this.changed(this.tier);}
  update(dt:number,q:Quality){if(dt<=0)return;this.elapsed+=dt;this.frames++;if(this.elapsed<1)return;this.fps=this.frames/this.elapsed;this.frames=0;this.elapsed=0;if(this.warmup>0){this.warmup--;return;}if(q!=='auto')return;this.slow=this.fps<42?this.slow+1:0;this.fast=this.fps>57?this.fast+1:0;
    if(this.slow>=4&&this.tier!=='low'){this.tier=this.tier==='high'?'medium':'low';this.slow=0;this.fast=0;this.changed(this.tier);}else if(this.fast>=25&&this.tier!=='high'){this.tier=this.tier==='low'?'medium':'high';this.fast=0;this.changed(this.tier);}
  }
}
