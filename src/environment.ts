import * as THREE from 'three';
import stoneData from './assets/stones.json';
export class Environment {
  group=new THREE.Group(); private leaves:THREE.Group[]=[];private resources:(THREE.BufferGeometry|THREE.Material)[]=[];
  constructor(private scene:THREE.Scene){scene.add(this.group);}
  private keep<T extends THREE.BufferGeometry|THREE.Material>(r:T):T{this.resources.push(r);return r;}
  rebuild(rx:number,ry:number){
    this.group.traverse(o=>{if(o instanceof THREE.InstancedMesh)o.dispose();});this.resources.forEach(r=>r.dispose());this.resources=[];this.group.clear();this.leaves=[];
    let seed=47;const random=()=>{seed=(seed*16807)%2147483647;return (seed-1)/2147483646;};
    const stoneMaterials=['#626a62','#767c70','#4c5950','#85887d','#546358'].map(color=>{const m=this.keep(new THREE.MeshStandardMaterial({color,roughness:.93}));m.onBeforeCompile=shader=>{shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 stonePosition;').replace('#include <begin_vertex>','#include <begin_vertex>\nstonePosition=position;');shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying vec3 stonePosition;').replace('#include <color_fragment>','#include <color_fragment>\nfloat grain=fract(sin(dot(floor(stonePosition*120.),vec3(127.1,311.7,74.7)))*43758.5453);float veins=sin(stonePosition.x*24.+sin(stonePosition.y*13.)*2.+stonePosition.z*9.);diffuseColor.rgb*=.87+grain*.2+veins*.025;');};return m;});
    const rockGeometries=stoneData.map(data=>{const g=this.keep(new THREE.BufferGeometry());g.setAttribute('position',new THREE.Float32BufferAttribute(data.position,3));g.setAttribute('normal',new THREE.Float32BufferAttribute(data.normal,3));g.setIndex(data.index);return g;});
    const rockMatrices:THREE.Matrix4[][]=Array.from({length:35},()=>[]);
    for(let ring=0;ring<3;ring++)for(let i=0;i<76;i++){
      const a=i/76*Math.PI*2+random()*.025;const r=1+ring*.085+.018*Math.sin(a*7);const o=new THREE.Object3D();o.position.set(Math.cos(a)*(rx+.5)*r,Math.sin(a)*(ry+.5)*r,-.15+ring*.13);o.rotation.set(random()*.3,random()*.3,random()*6);const s=.45+random()*.5;o.scale.set(s*(1.2+random()),s,s*(.5+random()*.35));o.updateMatrix();rockMatrices[(i%7)*5+i%5].push(o.matrix.clone());
    }
    rockMatrices.forEach((matrices,i)=>{if(!matrices.length)return;const mesh=new THREE.InstancedMesh(rockGeometries[Math.floor(i/5)],stoneMaterials[i%5],matrices.length);matrices.forEach((m,j)=>mesh.setMatrixAt(j,m));mesh.computeBoundingSphere();this.group.add(mesh);});
    const pebbleGeo=this.keep(new THREE.IcosahedronGeometry(1,1));const pebbleMat=this.keep(new THREE.MeshStandardMaterial({color:'#647d61',roughness:1}));
    const pebbles=new THREE.InstancedMesh(pebbleGeo,pebbleMat,320);const dummy=new THREE.Object3D();
    for(let i=0;i<320;i++){const a=random()*Math.PI*2,r=.58+Math.sqrt(random())*.43;dummy.position.set(Math.cos(a)*rx*r,Math.sin(a)*ry*r,-1.96);const s=.02+random()*.055;dummy.scale.set(s*1.4,s,.017);dummy.rotation.z=random()*6;dummy.updateMatrix();pebbles.setMatrixAt(i,dummy.matrix);}this.group.add(pebbles);
    const leafMat=this.keep(new THREE.MeshStandardMaterial({color:'#4e7842',roughness:.7,side:THREE.DoubleSide}));const veinMat=this.keep(new THREE.LineBasicMaterial({color:'#91a364',transparent:true,opacity:.34}));
    const leafShape=new THREE.Shape();leafShape.moveTo(0,0);for(let i=0;i<=52;i++){const a=.18+i/52*(Math.PI*2-.36);const r=1+.035*Math.sin(a*9);leafShape.lineTo(Math.cos(a)*r,Math.sin(a)*r);}leafShape.lineTo(0,0);
    const leafGeo=this.keep(new THREE.ShapeGeometry(leafShape,48));const shadowMat=this.keep(new THREE.MeshBasicMaterial({color:'#062b22',transparent:true,opacity:.23,depthWrite:false}));
    for(const [cx,cy,count] of [[-.73,.61,7],[.78,-.55,5],[-.87,-.32,3]]){
      for(let i=0;i<count;i++){
        const x=cx*rx+(random()-.5)*2.5,y=cy*ry+(random()-.5)*2.5;
        const leaf=new THREE.Group();const s=.48+random()*.43;leaf.position.set(x,y,.12+random()*.035);leaf.rotation.z=random()*6;leaf.scale.setScalar(s);leaf.add(new THREE.Mesh(leafGeo,leafMat));
        const lines:number[]=[];for(let j=0;j<15;j++){const a=.25+j/15*5.8;lines.push(0,0,.018,Math.cos(a)*.93,Math.sin(a)*.93,.018);}const vg=this.keep(new THREE.BufferGeometry());vg.setAttribute('position',new THREE.Float32BufferAttribute(lines,3));leaf.add(new THREE.LineSegments(vg,veinMat));this.group.add(leaf);this.leaves.push(leaf);
        const sh=new THREE.Mesh(leafGeo,shadowMat);sh.position.set(x+.2,y-.17,-1.7);sh.rotation.z=leaf.rotation.z;sh.scale.setScalar(s*1.05);this.group.add(sh);
      }
      this.flower(cx*rx+.3,cy*ry+.35,cx>0?'#f1eddb':'#e7adc0');
    }
    const reedMat=this.keep(new THREE.MeshStandardMaterial({color:'#315d39',side:THREE.DoubleSide,roughness:1}));
    const grassPos:number[]=[];
    for(let cluster=0;cluster<12;cluster++){
      const a=cluster/12*Math.PI*2+.2,cx=Math.cos(a)*rx*.94,cy=Math.sin(a)*ry*.94;
      for(let i=0;i<16;i++){const x=cx+(random()-.5)*.8,y=cy+(random()-.5)*.8,h=.3+random()*1.1,b=(random()-.5)*.5;grassPos.push(x-.035,y,-1.6,x+.035,y,-1.6,x+b,y+.1,-1.6+h);}
    }
    const gg=this.keep(new THREE.BufferGeometry());gg.setAttribute('position',new THREE.Float32BufferAttribute(grassPos,3));gg.computeVertexNormals();this.group.add(new THREE.Mesh(gg,reedMat));
  }
  private flower(x:number,y:number,color:string){
    const flower=new THREE.Group();flower.position.set(x,y,.28);
    const petalMat=this.keep(new THREE.MeshStandardMaterial({color,roughness:.58,side:THREE.DoubleSide}));
    const pos:number[]=[],idx:number[]=[];
    for(let i=0;i<=12;i++){const t=i/12,w=Math.sin(t*Math.PI)*.18;pos.push(t*.68,-w,Math.sin(t*Math.PI*.85)*.20,t*.68,w,Math.sin(t*Math.PI*.85)*.20);if(i<12){const j=i*2;idx.push(j,j+2,j+1,j+1,j+2,j+3);}}
    const g=this.keep(new THREE.BufferGeometry());g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setIndex(idx);g.computeVertexNormals();
    for(let layer=0;layer<3;layer++)for(let i=0;i<9;i++){const p=new THREE.Mesh(g,petalMat);p.rotation.z=i/9*Math.PI*2+layer*.32;p.scale.setScalar(1-layer*.2);p.rotation.y=-layer*.2;p.position.z=layer*.065;flower.add(p);}
    const heart=new THREE.Mesh(this.keep(new THREE.SphereGeometry(.13,12,8)),this.keep(new THREE.MeshStandardMaterial({color:'#dcb759',roughness:.8})));heart.position.z=.22;heart.scale.z=.6;flower.add(heart);this.group.add(flower);
  }
  update(time:number){this.leaves.forEach((l,i)=>{l.rotation.x=Math.sin(time*.65+i)*.018;l.rotation.y=Math.cos(time*.53+i)*.018;});}
  dispose(){this.group.traverse(o=>{if(o instanceof THREE.InstancedMesh)o.dispose();});this.resources.forEach(r=>r.dispose());this.group.clear();}
}
