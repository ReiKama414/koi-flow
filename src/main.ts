import * as THREE from 'three';
import './style.css';
import { readSettings } from './settings';
import type { Settings } from './settings';
import { createFishGeometry, createFishMaterial, createShadowMaterial } from './fishGeometry';
import { FishBehaviorSystem } from './behavior';
import { WaterSimulation } from './water';
import { Environment } from './environment';
import { FoodSystem } from './food';
import { InteractionController } from './interaction';
import { PondAudio } from './audio';
import { PerformanceController } from './performance';
import { UI } from './ui';
import { FishEffects } from './fishEffects';
import { renderFishPreviews } from './fishPreviews';

class Pond {
  settings=readSettings();scene=new THREE.Scene();camera=new THREE.OrthographicCamera(-14,14,9,-9,.1,100);
  renderer:THREE.WebGLRenderer;behavior=new FishBehaviorSystem();water:WaterSimulation;environment:Environment;food:FoodSystem;
  audio=new PondAudio();performance:PerformanceController;interaction:InteractionController;ui:UI;
  fishEffects:FishEffects;
  private retiring:{fish:THREE.Mesh<THREE.BufferGeometry,THREE.ShaderMaterial>;shadow:THREE.Mesh<THREE.BufferGeometry,THREE.ShaderMaterial>;age:number;z:number}[]=[];
  private lastCountEffect=-10;
  geometry=createFishGeometry();shadowGeometry=new THREE.PlaneGeometry(4.5,2);fish:THREE.Mesh<THREE.BufferGeometry,THREE.ShaderMaterial>[]=[];shadows:THREE.Mesh<THREE.BufferGeometry,THREE.ShaderMaterial>[]=[];
  time=0;private previous=0;private frame=0;private wakeTime=0;private statusTime=0;private disposed=false;private paused=false;private abort=new AbortController();private wake=new THREE.Vector2();
  constructor(canvas:HTMLCanvasElement,private atlas:THREE.Texture){
    const gl=canvas.getContext('webgl2',{antialias:true,alpha:false,powerPreference:'high-performance'});
    if(!gl)throw new Error('此裝置無法初始化 WebGL2。請啟用瀏覽器硬體加速，或使用支援 WebGL2 的瀏覽器。');
    this.renderer=new THREE.WebGLRenderer({canvas,context:gl,antialias:true});this.renderer.setClearColor('#183e33');this.renderer.outputColorSpace=THREE.SRGBColorSpace;this.renderer.toneMapping=THREE.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.1;
    this.camera.position.set(0,0,30);this.camera.lookAt(0,0,0);
    this.scene.add(new THREE.HemisphereLight('#eef0d9','#235246',2.3));const sun=new THREE.DirectionalLight('#fff4d7',3);sun.position.set(-7,9,15);this.scene.add(sun);
    this.performance=new PerformanceController(()=>this.applyQuality());
    this.water=new WaterSimulation(this.renderer,this.scene,this.performance.resolution);
    this.environment=new Environment(this.scene);this.food=new FoodSystem(this.scene);this.fishEffects=new FishEffects(this.scene);
    this.ui=new UI(document.querySelector('#ui')!,this.settings,k=>this.settingChanged(k),mode=>{this.interaction.mode=mode;canvas.style.cursor=mode==='feed'?'crosshair':'default';},()=>this.reset());
    this.interaction=new InteractionController(canvas,this.camera,{
      disturb:(p,a)=>{this.water.disturb(p,a);if(a>.3)this.audio.splash(a);},
      feed:p=>{this.food.drop(p);this.water.disturb(p,.5,.19);this.audio.splash(.8);},
      scare:(p,s)=>this.behavior.agents.forEach(a=>a.scare(p,s)),attract:p=>this.behavior.curiosity=p,
      gesture:()=>{if(this.settings.sound)void this.audio.setEnabled(true).catch(()=>this.ui.toast('音效目前無法播放'));}
    },p=>Math.hypot(p.x/this.behavior.rx,p.y/this.behavior.ry)<.97);
    this.resize();this.performance.setQuality(this.settings.quality);this.water.strength=this.settings.ripple;
    this.refreshFishPreviews();
    const opts={signal:this.abort.signal};window.addEventListener('resize',this.resize,opts);document.addEventListener('visibilitychange',()=>{this.previous=0;this.paused=document.hidden;if(document.hidden)void this.audio.setEnabled(false);else if(this.settings.sound&&this.audio.inspect().loaded)void this.audio.setEnabled(true).catch(()=>this.ui.toast('配樂目前無法恢復'));},opts);
    canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();this.paused=true;this.ui.toast('圖形連線暫停，正在等待瀏覽器恢復…');},opts);
    canvas.addEventListener('webglcontextrestored',()=>location.reload(),opts);
    window.addEventListener('pagehide',()=>this.dispose(),opts);
    this.frame=requestAnimationFrame(this.tick);
    setTimeout(()=>document.querySelector('#loading')?.classList.add('done'),400);
  }
  private setFishCount(animate=false){const count=this.settings.quality==='auto'?Math.min(this.settings.count,this.performance.fishLimit):this.settings.count;const before=this.fish.length;const emit=animate&&this.time-this.lastCountEffect>.12;let budget=8;this.behavior.setCount(count);
    while(this.fish.length<count){const a=this.behavior.agents[this.fish.length];const fish=new THREE.Mesh(this.geometry,createFishMaterial(a.variety,a.seed,this.atlas));fish.scale.setScalar(a.size);fish.position.z=-.48-a.seed*.32;this.scene.add(fish);this.fish.push(fish);
      const shadow=new THREE.Mesh(this.shadowGeometry,createShadowMaterial());shadow.scale.set(a.size*1.05,a.size*1.05,1);shadow.position.z=-1.78;this.scene.add(shadow);this.shadows.push(shadow);
      if(animate){fish.userData.enteredAt=this.time;fish.material.uniforms.opacity.value=0;fish.material.depthWrite=false;if(emit&&budget-->0){this.water.disturb(a.position,.7,.26);this.fishEffects.burst(a.position.x,a.position.y,true);}}
    }
    while(this.fish.length>count){const f=this.fish.pop()!,s=this.shadows.pop()!;if(animate){f.material.depthWrite=false;this.retiring.push({fish:f,shadow:s,age:0,z:f.position.z});if(emit&&budget-->0){this.wake.set(f.position.x,f.position.y);this.water.disturb(this.wake,.3,.18);this.fishEffects.burst(f.position.x,f.position.y,false);}}else{this.scene.remove(f,s);f.material.dispose();s.material.dispose();}}
    while(this.retiring.length>50){const old=this.retiring.shift()!;this.scene.remove(old.fish,old.shadow);old.fish.material.dispose();old.shadow.material.dispose();}
    if(emit&&before!==count){this.lastCountEffect=this.time;if(this.settings.sound)void this.audio.setEnabled(true).then(()=>this.audio.fishChange(count>before,Math.abs(count-before))).catch(()=>this.ui.toast('音效目前無法播放'));}
    if(animate&&(before<6||count<6))this.refreshFishPreviews();
  }
  private applyQuality(){this.renderer.setPixelRatio(this.performance.ratio);this.renderer.setSize(innerWidth,innerHeight,false);this.water.setQuality(this.performance.resolution);this.water.bottom.material.uniforms.detail.value=this.performance.tier==='low'?.45:1;this.shadows.forEach(s=>s.visible=this.performance.tier!=='low');this.setFishCount();}
  private settingChanged(key:keyof Settings){if(key==='count')this.setFishCount(true);if(key==='ripple')this.water.strength=this.settings.ripple;if(key==='quality')this.performance.setQuality(this.settings.quality);if(key==='sound')void this.audio.setEnabled(this.settings.sound).catch(()=>{this.ui.toast('配樂載入失敗，請再次開啟音效重試');});}
  private reset(){this.clearRetiring();this.fishEffects.reset();this.food.reset();this.behavior.agents=[];this.fish.forEach(f=>{this.scene.remove(f);f.material.dispose();});this.shadows.forEach(f=>{this.scene.remove(f);f.material.dispose();});this.fish=[];this.shadows=[];this.performance.setQuality(this.settings.quality);this.refreshFishPreviews();this.water.strength=this.settings.ripple;void this.audio.setEnabled(false);this.interaction.mode='interact';document.querySelector<HTMLButtonElement>('[data-action="interact"]')?.click();}
  private clearRetiring(){for(const r of this.retiring){this.scene.remove(r.fish,r.shadow);r.fish.material.dispose();r.shadow.material.dispose();}this.retiring=[];}
  private refreshFishPreviews(){this.ui.setFishPreviews(renderFishPreviews(this.renderer,this.geometry,this.atlas,Array.from({length:7},(_,variety)=>this.behavior.agents.find(a=>a.variety===variety)?.seed??.5)));}
  private resize=()=>{const aspect=innerWidth/innerHeight;const w=aspect<.8?18:aspect<1.2?23:29;const h=w/aspect;this.camera.left=-w/2;this.camera.right=w/2;this.camera.top=h/2;this.camera.bottom=-h/2;this.camera.updateProjectionMatrix();this.renderer.setSize(innerWidth,innerHeight,false);this.behavior.setBounds(w*.53,h*.57);this.water.resize(w*1.4,h*1.4);this.environment.rebuild(this.behavior.rx,this.behavior.ry);
    for(const a of this.behavior.agents){const r=Math.hypot(a.position.x/(this.behavior.rx-a.size*1.6),a.position.y/(this.behavior.ry-a.size*1.6));if(r>.92)a.position.multiplyScalar(.92/r);}
  };
  private tick=(now:number)=>{if(this.disposed)return;this.frame=requestAnimationFrame(this.tick);if(this.paused){this.previous=0;return;}const raw=this.previous?(now-this.previous)/1000:1/60;this.previous=now;const dt=Math.min(raw,.06);this.time+=dt;
    const steps=Math.ceil(dt/(1/60));for(let i=0;i<steps;i++)this.behavior.update(dt/steps,this.settings.speed,this.food.pellets);
    for(let i=0;i<this.fish.length;i++){const a=this.behavior.agents[i],f=this.fish[i],s=this.shadows[i];f.position.x=a.position.x;f.position.y=a.position.y;f.rotation.z=a.direction;f.rotation.x=Math.sin(this.time+a.seed*9)*.025;f.position.z=-.49-a.seed*.25+Math.sin(this.time*.8+a.seed*5)*.07;s.position.x=a.position.x+.28;s.position.y=a.position.y-.26;s.rotation.z=a.direction;s.visible=this.performance.tier!=='low';
      f.material.uniforms.time.value+=dt*(1.9+a.velocity.length()*1.5);f.material.uniforms.bend.value=-a.turn*.4;
      if(typeof f.userData.enteredAt==='number'){const progress=Math.min(1,(this.time-f.userData.enteredAt)/1.25);f.material.uniforms.opacity.value=Math.min(1,progress*2);f.position.z+=(1-progress)*(1-progress)*.8;s.material.uniforms.opacity.value=progress;if(progress===1){delete f.userData.enteredAt;f.material.depthWrite=true;}}
    }
    for(let i=this.retiring.length-1;i>=0;i--){const r=this.retiring[i];r.age+=dt;const t=Math.min(1,r.age/1.1);r.fish.position.z=r.z-t*.85;r.fish.position.x+=Math.cos(r.fish.rotation.z)*dt*.3;r.fish.position.y+=Math.sin(r.fish.rotation.z)*dt*.3;r.fish.material.uniforms.opacity.value=(1-t)*(1-t);r.fish.material.uniforms.time.value+=dt*2;r.shadow.material.uniforms.opacity.value=1-t;if(t===1){this.scene.remove(r.fish,r.shadow);r.fish.material.dispose();r.shadow.material.dispose();this.retiring.splice(i,1);}}
    this.fishEffects.update(dt);
    this.wakeTime+=dt;if(this.wakeTime>.19){this.wakeTime=0;for(let i=0;i<this.behavior.agents.length;i+=this.performance.tier==='low'?2:1){const a=this.behavior.agents[i];this.wake.set(a.position.x-Math.cos(a.direction)*a.size*1.7,a.position.y-Math.sin(a.direction)*a.size*1.7);this.water.disturb(this.wake,.018,.15,false);}}
    this.food.update(dt,this.behavior.agents,this.time);this.environment.update(this.time);this.water.update(dt,this.time);this.water.render(this.scene,this.camera);this.performance.update(raw,this.settings.quality);
    this.statusTime+=dt;if(this.statusTime>1){this.statusTime=0;this.ui.status(this.fish.length,this.performance.fps,this.performance.tier);}
  };
  inspect(){return {audio:this.audio.inspect(),entering:this.fish.filter(f=>typeof f.userData.enteredAt==='number').length,retiring:this.retiring.length,effectBursts:this.fishEffects.bursts,webgl2:true,gpuWater:this.water.gpu,simulationSize:this.water.size,time:this.time,fps:this.performance.fps,tier:this.performance.tier,count:this.fish.length,ripples:this.water.interactionCount,animationPhase:this.fish[0]?.material.uniforms.time.value,food:this.food.pellets.filter(f=>f.active).length,foodPositions:this.food.pellets.filter(f=>f.active).map(f=>({x:f.position.x,y:f.position.y})),consumed:this.food.consumed,bounds:{rx:this.behavior.rx,ry:this.behavior.ry},fish:this.behavior.agents.map(a=>({x:a.position.x,y:a.position.y,direction:a.direction,state:a.state,size:a.size,turn:a.turn,variety:a.variety,patternSeed:a.seed,name:a.variety===6?'福錦':null})),drawCalls:this.renderer.info.render.calls,geometries:this.renderer.info.memory.geometries,textures:this.renderer.info.memory.textures};}
  dispose(){if(this.disposed)return;this.disposed=true;cancelAnimationFrame(this.frame);this.abort.abort();this.interaction.dispose();this.ui.dispose();this.audio.dispose();this.clearRetiring();this.fishEffects.dispose();this.water.dispose();this.environment.dispose();this.food.dispose();this.geometry.dispose();this.shadowGeometry.dispose();this.atlas.dispose();this.fish.forEach(f=>f.material.dispose());this.shadows.forEach(f=>f.material.dispose());this.renderer.dispose();}
}
async function start(){try{const atlas=await new THREE.TextureLoader().loadAsync('/images/koi-varieties.png');const pond=new Pond(document.querySelector<HTMLCanvasElement>('#pond')!,atlas);Object.defineProperty(window,'__pond',{value:{inspect:()=>pond.inspect()},configurable:true});if(import.meta.hot)import.meta.hot.dispose(()=>pond.dispose());}
catch(error){console.error(error);const loading=document.querySelector('#loading')!;loading.innerHTML='';const box=document.createElement('div');box.className='error-message';const title=document.createElement('h2');title.textContent='水庭暫時無法開啟';const p=document.createElement('p');p.textContent=error instanceof Error?error.message:'請更新瀏覽器後再試一次。';const button=document.createElement('button');button.textContent='重新載入';button.onclick=()=>location.reload();box.append(title,p,button);loading.append(box);}

}
void start();
