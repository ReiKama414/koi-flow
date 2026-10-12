import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import anatomy from './assets/koi-anatomy.json';

function tag(g: THREE.BufferGeometry, kind: number) { g.setAttribute('kind', new THREE.Float32BufferAttribute(new Float32Array(g.getAttribute('position').count).fill(kind), 1)); return g; }
export function createFishGeometry() {
  const parts:THREE.BufferGeometry[]=anatomy.map(data=>{const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(data.position,3));g.setAttribute('normal',new THREE.Float32BufferAttribute(data.normal,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(data.uv,2));g.setIndex(data.index);return tag(g,data.kind);});
  for(const sign of [-1,1]) {
    const eye=new THREE.SphereGeometry(.057,10,8); eye.translate(.77,sign*.225,.16); parts.push(tag(eye,2));
    const iris=new THREE.SphereGeometry(.022,8,6); iris.translate(.79,sign*.238,.201); parts.push(tag(iris,3));
    const barbel=new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(1.02,sign*.1,-.04),new THREE.Vector3(1.1,sign*.18,-.065),new THREE.Vector3(.96,sign*.26,-.085)]),8,.009,4,false);parts.push(tag(barbel,5));
  }
  const mouth=new THREE.TorusGeometry(.067,.023,6,12); mouth.rotateY(Math.PI/2); mouth.translate(1.1,0,-.045); parts.push(tag(mouth,5));
  const g=mergeGeometries(parts); parts.forEach(p=>p.dispose()); g.computeBoundingSphere(); return g;
}
const vertex = /* glsl */`
attribute float kind;
uniform float time, phase, pace, bend, variety;
varying vec3 vNormal; varying vec3 vPos; varying vec2 vUv; varying float vKind;
void main(){
 vec3 p=position; float tail=clamp((.65-p.x)/2.65,0.,1.);
 if(variety>5.5&&p.x<-.9)p.x=-.9+(p.x+.9)*1.13;
 float wave=sin(time+phase+p.x*2.8);
 p.y+=wave*tail*tail*.20+bend*tail*tail*.42;
 if(kind>0.5 && kind<1.5 && p.x>-.9) p.z+=sin(time+phase+p.x)*abs(p.y)*.085;
 vNormal=normalize(normalMatrix*normal); vPos=position; vUv=uv; vKind=kind;
 gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);
}`;
const fragment = /* glsl */`
uniform float variety, seed, shadow, opacity;
uniform sampler2D koiAtlas;
varying vec3 vNormal; varying vec3 vPos; varying vec2 vUv; varying float vKind;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7))+seed*71.3)*43758.5453);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+1.),f.x),f.y);}
float patches(vec2 p,float family,float spread){
 vec2 q=p*vec2(6.4,2.1)/spread+vec2(seed*61.7+family,family*2.37-seed*43.1);
 q+=vec2(noise(q*.8+13.),noise(q*.8+47.))*.8;
 float field=noise(q)*.79+noise(q*2.7+29.)*.21;
 float threshold=.46+hash(vec2(family,seed*17.))*.12;
 return smoothstep(threshold-.023,threshold+.023,field);
}
void main(){
 if(shadow>.5){gl_FragColor=vec4(.018,.09,.075,.18);return;}
 vec3 ivory=vec3(.95,.94,.84), red=vec3(.83,.105,.037), ink=vec3(.035,.058,.06), gold=vec3(.92,.59,.13);
 float n=noise(vPos.xy*vec2(3.7,6.)+seed); float n2=noise(vPos.xy*vec2(5.8,8.)+17.);
 vec3 c=ivory;
 if(variety<.5)c=mix(ivory,red,smoothstep(.46,.53,n));
 else if(variety<1.5){c=mix(ivory,red,smoothstep(.48,.54,n));c=mix(c,ink,smoothstep(.65,.70,n2));}
 else if(variety<2.5){c=mix(ink,ivory,smoothstep(.39,.46,n));c=mix(c,red,smoothstep(.55,.61,n2));}
 else if(variety<3.5)c=gold*(.88+.17*n);
 else if(variety<4.5)c=mix(ivory,ink,smoothstep(.46,.52,n));
 else {c=mix(vec3(.31,.47,.53),ivory,smoothstep(.65,.85,n)); c=mix(c,red,smoothstep(.20,.31,abs(vPos.y)));}
 // Preserve the photographic scale detail while giving every fish its own pigment islands.
 float longitudinal=clamp((1.12-vPos.x)/2.54,0.,1.);
 float bodyWidth=.06+.29*pow(max(0.,sin(pow(longitudinal,.72)*3.14159)),1.2);
 float lateral=clamp(vPos.y/max(bodyWidth,.06),-1.,1.);
 vec2 localUv=vec2(clamp((vPos.x+2.10)/3.36,.015,.985),clamp(.5+vPos.y*.55,.015,.985));
 localUv.x+=sin(longitudinal*8.+seed*17.)*lateral*.024;
 float atlasVariety=variety>5.5?0.:variety;
 vec2 atlasUv=vec2((mod(atlasVariety,2.)+localUv.x)/2.,(2.-floor(atlasVariety/2.)+localUv.y)/3.);
 vec4 specimen=texture2D(koiAtlas,atlasUv);
 vec3 blurred=(texture2D(koiAtlas,atlasUv+vec2(.003,0.)).rgb+texture2D(koiAtlas,atlasUv-vec2(.003,0.)).rgb+texture2D(koiAtlas,atlasUv+vec2(0.,.005)).rgb+texture2D(koiAtlas,atlasUv-vec2(0.,.005)).rgb)*.25;
 float detail=clamp(dot(specimen.rgb,vec3(.3,.59,.11))/(dot(blurred,vec3(.3,.59,.11))+.008),.74,1.20);
 vec2 pattern=vec2(longitudinal,lateral);
 float hi=patches(pattern,3.,1.0);
 float sumi=patches(pattern,19.,.72);
 if(variety<.5)c=mix(ivory,red,hi);
 else if(variety<1.5)c=mix(mix(ivory,red,hi),ink,sumi*.95);
 else if(variety<2.5){c=mix(ink,ivory,patches(pattern,31.,1.2));c=mix(c,red,hi);}
 else if(variety<3.5)c=mix(gold,specimen.rgb,.82);
 else if(variety<4.5)c=mix(ivory,ink,patches(pattern,47.,1.24));
 else c=mix(c,specimen.rgb,.94);
 c*=mix(1.,detail,smoothstep(.1,.7,specimen.a)*.8);
 if(variety>5.5){
   // A single, fixed signature: vermilion crown, asymmetric red islands, fine gold edges.
   vec2 p=pattern;
   float crown=length((p-vec2(.075,0.))/vec2(.073,.47));
   float islandA=length((p-vec2(.38,-.38))/vec2(.16,.64));
   float islandB=length((p-vec2(.68,.36))/vec2(.14,.61));
   float islandC=length((p-vec2(.87,-.24))/vec2(.07,.39));
   float contour=min(crown,min(islandA,min(islandB,islandC)));
   float irregular=(noise(p*vec2(19.,4.)+8.)-.5)*.16;
   if(p.x>.18)contour+=irregular;
   float crimson=1.-smoothstep(.94,1.025,contour);
   float gilding=smoothstep(.90,.98,contour)*(1.-smoothstep(1.03,1.11,contour));
   vec3 pearl=vec3(.97,.955,.89),vermilion=vec3(.86,.075,.035),champagne=vec3(.89,.64,.23);
   c=mix(pearl,vermilion,crimson);c=mix(c,champagne,gilding*.88);
   c*=mix(1.,detail,.65);
 }
 c*=.97+seed*.045;
 float alpha=1.;
 if(vKind>.5&&vKind<1.5){c=mix(c,ivory,.82);float rays=pow(abs(sin(atan(vPos.y,vPos.x+.4)*31.)),14.);c*=.92+rays*.08;alpha=.52;}
 if(vKind>1.5&&vKind<2.5)c=ink;
 if(vKind>2.5&&vKind<3.5)c=vec3(.82,.72,.38);
 if(vKind>3.5&&vKind<4.5)c=mix(c,ivory,.3);
 if(vKind>4.5)c=vec3(.58,.34,.25);
 if(variety>5.5&&vKind>.5&&vKind<1.5){c=mix(vec3(.91,.85,.65),vec3(1.,.96,.83),.6);alpha=.69;}
 vec2 scales=vPos.xy*vec2(24.,42.);scales.x+=mod(floor(scales.y),2.)*.5;
 float scale=1.-.025*pow(abs(sin(scales.x*3.14159)*sin(scales.y*3.14159)),5.);
 float light=.58+.42*max(dot(normalize(vNormal),normalize(vec3(-.3,.5,1.))),0.);
 float sheen=pow(max(dot(normalize(vNormal),normalize(vec3(-.2,.4,1.))),0.),24.);
 c=c*light*scale+vec3(.17,.21,.17)*sheen;
 gl_FragColor=vec4(c,alpha*opacity);
}`;
export function createFishMaterial(variety:number, seed:number, atlas:THREE.Texture) {return new THREE.ShaderMaterial({vertexShader:vertex,fragmentShader:fragment,uniforms:{koiAtlas:{value:atlas},time:{value:0},phase:{value:seed*21},pace:{value:4},bend:{value:0},variety:{value:variety},seed:{value:seed},opacity:{value:1},shadow:{value:0}},transparent:true,depthWrite:true,side:THREE.DoubleSide});}
export function createShadowMaterial(){return new THREE.ShaderMaterial({vertexShader:`varying vec2 p;void main(){p=position.xy;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,fragmentShader:`varying vec2 p;uniform float opacity;void main(){float body=exp(-pow((p.x+.1)/1.04,4.)-pow(p.y/.38,2.)*2.);float tail=exp(-pow((p.x+1.5)/.32,2.)-pow(p.y/.3,2.)*2.);gl_FragColor=vec4(.015,.10,.085,(body+tail)*.23*opacity);}`,uniforms:{opacity:{value:1}},transparent:true,depthWrite:false});}
