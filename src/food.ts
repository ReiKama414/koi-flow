import * as THREE from 'three';
import type { FishAgent, Attractor } from './behavior';
export class FoodSystem {
  pellets: (Attractor & {life:number; phase:number})[] = Array.from({length:96},()=>({position:new THREE.Vector2(),active:false,life:0,phase:Math.random()*6}));
  mesh:THREE.InstancedMesh; private cursor=0; private dummy=new THREE.Object3D(); consumed=0;
  constructor(scene:THREE.Scene){this.mesh=new THREE.InstancedMesh(new THREE.SphereGeometry(.045,7,5),new THREE.MeshStandardMaterial({color:'#b59654',roughness:.9}),96);this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);this.mesh.frustumCulled=false;scene.add(this.mesh);this.update(0,[],0);}
  drop(p:THREE.Vector2){for(let i=0;i<6;i++){const f=this.pellets[this.cursor++%96];const a=Math.random()*Math.PI*2,r=Math.random()*.34;f.position.set(p.x+Math.cos(a)*r,p.y+Math.sin(a)*r);f.active=true;f.life=20;}}
  update(dt:number,fish:FishAgent[],time:number){
    for(let i=0;i<this.pellets.length;i++){const f=this.pellets[i];
      if(f.active){f.life-=dt;f.position.x+=Math.sin(time*.4+f.phase)*dt*.018;f.position.y+=dt*.009;
        for(const a of fish){const mouthX=a.position.x+Math.cos(a.direction)*a.size,mouthY=a.position.y+Math.sin(a.direction)*a.size;if((mouthX-f.position.x)**2+(mouthY-f.position.y)**2<.3**2){f.active=false;this.consumed++;break;}}
        if(f.life<=0)f.active=false;
      }
      this.dummy.position.set(f.position.x,f.position.y,-.035+Math.sin(time*2+f.phase)*.015-Math.max(0,4-f.life)*.05);this.dummy.scale.setScalar(f.active?1:0);this.dummy.updateMatrix();this.mesh.setMatrixAt(i,this.dummy.matrix);
    }this.mesh.instanceMatrix.needsUpdate=true;
  }
  reset(){this.pellets.forEach(f=>f.active=false);this.consumed=0;}
  dispose(){this.mesh.dispose();this.mesh.geometry.dispose();(this.mesh.material as THREE.Material).dispose();}
}
