import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import type {FocusScene} from './focus';

type Point=[number,number,number];
type Gesture='type'|'read'|'cycle'|'cook'|'cats'|'rest';
const palette={wall:0xe7eee7,floor:0xe9d4b7,wood:0xb8885c,cream:0xfff8e9,green:0x47785f,leaf:0x739775,clay:0xc77960,ink:0x354740,skin:0xe7b991,hair:0x443b35,blue:0x87b9c2,pants:0x52677a};

// Actual 3D geometry: each room has articulated activity-specific motion.
// Geometry and materials belong to this world and are disposed together.
export function createFocusWorld(kind:FocusScene){
 const root=new THREE.Group();root.name='focus-world-'+kind;
 const materials=new Map<number,THREE.MeshStandardMaterial>();
 const geometries=new Set<THREE.BufferGeometry>();
 const animations:Array<(time:number)=>void>=[];
 const mat=(color:number)=>{let m=materials.get(color);if(!m){m=new THREE.MeshStandardMaterial({color,roughness:.82,metalness:0});materials.set(color,m)}return m};
 function mesh(parent:THREE.Object3D,g:THREE.BufferGeometry,color:number,p:Point){geometries.add(g);const m=new THREE.Mesh(g,mat(color));m.position.set(...p);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m}
 function box(parent:THREE.Object3D,size:Point,p:Point,color:number,r=.04){return mesh(parent,new RoundedBoxGeometry(...size,2,Math.min(r,...size.map(n=>n/3))),color,p)}
 function ball(parent:THREE.Object3D,size:Point,p:Point,color:number){const m=mesh(parent,new THREE.SphereGeometry(1,16,12),color,p);m.scale.set(...size);return m}
 function cylinder(parent:THREE.Object3D,r:number,h:number,p:Point,color:number){return mesh(parent,new THREE.CylinderGeometry(r,r,h,16),color,p)}
 const unit=new THREE.CylinderGeometry(1,1,1,12);geometries.add(unit);
 function segment(parent:THREE.Object3D,r:number,color:number){const m=new THREE.Mesh(unit,mat(color));m.castShadow=true;parent.add(m);return {set:(a:Point,b:Point)=>{const av=new THREE.Vector3(...a),bv=new THREE.Vector3(...b),delta=bv.clone().sub(av);m.position.copy(av.add(bv).multiplyScalar(.5));m.scale.set(r,delta.length(),r);m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize())},mesh:m}}
 function beam(parent:THREE.Object3D,a:Point,b:Point,r:number,color:number){const s=segment(parent,r,color);s.set(a,b);return s}
 function book(parent:THREE.Object3D,p:Point,color:number,width=.38){box(parent,[width,.08,.32],p,color,.018);box(parent,[width-.025,.05,.285],[p[0],p[1]+.002,p[2]+.008],palette.cream,.007)}
 function plant(x:number,z:number,scale=1){const g=new THREE.Group();g.position.set(x,0,z);g.scale.setScalar(scale);root.add(g);const pot=mesh(g,new THREE.CylinderGeometry(.21,.16,.32,20),palette.clay,[0,.17,0]);pot.name='plant-pot';cylinder(g,.18,.02,[0,.34,0],0x574737);for(let i=0;i<5;i++){const angle=i*2.4,top:Point=[Math.cos(angle)*.2,.65+i*.09,Math.sin(angle)*.18];beam(g,[0,.3,0],top,.017,palette.green);const leaf=ball(g,[.11,.27,.05],top,i%2?palette.green:palette.leaf);leaf.rotation.z=-Math.cos(angle)*.5;leaf.rotation.y=angle;const rz=leaf.rotation.z;animations.push(t=>{leaf.rotation.z=rz+Math.sin(t*.6+i)*.025})}}
 function lamp(parent:THREE.Object3D,x:number,y:number,z:number){cylinder(parent,.14,.04,[x,y,z],palette.ink);beam(parent,[x,y,z],[x,y+.42,z],.022,palette.ink);beam(parent,[x,y+.42,z],[x+.16,y+.6,z],.022,palette.ink);mesh(parent,new THREE.ConeGeometry(.19,.19,20,1,true),0xd9ac61,[x+.16,y+.58,z]);const bulb=ball(parent,[.1,.025,.1],[x+.16,y+.49,z],0xffe0a0);bulb.material=new THREE.MeshStandardMaterial({color:0xffefba,emissive:0xffd174,emissiveIntensity:.45});materials.set(-1,bulb.material as THREE.MeshStandardMaterial)}
 function cup(parent:THREE.Object3D,p:Point,color=palette.cream){cylinder(parent,.08,.15,p,color);cylinder(parent,.069,.01,[p[0],p[1]+.077,p[2]],0x7e5940);const handle=mesh(parent,new THREE.TorusGeometry(.065,.018,8,16),color,[p[0]+.087,p[1],p[2]]);handle.rotation.y=Math.PI/2}
 function chair(parent:THREE.Object3D,color=palette.green){box(parent,[.62,.14,.6],[0,.62,0],color,.09);box(parent,[.62,.6,.13],[0,.99,-.25],color,.07);for(const x of [-.22,.22])for(const z of [-.2,.2])beam(parent,[x,.1,z],[x,.58,z],.035,palette.wood)}
 function person(x:number,z:number,rotation:number,standing=false,gesture:Gesture='type'){
  const g=new THREE.Group();g.name='person';g.position.set(x,0,z);g.rotation.y=rotation;root.add(g);
  const hip=standing?1.0:gesture==='cycle'?.8:.65;
  const body=mesh(g,new THREE.CapsuleGeometry(.225,.19,6,16),palette.clay,[0,hip+.29,0]);body.name='hoodie';body.scale.z=.85;
  cylinder(g,.075,.12,[0,hip+.63,0],palette.skin);
  const head=new THREE.Group();head.position.set(0,hip+.85,0);g.add(head);
  ball(head,[.255,.29,.25],[0,0,0],palette.skin);
  mesh(head,new THREE.SphereGeometry(.267,20,12,0,Math.PI*2,0,Math.PI*.55),palette.hair,[0,.027,-.013]);
  ball(head,[.24,.08,.14],[0,.15,.16],palette.hair);
  for(const side of [-1,1]){ball(head,[.024,.027,.017],[side*.087,.01,.239],palette.ink);ball(head,[.045,.067,.04],[side*.248,-.01,0],palette.skin)}
  ball(head,[.03,.036,.026],[0,-.04,.247],palette.skin);
  const arms=[-1,1].map(side=>({side,upper:segment(g,.085,palette.clay),lower:segment(g,.054,palette.skin),hand:ball(g,[.06,.065,.062],[0,0,0],palette.skin)}));
  const legs=[-1,1].map(side=>({side,upper:segment(g,.095,palette.pants),lower:segment(g,.075,palette.pants),shoe:box(g,[.17,.13,.28],[0,0,0],palette.cream,.05)}));
  const setPose=(t:number)=>{
   head.rotation.z=Math.sin(t*.7)*.018;head.rotation.x=gesture==='read'?.12:gesture==='rest'?-.035:.045;
   for(const a of arms){const s=a.side;let wrist:Point=[s*.23,hip+.34,.4],elbow:Point=[s*.3,hip+.22,.13];
    if(gesture==='type')wrist=[s*.21,hip+.35+Math.sin(t*3.5+s)*.016,.42];
    if(gesture==='read')wrist=[s*.16,hip+.41,.38];
    if(gesture==='cycle'){wrist=[s*.27,1.13,.63];elbow=[s*.3,hip+.31,.24]}
    if(gesture==='cook'){wrist=s===1?[.09+Math.sin(t*.9)*.06,1.48,.77+Math.cos(t*.9)*.055]:[-.24,1.23,.47];elbow=[s*.3,1.19,.2]}
    if(gesture==='cats')wrist=s===1?[.28,hip+.53,.47]:[-.27,hip+.13,.24];
    if(gesture==='rest')wrist=[s*.3,hip+.16,.25];
    a.upper.set([s*.23,hip+.49,0],elbow);a.lower.set(elbow,wrist);a.hand.position.set(...wrist);
   }
   for(const l of legs){const s=l.side;let knee:Point=[s*.14,standing?.56:.46,standing?.015:.32],foot:Point=[s*.15,.135,standing?.06:.38];
    if(gesture==='cycle'){const angle=t*1.45+(s===1?Math.PI:0);foot=[s*.22,.48+Math.sin(angle)*.19,.49+Math.cos(angle)*.19];knee=[s*.19,.64+Math.sin(angle)*.05,.24]}
    l.upper.set([s*.13,hip,0],knee);l.lower.set(knee,foot);l.shoe.position.set(foot[0],foot[1]-.015,foot[2]+.045);
   }
  };setPose(0);animations.push(setPose);return g;
 }
 // An open miniature room, shared across activities.
 box(root,[5.05,.25,4.25],[0,-.13,0],palette.cream,.16);
 box(root,[4.84,.08,4.06],[0,.01,0],palette.floor,.03);
 for(let x=-1.8;x<2.3;x+=.58)box(root,[.013,.003,3.95],[x,.053,0],0xd9bd99,.001);
 box(root,[4.94,2.55,.12],[0,1.27,-2.01],palette.wall,.04);
 box(root,[.12,2.55,4.07],[-2.43,1.27,-.025],0xd8e5dc,.04);
 // Framed window, with dimensional scenery behind the panes.
 box(root,[1.7,1.38,.07],[-.82,1.63,-1.925],0xf8f5e9,.03);
 box(root,[1.52,1.22,.035],[-.82,1.63,-1.878],0xb9d7d5,.01);
 ball(root,[.19,.19,.022],[-.43,1.88,-1.848],0xf1dba0);
 ball(root,[.8,.31,.035],[-.85,1.12,-1.848],0x81a793);
 box(root,[.055,1.3,.07],[-.82,1.63,-1.815],palette.cream,.01);
 box(root,[1.62,.055,.07],[-.82,1.63,-1.805],palette.cream,.01);
 box(root,[1.95,.09,.25],[-.82,.91,-1.83],palette.cream,.015);
 // A small wall shelf gives the room depth without a moving camera.
 box(root,[1.06,.09,.3],[1.05,1.79,-1.77],palette.wood,.02);
 for(let i=0;i<5;i++)box(root,[.11,.28+i%2*.08,.18],[.7+i*.13,1.98+i%2*.04,-1.77],[palette.clay,palette.green,palette.blue,0xd4b064,0xe3d1ae][i],.012);
 plant(1.9,-1.45,.88);
 // The rug anchors the activity area.
 box(root,[3.1,.025,2.65],[.1,.071,.15],kind==='cycling'?0x91aaa2:0xd9b89b,.12);

 if(kind==='desk'){
  const g=person(.72,.05,-Math.PI/2,false,'type');chair(g);
  box(root,[1.0,.13,1.72],[-.24,.94,.05],palette.wood,.06);
  for(const x of [-.63,.13])for(const z of [-.63,.72])beam(root,[x,.08,z],[x,.89,z],.045,palette.ink);
  const laptop=new THREE.Group();laptop.position.set(-.36,1.015,.02);laptop.rotation.y=Math.PI/2;root.add(laptop);
  box(laptop,[.7,.025,.48],[0,.018,0],0x879994,.018);
  const screen=box(laptop,[.7,.46,.035],[0,.255,-.22],palette.ink,.022);screen.rotation.x=-.13;
  const display=box(laptop,[.62,.37,.007],[0,.255,-.194],0xaed5ca,.006);display.rotation.x=-.13;
  for(let i=0;i<4;i++)box(laptop,[.25+(i%2)*.18,.022,.009],[-.08,.36-i*.065,-.16-i*.008],i%2?0x557770:0xe1efe0,.003);
  for(let i=0;i<4;i++)box(laptop,[.51,.009,.025],[0,.036,-.105+i*.065],0xc2d1c5,.002);
  lamp(root,-.35,1.02,-.62);cup(root,[-.3,1.1,.65]);
  book(root,[-1.55,.15,-1.1],palette.blue);book(root,[-1.55,.23,-1.1],palette.clay,.4);
 }
 if(kind==='reading'){
  const g=person(.15,-.1,-.2,false,'read');chair(g,0x778f79);
  for(const side of [-1,1])box(g,[.18,.3,.68],[side*.36,.76,0],0x778f79,.07);
  const opened=new THREE.Group();opened.position.set(0,1.075,.39);opened.rotation.x=.23;g.add(opened);
  for(const side of [-1,1]){const page=box(opened,[.25,.035,.34],[side*.13,0,0],palette.cream,.008);page.rotation.z=-side*.12;box(opened,[.26,.017,.35],[side*.13,-.028,0],palette.clay,.005)}
  const turn=new THREE.Group();opened.add(turn);box(turn,[.23,.008,.32],[.12,.025,0],0xfffae9,.001);
  animations.push(t=>{const phase=t%12;turn.rotation.z=phase<9?0:Math.PI*(phase-9)/3});
  cylinder(root,.36,.09,[1.16,.61,.37],palette.wood);cylinder(root,.045,.55,[1.16,.3,.37],palette.ink);cup(root,[1.16,.72,.37]);
  lamp(root,-1.3,.1,-.72);book(root,[.95,.13,-1.02],palette.green);book(root,[.95,.21,-1.02],palette.blue);
 }
 if(kind==='cycling'){
  person(.1,-.2,0,false,'cycle');
  const bike=new THREE.Group();bike.position.set(.1,0,-.2);root.add(bike);
  for(const z of [-.2,1.0])beam(bike,[-.45,.12,z],[.45,.12,z],.07,palette.ink);
  beam(bike,[0,.12,-.2],[0,.7,-.08],.07,palette.ink);beam(bike,[0,.25,.15],[0,.5,.85],.1,0x799f8c);
  beam(bike,[0,.25,.15],[0,.71,-.08],.055,0x799f8c);box(bike,[.38,.085,.3],[0,.73,-.08],palette.ink,.04);
  const wheel=new THREE.Group();wheel.position.set(0,.5,.84);bike.add(wheel);
  const ring=mesh(wheel,new THREE.TorusGeometry(.35,.065,10,32),palette.ink,[0,0,0]);ring.rotation.y=Math.PI/2;
  const hub=cylinder(wheel,.22,.07,[0,0,0],0xb6cdbb);hub.rotation.z=Math.PI/2;
  beam(wheel,[0,-.29,0],[0,.29,0],.018,palette.cream);beam(wheel,[0,0,-.29],[0,0,.29],.018,palette.cream);
  animations.push(t=>{wheel.rotation.x=-t*1.45});
  beam(bike,[0,.13,1],[0,1.14,.62],.04,palette.ink);beam(bike,[-.34,1.13,.63],[.34,1.13,.63],.045,palette.ink);
  box(bike,[.25,.04,.2],[0,1.2,.75],0xb8d2ca,.02);
  const bottle=cylinder(root,.08,.3,[1.2,.23,.3],palette.blue);cylinder(root,.045,.06,[bottle.position.x,.405,.3],palette.cream);
  box(root,[.54,.06,.35],[-1.25,.13,.9],palette.cream,.05);
 }
 if(kind==='kitchen'){
  person(.65,.05,-Math.PI/2,true,'cook');
  box(root,[1.05,1.0,1.95],[-.65,.56,-.06],palette.green,.05);box(root,[1.17,.13,2.07],[-.65,1.115,-.06],palette.cream,.04);
  for(const z of [-.56,.43]){box(root,[.026,.72,.85],[-.11,.58,z],0x5e8b70,.015);beam(root,[-.085,.86,z-.17],[-.085,.86,z+.17],.018,0xe4d0a4)}
  cylinder(root,.27,.02,[-.46,1.192,.06],palette.ink);cylinder(root,.22,.22,[-.46,1.31,.06],0xcaab82);cylinder(root,.2,.025,[-.46,1.43,.06],0xb9794a);
  for(const side of [-1,1])beam(root,[-.46,1.33,.06+side*.2],[-.46,1.33,.06+side*.33],.033,palette.ink);
  const spoon=beam(root,[-.4,1.38,.03],[-.13,1.48,.13],.018,palette.wood);
  animations.push(t=>{spoon.set([-.46+Math.sin(t*.9)*.075,1.39,.06+Math.cos(t*.9)*.075],[-.12-Math.cos(t*.9)*.055,1.48,.14+Math.sin(t*.9)*.06])});
  for(let i=0;i<3;i++){const steam=ball(root,[.045,.08,.045],[-.46,1.6,.06],palette.cream);const sm=new THREE.MeshStandardMaterial({color:palette.cream,transparent:true,opacity:.35,depthWrite:false});steam.material=sm;materials.set(-10-i,sm);steam.castShadow=false;animations.push(t=>{const phase=(t*.12+i/3)%1;steam.position.set(-.46+Math.sin(t*.6+i)*.05,1.5+phase*.45,.06);sm.opacity=(1-phase)*.3;steam.scale.set(.035+phase*.045,.06+phase*.04,.035+phase*.045)})}
  box(root,[.57,.025,.4],[-.67,1.197,-.73],palette.wood,.035);for(let i=0;i<3;i++)ball(root,[.085,.08,.085],[-.82+i*.14,1.28,-.73],i%2?0xd6ad55:0xbc7658);cup(root,[-.6,1.27,.74]);
 }
 if(kind==='cats'){
  const g=person(.6,-.74,-.2,false,'cats');chair(g,0xbd9875);
  beam(g,[.28,1.18,.47],[.1,1.59,1.12],.017,palette.wood);
  const cord=beam(root,[.5,1.5,.32],[-.35,.2,.8],.005,palette.ink);
  const feather=ball(root,[.065,.055,.15],[-.35,.16,.8],palette.blue);
  function cat(x:number,z:number,color:number){const c=new THREE.Group();c.name='cat';c.position.set(x,.09,z);root.add(c);ball(c,[.18,.17,.31],[0,.2,0],color);const head=ball(c,[.18,.17,.17],[0,.32,.29],color);for(const side of [-1,1]){const ear=mesh(c,new THREE.ConeGeometry(.08,.17,3),color,[side*.105,.49,.28]);ear.rotation.y=side*.35;ball(c,[.018,.025,.012],[side*.064,.337,.446],palette.ink);for(const zz of [-.17,.18])cylinder(c,.045,.13,[side*.11,.075,zz],color)}ball(c,[.027,.02,.016],[0,.289,.453],0xb37872);const tail=new THREE.Group();tail.position.set(0,.2,-.26);c.add(tail);mesh(tail,new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(0,0,0),new THREE.Vector3(.14,.12,-.17),new THREE.Vector3(.2,.32,-.2),new THREE.Vector3(.13,.4,-.17)]),12,.036,7,false),color,[0,0,0]);return {c,head,tail}}
  const cats=[cat(-.65,.63,0xbb875b),cat(.47,.88,0x89968f)];
  animations.push(t=>{feather.position.set(-.28+Math.sin(t*.6)*.24,.15,.68+Math.cos(t*.6)*.14);cord.set([.42,1.57,.35],[feather.position.x,.18,feather.position.z]);cats.forEach(({c,tail},i)=>{c.position.x=(i?.52:-.73)+Math.sin(t*.42+i)*.13;c.position.z=(i?1.1:.85)+Math.cos(t*.42+i)*.11;c.rotation.y=Math.atan2(feather.position.x-c.position.x,feather.position.z-c.position.z);tail.rotation.z=Math.sin(t*.9+i)*.14})});
  cylinder(root,.26,.13,[-1.55,.15,-.72],0xd1b58a);cylinder(root,.17,.58,[-1.55,.49,-.72],0xc6ad87);cylinder(root,.29,.1,[-1.55,.83,-.72],palette.cream);
 }
 if(kind==='rest'){
  const g=person(.2,-.1,-.18,false,'rest');chair(g,0x829d89);for(const s of [-1,1])box(g,[.2,.3,.72],[s*.36,.77,0],0x829d89,.08);
  box(root,[.65,.06,.53],[.2,.35,.99],0xcda581,.06);for(const x of [-.02,.4])beam(root,[x,.09,.99],[x,.33,.99],.035,palette.wood);
  plant(-1.47,.73,1.0);cylinder(root,.33,.07,[1.28,.58,.25],palette.wood);cylinder(root,.04,.5,[1.28,.3,.25],palette.ink);cup(root,[1.28,.69,.25]);
 }
 // All animations use a local visual clock; none of them change tracked time.
 return {root,animate:(t:number)=>animations.forEach(fn=>fn(t)),dispose:()=>{geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());root.clear()}};
}
