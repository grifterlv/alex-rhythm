import * as THREE from 'three';
import {createFocusWorld} from './focus-world';
import {shouldAnimate,type FocusScene} from './focus';
import {changeFocusView,initialFocusView,type FocusView} from './focus-camera';

export type SceneController={setMoving:(moving:boolean)=>void,rotate:(direction:number)=>void,zoom:(direction:number)=>void,resetView:()=>void,dispose:()=>void};

export function mountScene(host:HTMLDivElement,kind:FocusScene,initialMoving:boolean,onError:()=>void):SceneController{
 const renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,powerPreference:'low-power'});
 renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.5));
 renderer.outputColorSpace=THREE.SRGBColorSpace;
 renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.08;
 renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
 renderer.setClearColor(0xf5f3f1,0);renderer.domElement.setAttribute('aria-hidden','true');
 const scene=new THREE.Scene(),camera=new THREE.OrthographicCamera(-4,4,3,-3,.1,50);
 // Broad warm key, cool fill and a rim give matte forms a soft studio appearance.
 scene.add(new THREE.HemisphereLight(0xfffaf5,0xb2a6a0,2.1));
 const sun=new THREE.DirectionalLight(0xfff1e5,3);sun.position.set(-3,7,5);sun.castShadow=true;
 sun.shadow.mapSize.set(1024,1024);sun.shadow.camera.left=-5;sun.shadow.camera.right=5;sun.shadow.camera.top=5;sun.shadow.camera.bottom=-5;sun.shadow.camera.near=.1;sun.shadow.camera.far=22;sun.shadow.normalBias=.025;sun.shadow.bias=-.00015;scene.add(sun);
 const fill=new THREE.DirectionalLight(0xdce6ff,1.15);fill.position.set(5,3,2);scene.add(fill);
 const rim=new THREE.DirectionalLight(0xfffaf1,1.2);rim.position.set(2,6,-4);scene.add(rim);
 let world:ReturnType<typeof createFocusWorld>;
 try{world=createFocusWorld(kind);scene.add(world.root)}catch(e){renderer.dispose();renderer.forceContextLoss();throw e}
 host.appendChild(renderer.domElement);
 const reduce=window.matchMedia('(prefers-reduced-motion: reduce)');
 let moving=initialMoving,disposed=false,lost=false,frame=0,lastFrame=0,visualTime=.7;
 let view:FocusView={...initialFocusView},aspect=1;
 let drag:{id:number,x:number,y:number,touch:boolean}|null=null;
 const canAnimate=()=>shouldAnimate(document.visibilityState==='visible',moving,true,reduce.matches)&&!disposed&&!lost;
 function stop(){if(frame)cancelAnimationFrame(frame);frame=0;lastFrame=0}
 function positionCamera(){
  const radius=10,horizontal=Math.cos(view.elevation)*radius;
  camera.position.set(Math.sin(view.yaw)*horizontal,.93+Math.sin(view.elevation)*radius,Math.cos(view.yaw)*horizontal);camera.lookAt(0,.93,0);
  const viewHeight=Math.max(5.6,7.3/aspect)/view.zoom;camera.left=-viewHeight*aspect/2;camera.right=viewHeight*aspect/2;camera.top=viewHeight/2;camera.bottom=-viewHeight/2;camera.updateProjectionMatrix();
 }
 function draw(){if(disposed||lost||document.visibilityState!=='visible')return;try{world.animate(visualTime);renderer.render(scene,camera)}catch{lost=true;stop();onError()}}
 function tick(time:number){frame=0;if(!canAnimate())return;
  if(!lastFrame)lastFrame=time;
  const delta=time-lastFrame;
  if(delta>=1000/24){visualTime+=Math.min(delta/1000,.1);lastFrame=time;draw()}
  if(canAnimate())frame=requestAnimationFrame(tick);
 }
 // Pointer movement is coalesced into a single frame, including in static mode.
 function requestDraw(){if(frame||disposed||lost||document.visibilityState!=='visible')return;frame=requestAnimationFrame(time=>{frame=0;draw();if(canAnimate()){lastFrame=time;frame=requestAnimationFrame(tick)}})}
 function resume(){stop();if(disposed||lost)return;draw();if(canAnimate())frame=requestAnimationFrame(tick)}
 function updateView(delta:Partial<FocusView>){if(disposed||lost)return;view=changeFocusView(view,delta);positionCamera();requestDraw()}
 function resize(){if(disposed||lost)return;const width=Math.max(1,host.clientWidth),height=Math.max(1,host.clientHeight);aspect=width/height;positionCamera();renderer.setSize(width,height,false);resume()}
 function pointerDown(e:PointerEvent){if(e.button!==0||disposed||lost)return;drag={id:e.pointerId,x:e.clientX,y:e.clientY,touch:e.pointerType==='touch'};renderer.domElement.setPointerCapture(e.pointerId)}
 function pointerMove(e:PointerEvent){if(!drag||drag.id!==e.pointerId)return;updateView({yaw:-(e.clientX-drag.x)*.005,elevation:drag.touch?0:(e.clientY-drag.y)*.003});drag.x=e.clientX;drag.y=e.clientY}
 function pointerEnd(e:PointerEvent){if(drag?.id!==e.pointerId)return;drag=null;if(renderer.domElement.hasPointerCapture(e.pointerId))renderer.domElement.releasePointerCapture(e.pointerId)}
 function visibility(){drag=null;resume()}
 function contextLost(e:Event){e.preventDefault();lost=true;stop();onError()}
 const observer=new ResizeObserver(resize);observer.observe(host);
 document.addEventListener('visibilitychange',visibility);reduce.addEventListener('change',resume);renderer.domElement.addEventListener('webglcontextlost',contextLost);
 renderer.domElement.addEventListener('pointerdown',pointerDown);renderer.domElement.addEventListener('pointermove',pointerMove);renderer.domElement.addEventListener('pointerup',pointerEnd);renderer.domElement.addEventListener('pointercancel',pointerEnd);renderer.domElement.addEventListener('lostpointercapture',pointerEnd);
 resize();
 return {
  setMoving(value){moving=value;resume()},rotate(direction){updateView({yaw:direction*.14})},zoom(direction){updateView({zoom:direction*.09})},resetView(){view={...initialFocusView};positionCamera();requestDraw()},
  dispose(){if(disposed)return;disposed=true;drag=null;stop();observer.disconnect();document.removeEventListener('visibilitychange',visibility);reduce.removeEventListener('change',resume);renderer.domElement.removeEventListener('webglcontextlost',contextLost);renderer.domElement.removeEventListener('pointerdown',pointerDown);renderer.domElement.removeEventListener('pointermove',pointerMove);renderer.domElement.removeEventListener('pointerup',pointerEnd);renderer.domElement.removeEventListener('pointercancel',pointerEnd);renderer.domElement.removeEventListener('lostpointercapture',pointerEnd);world.dispose();sun.shadow.map?.dispose();renderer.dispose();renderer.forceContextLoss();renderer.domElement.remove()}
 };
}
