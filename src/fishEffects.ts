import * as THREE from 'three';

/** Fixed particle pool for fish entering and leaving the water. */
export class FishEffects {
  private readonly capacity = 384;
  private particles = Array.from({ length: this.capacity }, () => ({ x:0,y:0,z:0,vx:0,vy:0,vz:0,age:2,life:1,size:0 }));
  private positions = new Float32Array(this.capacity * 3);
  private sizes = new Float32Array(this.capacity);
  private alpha = new Float32Array(this.capacity);
  private cursor = 0;
  private geometry = new THREE.BufferGeometry();
  private material: THREE.ShaderMaterial;
  private mesh: THREE.Points;
  bursts = 0;
  constructor(scene: THREE.Scene) {
    this.geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3).setUsage(THREE.DynamicDrawUsage));
    this.geometry.setAttribute('particleSize', new THREE.BufferAttribute(this.sizes, 1).setUsage(THREE.DynamicDrawUsage));
    this.geometry.setAttribute('alpha', new THREE.BufferAttribute(this.alpha, 1).setUsage(THREE.DynamicDrawUsage));
    this.material = new THREE.ShaderMaterial({
      vertexShader: `attribute float particleSize,alpha;uniform float pixelRatio;varying float opacity;void main(){opacity=alpha;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);gl_PointSize=particleSize*pixelRatio;}`,
      fragmentShader: `varying float opacity;void main(){float d=length(gl_PointCoord-.5)*2.;if(d>1.)discard;float edge=1.-smoothstep(.45,1.,d);gl_FragColor=vec4(.75,.9,.82,edge*opacity);}`,
      uniforms: { pixelRatio: { value: Math.min(devicePixelRatio, 2) } },
      transparent: true, depthWrite: false, depthTest: false,
    });
    this.mesh = new THREE.Points(this.geometry, this.material);
    this.mesh.frustumCulled = false; this.mesh.renderOrder = 8; scene.add(this.mesh);
  }
  burst(x:number,y:number,added:boolean) {
    this.bursts++;
    const count = added ? 18 : 8;
    for(let i=0;i<count;i++) {
      const p=this.particles[this.cursor++%this.capacity], angle=Math.random()*Math.PI*2;
      const speed=(added?.5:.2)+Math.random()*(added?1.2:.5);
      p.x=x;p.y=y;p.z=.1;p.vx=Math.cos(angle)*speed;p.vy=Math.sin(angle)*speed;
      p.vz=added?1+Math.random()*1.5:.3+Math.random()*.5;
      p.age=0;p.life=added?.7+Math.random()*.45:.65+Math.random()*.35;p.size=2+Math.random()*3;
    }
  }
  update(dt:number) {
    for(let i=0;i<this.capacity;i++){
      const p=this.particles[i];p.age+=dt;
      if(p.age<p.life){p.x+=p.vx*dt;p.y+=p.vy*dt;p.z+=p.vz*dt;p.vz-=4*dt;this.positions[i*3]=p.x;this.positions[i*3+1]=p.y+p.z*.38;this.positions[i*3+2]=Math.max(.1,p.z);this.sizes[i]=p.size;this.alpha[i]=Math.pow(1-p.age/p.life,1.4)*.65;}else{this.alpha[i]=0;this.sizes[i]=0;}
    }
    this.geometry.getAttribute('position').needsUpdate=true;this.geometry.getAttribute('particleSize').needsUpdate=true;this.geometry.getAttribute('alpha').needsUpdate=true;
  }
  reset(){this.particles.forEach(p=>p.age=2);this.update(0);}
  dispose(){this.geometry.dispose();this.material.dispose();this.mesh.removeFromParent();}
}
