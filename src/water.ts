import * as THREE from 'three';
const quadVertex=`varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}`;
const noiseGLSL=`float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+1.),f.x),f.y);}`;
export class WaterSimulation {
  size:number; gpu:boolean; private targets:THREE.WebGLRenderTarget[]=[]; private index=0; private accumulated=0;
  private simScene=new THREE.Scene(); private camera=new THREE.Camera(); private simMaterial:THREE.ShaderMaterial;
  private sources=Array.from({length:16},()=>new THREE.Vector4(0,0,0,0)); private sourceIndex=0;
  private rings=Array.from({length:40},()=>new THREE.Vector4(0,0,-100,0));private ringIndex=0;
  private refraction=new THREE.WebGLRenderTarget(1,1,{depthBuffer:true});
  surface:THREE.Mesh<THREE.PlaneGeometry,THREE.ShaderMaterial>; bottom:THREE.Mesh<THREE.PlaneGeometry,THREE.ShaderMaterial>;
  width=30;height=22;time=0;strength=1;interactionCount=0; private empty=new THREE.DataTexture(new Float32Array(4),1,1,THREE.RGBAFormat,THREE.FloatType);
  constructor(private renderer:THREE.WebGLRenderer,scene:THREE.Scene,size:number){
    this.size=size;this.gpu=renderer.extensions.has('EXT_color_buffer_float');this.empty.needsUpdate=true;
    this.simMaterial=new THREE.ShaderMaterial({vertexShader:quadVertex,fragmentShader:`varying vec2 vUv;uniform sampler2D previous;uniform vec2 pixel,aspect;uniform vec4 sources[16];void main(){vec2 h=texture2D(previous,vUv).rg;float avg=(texture2D(previous,vUv+vec2(pixel.x,0.)).r+texture2D(previous,vUv-vec2(pixel.x,0.)).r+texture2D(previous,vUv+vec2(0.,pixel.y)).r+texture2D(previous,vUv-vec2(0.,pixel.y)).r)*.25;float velocity=(h.g+(avg-h.r)*1.75)*.987;float height=(h.r+velocity)*.998;for(int i=0;i<16;i++){float d=length((vUv-sources[i].xy)*aspect);height+=exp(-d*d/max(.000001,sources[i].w))*sources[i].z;}float edge=smoothstep(0.,.025,min(min(vUv.x,vUv.y),min(1.-vUv.x,1.-vUv.y)));gl_FragColor=vec4(clamp(height,-1.,1.)*edge,velocity*edge,0.,1.);}`,uniforms:{previous:{value:this.empty},pixel:{value:new THREE.Vector2(1/size,1/size)},aspect:{value:new THREE.Vector2(1,1)},sources:{value:this.sources}},depthTest:false,depthWrite:false});
    this.simScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2,2),this.simMaterial));
    this.allocate(size);
    const vertex=`varying vec2 vUv;varying vec2 world;void main(){vUv=uv;vec4 p=modelMatrix*vec4(position,1.);world=p.xy;gl_Position=projectionMatrix*viewMatrix*p;}`;
    const surfaceMat=new THREE.ShaderMaterial({vertexShader:vertex,fragmentShader:`varying vec2 vUv;varying vec2 world;uniform sampler2D heightmap,sceneTexture;uniform float time,strength;uniform vec2 pixel,screenSize,pondBounds;uniform vec4 rings[40];${noiseGLSL}
      void main(){float edge=length(world/pondBounds);if(edge>1.015)discard;
      float dx=texture2D(heightmap,vUv+vec2(pixel.x,0.)).r-texture2D(heightmap,vUv-vec2(pixel.x,0.)).r;float dy=texture2D(heightmap,vUv+vec2(0.,pixel.y)).r-texture2D(heightmap,vUv-vec2(0.,pixel.y)).r;
      vec2 radial=vec2(0.);float ring=0.;for(int i=0;i<40;i++){float age=time-rings[i].z;if(age>=0.&&age<5.){vec2 offset=world-rings[i].xy;float d=length(offset);float front=d-age*1.35;float wave=cos(front*19.)*exp(-front*front*5.)*exp(-age*.85)*rings[i].w;radial+=offset/max(d,.01)*wave;ring+=wave;}}
      vec2 wind=vec2(sin(world.x*.85+world.y*.45+time*.38),cos(world.y*.95-world.x*.5-time*.31));wind+=vec2(sin(world.y*2.1+time*.45),cos(world.x*1.8-time*.35))*.25;
      vec2 slope=vec2(dx,dy)*2.2+radial*.13+wind*.019*strength;
      vec3 normal=normalize(vec3(-slope,1.));float spec=pow(max(dot(normal,normalize(vec3(.10,.14,1.))),0.),210.);
      vec2 screen=gl_FragCoord.xy/screenSize;vec2 refractUv=clamp(screen+slope*.026,vec2(.002),vec2(.998));vec3 below=texture2D(sceneTexture,refractUv).rgb;
      float clouds=noise(world*.20+wind*.1+time*.008)*.55+noise(world*.43+time*.006)*.25;
      float canopy=smoothstep(.45,.75,noise(world*.40+wind*.15))*smoothstep(.5,1.1,edge)*.14;
      vec3 reflection=mix(vec3(.22,.37,.32),vec3(.74,.81,.73),clouds);
      float fresnel=.028+pow(1.-normal.z,2.)*.8;
      vec3 color=mix(below*vec3(.93,1.,.98),reflection,fresnel+canopy);color+=vec3(.81,.88,.72)*spec*.10+max(ring,0.)*.013;
      gl_FragColor=vec4(color,1.);}`,uniforms:{heightmap:{value:this.texture},sceneTexture:{value:this.refraction.texture},screenSize:{value:new THREE.Vector2(1,1)},pondBounds:{value:new THREE.Vector2(14,10)},time:{value:0},strength:{value:1},pixel:{value:new THREE.Vector2(1/size,1/size)},rings:{value:this.rings}},transparent:true,depthWrite:false});
    this.surface=new THREE.Mesh(new THREE.PlaneGeometry(1,1),surfaceMat);this.surface.position.z=.06;this.surface.renderOrder=5;scene.add(this.surface);
    const bottomMat=new THREE.ShaderMaterial({vertexShader:vertex,fragmentShader:`varying vec2 vUv;varying vec2 world;uniform float time,detail;uniform vec2 bounds;${noiseGLSL}
      void main(){float grain=noise(world*35.)*.018+noise(world*1.5)*.025;float depth=length(world/bounds);vec3 c=mix(vec3(.115,.355,.325),vec3(.30,.455,.35),smoothstep(.3,1.05,depth));c+=grain;
      vec2 p=world*1.1+vec2(sin(world.y*1.4+time*.28),cos(world.x*1.2-time*.22))*.70;
      vec2 cell=floor(p),f=fract(p);float first=8.,second=8.;
      for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++){vec2 offset=vec2(float(x),float(y));vec2 id=cell+offset;vec2 random=vec2(hash(id),hash(id+vec2(19.3,71.7)));vec2 site=.5+.36*sin(time*.32+6.2831*random);float d=length(offset+site-f);if(d<first){second=first;first=d;}else second=min(second,d);}
      float caustic=(1.-smoothstep(.015,.11,second-first))*.055*detail*(.2+.8*noise(world*.65));
      float tree=noise(world*.32+vec2(sin(time*.12)*.03,0.));c*=1.-smoothstep(.35,.78,tree)*smoothstep(.35,1.,depth)*.17;
      c+=vec3(.55,.71,.40)*caustic;gl_FragColor=vec4(c,1.);}`,uniforms:{time:{value:0},bounds:{value:new THREE.Vector2(14,10)},detail:{value:1}}});
    this.bottom=new THREE.Mesh(new THREE.PlaneGeometry(1,1),bottomMat);this.bottom.position.z=-2;scene.add(this.bottom);
  }
  get texture(){return this.gpu?this.targets[this.index].texture:this.empty;}
  private allocate(size:number){this.targets.forEach(t=>t.dispose());this.targets=[];if(this.gpu){const clear=this.renderer.getClearColor(new THREE.Color());this.renderer.setClearColor(0,0);for(let i=0;i<2;i++){const t=new THREE.WebGLRenderTarget(size,size,{type:THREE.HalfFloatType,minFilter:THREE.LinearFilter,magFilter:THREE.LinearFilter,depthBuffer:false,stencilBuffer:false});this.targets.push(t);this.renderer.setRenderTarget(t);this.renderer.clear();}this.renderer.setRenderTarget(null);this.renderer.setClearColor(clear,1);}this.index=0;}
  setQuality(size:number){if(size===this.size)return;this.size=size;this.allocate(size);this.simMaterial.uniforms.pixel.value.set(1/size,1/size);this.surface.material.uniforms.pixel.value.set(1/size,1/size);}
  resize(w:number,h:number){this.width=w;this.height=h;this.surface.scale.set(w,h,1);this.bottom.scale.set(w,h,1);this.simMaterial.uniforms.aspect.value.set(w/h,1);this.bottom.material.uniforms.bounds.value.set(w*.38,h*.407);this.surface.material.uniforms.pondBounds.value.set(w*.37857,h*.40714);}
  render(scene:THREE.Scene,camera:THREE.Camera){const size=this.surface.material.uniforms.screenSize.value as THREE.Vector2;this.renderer.getDrawingBufferSize(size);const scale=this.size<=128?.6:this.size<=256?.8:1;const w=Math.round(size.x*scale),h=Math.round(size.y*scale);if(this.refraction.width!==w||this.refraction.height!==h)this.refraction.setSize(w,h);this.surface.visible=false;this.renderer.setRenderTarget(this.refraction);this.renderer.render(scene,camera);this.surface.visible=true;this.renderer.setRenderTarget(null);this.renderer.render(scene,camera);}
  disturb(p:THREE.Vector2,amplitude:number,radius=.13,visible=true){if(this.strength===0)return;const s=this.sources[this.sourceIndex++%16];s.set(p.x/this.width+.5,p.y/this.height+.5,amplitude*this.strength,radius*radius/(this.height*this.height));if(visible){this.interactionCount++;this.rings[this.ringIndex++%40].set(p.x,p.y,this.time,amplitude*2*this.strength);}}
  update(dt:number,time:number){this.time=time;this.accumulated=Math.min(this.accumulated+dt,.08);
    if(this.gpu){let steps=0;while(this.accumulated>=1/60&&steps++<4){this.simMaterial.uniforms.previous.value=this.texture;this.renderer.setRenderTarget(this.targets[1-this.index]);this.renderer.render(this.simScene,this.camera);this.index=1-this.index;this.accumulated-=1/60;this.sources.forEach(s=>s.z=0);}this.renderer.setRenderTarget(null);}
    this.surface.material.uniforms.heightmap.value=this.texture;this.surface.material.uniforms.time.value=time;this.surface.material.uniforms.strength.value=this.strength;this.bottom.material.uniforms.time.value=time;
  }
  dispose(){this.targets.forEach(t=>t.dispose());this.refraction.dispose();this.simScene.traverse(o=>{if(o instanceof THREE.Mesh)o.geometry.dispose();});this.simMaterial.dispose();this.surface.geometry.dispose();this.surface.material.dispose();this.bottom.geometry.dispose();this.bottom.material.dispose();this.empty.dispose();}
}
