import * as THREE from 'three';
import { createFishMaterial } from './fishGeometry';

/** Render the actual pond geometry and shader; no separately illustrated menu fish. */
export function renderFishPreviews(renderer:THREE.WebGLRenderer, geometry:THREE.BufferGeometry, atlas:THREE.Texture, seeds:number[]) {
  const width=384,height=160;
  const target=new THREE.WebGLRenderTarget(width,height);
  const scene=new THREE.Scene();
  const camera=new THREE.OrthographicCamera(-2.3,1.45,.78,-.78,.1,20);
  camera.position.z=5;
  const previousTarget=renderer.getRenderTarget();
  const clearColor=renderer.getClearColor(new THREE.Color()),clearAlpha=renderer.getClearAlpha();
  const pixels=new Uint8Array(width*height*4);
  const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
  const context=canvas.getContext('2d')!;
  const frame=context.createImageData(width,height);
  const previews:string[]=[];
  try{
    renderer.setClearColor(0,0);renderer.setRenderTarget(target);
    for(let variety=0;variety<seeds.length;variety++){
      const material=createFishMaterial(variety,seeds[variety]??.5,atlas);
      const mesh=new THREE.Mesh(geometry,material);scene.add(mesh);
      renderer.clear();renderer.render(scene,camera);
      renderer.readRenderTargetPixels(target,0,0,width,height,pixels);
      for(let y=0;y<height;y++)frame.data.set(pixels.subarray((height-1-y)*width*4,(height-y)*width*4),y*width*4);
      context.putImageData(frame,0,0);previews.push(canvas.toDataURL('image/png'));
      scene.remove(mesh);material.dispose();
    }
  }finally{renderer.setRenderTarget(previousTarget);renderer.setClearColor(clearColor,clearAlpha);target.dispose();}
  return previews;
}
