import * as THREE from 'three';
export interface InteractionActions { disturb:(p:THREE.Vector2,a:number)=>void; feed:(p:THREE.Vector2)=>void; scare:(p:THREE.Vector2,s:number)=>void; attract:(p:THREE.Vector2|null)=>void; gesture:()=>void }
export class InteractionController {
  mode:'interact'|'feed'='interact';private ray=new THREE.Raycaster();private plane=new THREE.Plane(new THREE.Vector3(0,0,1),0);private ndc=new THREE.Vector2();private hit=new THREE.Vector3();private world=new THREE.Vector2();private last=new THREE.Vector2();private down=new THREE.Vector2();private pressed=false;private activePointer:number|null=null;private lastTime=0;private lastRipple=0;private timer:ReturnType<typeof setTimeout>|null=null;private long=false;private moved=false;private abort=new AbortController();
  constructor(private canvas:HTMLCanvasElement,private camera:THREE.Camera,private actions:InteractionActions,private valid:(p:THREE.Vector2)=>boolean){
    const options={signal:this.abort.signal};canvas.addEventListener('pointerdown',this.onDown,options);canvas.addEventListener('pointermove',this.onMove,options);canvas.addEventListener('pointerup',this.onUp,options);canvas.addEventListener('pointercancel',this.cancel,options);canvas.addEventListener('lostpointercapture',this.cancel,options);canvas.addEventListener('contextmenu',e=>e.preventDefault(),options);
  }
  private point(e:PointerEvent){const r=this.canvas.getBoundingClientRect();this.ndc.set((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1);this.ray.setFromCamera(this.ndc,this.camera);this.ray.ray.intersectPlane(this.plane,this.hit);this.world.set(this.hit.x,this.hit.y);return this.world;}
  private onDown=(e:PointerEvent)=>{if(this.activePointer!==null||!e.isPrimary)return;e.preventDefault();this.activePointer=e.pointerId;this.canvas.setPointerCapture(e.pointerId);const p=this.point(e);this.pressed=true;this.long=false;this.moved=false;this.down.set(e.clientX,e.clientY);this.last.copy(p);this.lastTime=e.timeStamp;this.actions.gesture();if(!this.valid(p))return;
    this.actions.disturb(p,.32);if(this.mode==='feed'){this.actions.feed(p);return;}
    this.timer=setTimeout(()=>{this.long=true;this.actions.attract(this.world);},600);
  };
  private onMove=(e:PointerEvent)=>{if(!e.isPrimary||(this.activePointer!==null&&e.pointerId!==this.activePointer))return;const p=this.point(e);const dt=(e.timeStamp-this.lastTime)/1000;const velocity=dt>.005&&dt<.15?p.distanceTo(this.last)/dt:0;
    if(this.pressed&&Math.hypot(this.down.x-e.clientX,this.down.y-e.clientY)>12){this.moved=true;if(this.timer)clearTimeout(this.timer);if(this.long)this.actions.attract(p);}
    if(this.valid(p)){if(e.timeStamp-this.lastRipple>40){this.actions.disturb(p,this.pressed?.12:.035);this.lastRipple=e.timeStamp;}if(this.pressed&&velocity>14){this.actions.scare(p,Math.min(velocity/15,3));this.actions.attract(null);}}
    this.last.copy(p);this.lastTime=e.timeStamp;
  };
  private onUp=(e:PointerEvent)=>{if(e.pointerId!==this.activePointer)return;const p=this.point(e);if(this.valid(p)&&this.mode==='interact'&&!this.moved&&!this.long)this.actions.disturb(p,.65);this.cancel();if(this.canvas.hasPointerCapture(e.pointerId))this.canvas.releasePointerCapture(e.pointerId);};
  private cancel=()=>{this.pressed=false;this.activePointer=null;if(this.timer)clearTimeout(this.timer);this.timer=null;this.actions.attract(null);};
  dispose(){this.cancel();this.abort.abort();}
}
