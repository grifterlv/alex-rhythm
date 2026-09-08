import assert from 'node:assert/strict';
import * as THREE from 'three';
import {focusElapsed,focusRecord,focusScenes,sceneForActivity,shouldAnimate,type FocusScene} from '../../lib/focus';
import {createFocusWorld} from '../../lib/focus-world';
import {type Snapshot,type Block} from '../../lib/planner';

const a:Block={id:'work-a',title:'完成网站原型',category:'work',start:510,end:550,done:false,note:''};
const b:Block={...a,id:'work-b',title:'读书',category:'rest',start:555,end:585};
const started=Date.parse('2026-09-07T16:00:00Z');
const snap:Snapshot={revision:3,active:{id:'session-b',day:'2026-09-07',blockId:a.id,title:a.title,category:a.category,startedAt:started},days:{'2026-09-07':{mode:'custom',goal:'',blocks:[a,b],logs:[{id:'session-a',blockId:a.id,title:a.title,category:a.category,start:started-20*60000,end:started-5*60000}]}}};
const selected={date:'2026-09-07',id:b.id};
// The true active task wins over a suggested next task, even across planning days.
const running=focusRecord(snap,selected);assert.equal(running.id,a.id);assert.equal(running.savedMs,15*60000);
assert.equal(focusElapsed(running.savedMs,snap.active!.startedAt,started+77*60000),92*60000);
assert.equal(focusRecord({...snap,active:{...snap.active!,day:'2026-09-06'}},selected).date,'2026-09-06');
// A paused task remains pinned when the clock passes the next scheduled task.
const paused=structuredClone(snap);paused.active=null;paused.days['2026-09-07'].logs.push({id:'session-b',blockId:a.id,title:a.title,category:a.category,start:started,end:started+77*60000});
const pinned=focusRecord(paused,{date:'2026-09-07',id:a.id});assert.equal(pinned.id,a.id);assert.equal(pinned.running,false);assert.equal(focusElapsed(pinned.savedMs,undefined,started+200*60000),92*60000);
paused.days['2026-09-07'].blocks[0].done=true;assert.equal(focusRecord(paused,{date:'2026-09-07',id:a.id}).done,true);
assert.equal(sceneForActivity(a),'desk');assert.equal(sceneForActivity(b),'reading');assert.equal(sceneForActivity({...a,title:'睡眠',category:'rest'}),'rest');assert.equal(sceneForActivity({...a,title:'陪猫玩',category:'cat'}),'cats');
assert.equal(shouldAnimate(true,true,true,false),true);assert.equal(shouldAnimate(false,true,true,false),false);assert.equal(shouldAnimate(true,false,true,false),false);assert.equal(shouldAnimate(true,true,false,false),false);assert.equal(shouldAnimate(true,true,true,true),false);
// CPU geometry check only: no browser, GPU, screenshots, or visual testing.
for(const kind of Object.keys(focusScenes) as FocusScene[]){
 const world=createFocusWorld(kind);let meshes=0;const geometries=new Set<THREE.BufferGeometry>(),materials=new Set<THREE.Material>();
 world.root.traverse(o=>{if(o instanceof THREE.Mesh){meshes++;geometries.add(o.geometry);for(const m of Array.isArray(o.material)?o.material:[o.material])materials.add(m)}});
 assert.ok(meshes>30&&meshes<300,kind+' stays within the lightweight scene budget');
 for(const t of [.7,3,10,120,7200]){world.animate(t);world.root.updateMatrixWorld(true);world.root.traverse(o=>assert.ok(o.matrixWorld.elements.every(Number.isFinite),kind+' has finite animation transforms'));const bounds=new THREE.Box3().setFromObject(world.root);assert.ok(bounds.min.y>-.6&&bounds.max.y<4,kind+' stays inside room bounds')}
 let disposedMaterials=0;materials.forEach(m=>m.addEventListener('dispose',()=>disposedMaterials++));world.dispose();assert.equal(world.root.children.length,0);assert.equal(disposedMaterials,materials.size,kind+' releases its materials');
}
console.log('PASS: focus task identity, 77-minute background gap, pause/resume accumulation, completion, reduced motion, six bounded 3D scenes and resource disposal (no GPU/browser QA)');
