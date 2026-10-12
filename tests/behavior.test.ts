import { describe, it, expect } from 'vitest';
import { Vector2 } from 'three';
import { FishBehaviorSystem, FishAgent } from '../src/behavior';
function seeded(){let n=71;return ()=>{n=n*16807%2147483647;return(n-1)/2147483646;};}
function system(count=30){const s=new FishBehaviorSystem();const rand=seeded();s.agents=Array.from({length:count},(_,i)=>new FishAgent(i,i%6,s.rx,s.ry,rand));return s;}
describe('fish behavior',()=>{
  it('keeps 50 moving fish inside the pond for five simulated minutes',()=>{const s=system(50);for(let i=0;i<18000;i++)s.update(1/60,2,[]);for(const a of s.agents){expect(Number.isFinite(a.direction)).toBe(true);expect(Math.hypot(a.position.x/(s.rx-a.size*1.6),a.position.y/(s.ry-a.size*1.6))).toBeLessThanOrEqual(1.00001);}});
  it('approaches food with bounded turning and no teleportation',()=>{const s=system(1),a=s.agents[0];a.position.set(-4,0);a.direction=0;const food={position:new Vector2(2,0),active:true};for(let i=0;i<480;i++){const p=a.position.clone(),angle=a.direction;s.update(1/60,1,[food]);expect(a.position.distanceTo(p)).toBeLessThan(.06);expect(Math.abs(a.direction-angle)).toBeLessThan(.04);}expect(a.position.distanceTo(food.position)).toBeLessThan(2);expect(a.state).toBe('food');});
  it('transitions from startle through recovery to normal behavior',()=>{const s=system(1),a=s.agents[0];a.scare(a.position.clone().add(new Vector2(.2,0)),2);expect(a.state).toBe('startle');for(let i=0;i<160;i++)s.update(1/60,1,[]);expect(a.state).toBe('recovery');for(let i=0;i<200;i++)s.update(1/60,1,[]);expect(['wander','idle']).toContain(a.state);});
  it('is stable across 30 and 60 FPS',()=>{const a=system(1),b=system(1);for(let i=0;i<300;i++)a.update(1/30,1,[]);for(let i=0;i<600;i++)b.update(1/60,1,[]);expect(a.agents[0].position.distanceTo(b.agents[0].position)).toBeLessThan(.3);});
  it('separates crowded fish',()=>{const s=system(12);s.agents.forEach((a,i)=>a.position.set(Math.cos(i)*.5,Math.sin(i)*.5));for(let i=0;i<1200;i++)s.update(1/60,1,[]);let overlaps=0;for(let i=0;i<12;i++)for(let j=i+1;j<12;j++)if(s.agents[i].position.distanceTo(s.agents[j].position)<.65)overlaps++;expect(overlaps).toBeLessThan(4);});
});
