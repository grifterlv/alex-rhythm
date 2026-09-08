import * as THREE from 'three';
import {createFocusWorld} from './focus-world';
import {shouldAnimate,type FocusScene} from './focus';

export type SceneController={setMoving:(moving:boolean)=>void,dispose:()=>void};

export function mountScene(host:HTMLDivElement,kind:FocusScene,initialMoving:boolean,onError:()=>void):SceneController{
 const renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,powerPreference:'low-power'});
 renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.5));
 renderer.outputColorSpace=THREE.SRGBColorSpace;
 renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.18;
 renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
 renderer.setClearColor(0xeff3eb,0);renderer.domElement.setAttribute('aria-hidden','true');
 const scene=new THREE.Scene(),camera=new THREE.OrthographicCamera(-4,4,3,-3,.1,50);
 camera.position.set(6.8,5.6,7.8);camera.lookAt(0,.93,0);
 const hemi=new THREE.HemisphereLight(0xf3f8ef,0x998b72,2.6);scene.add(hemi);
 const sun=new THREE.DirectionalLight(0xffedd4,3.6);sun.position.set(-2,6,5);sun.castShadow=true;
 sun.shadow.mapSize.set(1024,1024);sun.shadow.camera.left=-5;sun.shadow.camera.right=5;sun.shadow.camera.top=5;sun.shadow.camera.bottom=-5;sun.shadow.camera.near=.1;sun.shadow.camera.far=20;sun.shadow.normalBias=.035;sun.shadow.bias=-.00015;scene.add(sun);
 const fill=new THREE.DirectionalLight(0xcbded5,.7);fill.position.set(5,3,-3);scene.add(fill);
 let world:ReturnType<typeof createFocusWorld>;
 try{world=createFocusWorld(kind);scene.add(world.root)}catch(e){renderer.dispose();renderer.forceContextLoss();throw e}
 host.appendChild(renderer.domElement);
 const reduce=window.matchMedia('(prefers-reduced-motion: reduce)');
 let moving=initialMoving,disposed=false,lost=false,frame=0,lastFrame=0,visualTime=.7;
 const canAnimate=()=>shouldAnimate(document.visibilityState==='visible',moving,true,reduce.matches)&&!disposed&&!lost;
 function stop(){if(frame)cancelAnimationFrame(frame);frame=0;lastFrame=0}
 function draw(){if(disposed||lost||document.visibilityState!=='visible')return;try{world.animate(visualTime);renderer.render(scene,camera)}catch{lost=true;stop();onError()}}
 function tick(time:number){frame=0;if(!canAnimate())return;
  if(!lastFrame)lastFrame=time;
  const delta=time-lastFrame;
  if(delta>=1000/24){visualTime+=Math.min(delta/1000,.1);lastFrame=time;draw()}
  if(canAnimate())frame=requestAnimationFrame(tick);
 }
 function resume(){stop();if(disposed||lost)return;draw();if(canAnimate())frame=requestAnimationFrame(tick)}
 function resize(){if(disposed||lost)return;const width=Math.max(1,host.clientWidth),height=Math.max(1,host.clientHeight),aspect=width/height;
  const viewHeight=Math.max(5.3,6.65/aspect);camera.left=-viewHeight*aspect/2;camera.right=viewHeight*aspect/2;camera.top=viewHeight/2;camera.bottom=-viewHeight/2;camera.updateProjectionMatrix();renderer.setSize(width,height,false);resume();
 }
 function contextLost(e:Event){e.preventDefault();lost=true;stop();onError()}
 const observer=new ResizeObserver(resize);observer.observe(host);
 document.addEventListener('visibilitychange',resume);reduce.addEventListener('change',resume);renderer.domElement.addEventListener('webglcontextlost',contextLost);
 resize();
 return {setMoving(value){moving=value;resume()},dispose(){if(disposed)return;disposed=true;stop();observer.disconnect();document.removeEventListener('visibilitychange',resume);reduce.removeEventListener('change',resume);renderer.domElement.removeEventListener('webglcontextlost',contextLost);world.dispose();sun.shadow.map?.dispose();renderer.dispose();renderer.forceContextLoss();renderer.domElement.remove()}};
}
