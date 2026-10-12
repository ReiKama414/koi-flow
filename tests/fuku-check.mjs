import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const p=await browser.newPage({viewport:{width:1440,height:960}});const errors=[];p.on('pageerror',e=>errors.push(String(e)));
 await p.goto('http://localhost:5173');await p.waitForFunction(()=>window.__pond?.inspect().time>1);
 const unique=async()=>{const fish=await p.evaluate(()=>window.__pond.inspect().fish.filter(f=>f.name==='福錦'));assert.equal(fish.length,1);assert.equal(fish[0].patternSeed,.888168);return fish[0];};
 await unique();await p.screenshot({path:'test-results/light-pond.png'});
 await p.getByRole('button',{name:'魚種',exact:true}).click();assert.equal(await p.locator('.blessing-fish').count(),1);await p.screenshot({path:'test-results/fuku.png'});
 await p.getByRole('button',{name:'設定',exact:true}).click();await p.selectOption('#quality','high');
 for(const n of [50,5,18]){await p.locator('#count').evaluate((e,n)=>{e.value=String(n);e.dispatchEvent(new Event('input',{bubbles:true}));},n);await unique();}
 await p.getByRole('button',{name:'重設水庭 ↺'}).click();await unique();
 await p.reload();await p.waitForFunction(()=>window.__pond?.inspect().time>1);await unique();assert.equal(errors.length,0);
 console.log('PASS: one unique Fuku, fixed pattern after count changes/reset/reload; light pond renders without errors.');
}finally{await browser.close();}
