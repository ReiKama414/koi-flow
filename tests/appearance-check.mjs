import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage();await page.goto('http://localhost:5173');await page.waitForFunction(()=>window.__pond?.inspect().time>1);
 const results=await page.evaluate(async()=>{
   const THREE=await import('/node_modules/.vite/deps/three.js');
   const {createFishGeometry}=await import('/src/fishGeometry.ts');
   const {renderFishPreviews}=await import('/src/fishPreviews.ts');
   const renderer=new THREE.WebGLRenderer({alpha:true});
   const geometry=createFishGeometry(),atlas=await new THREE.TextureLoader().loadAsync('/images/koi-varieties.png');
   const versions=[.13,.51,.87].map(seed=>renderFishPreviews(renderer,geometry,atlas,Array(6).fill(seed)));
   const repeat=renderFishPreviews(renderer,geometry,atlas,Array(6).fill(.13));
   const result={uniquePerSpecies:Array.from({length:6},(_,i)=>new Set(versions.map(v=>v[i])).size),stable:repeat.every((v,i)=>v===versions[0][i]),seeds:window.__pond.inspect().fish.map(f=>f.patternSeed)};
   geometry.dispose();atlas.dispose();renderer.dispose();return result;
 });
 assert.ok(results.uniquePerSpecies.every(n=>n===3));assert.ok(results.stable);assert.equal(new Set(results.seeds).size,results.seeds.length);
 console.log('PASS: all six species produce distinct individual appearances; seeds remain stable and unique.');
}finally{await browser.close();}
