import assert from 'node:assert/strict';
import {dayOverview,overviewGroups,overviewGroupAt} from '../../lib/day-overview';
import {template,type Day} from '../../lib/planner';
import {defaults} from '../../lib/planning';

const day=template(),before=JSON.stringify(day),periods=dayOverview(day,defaults);
assert.equal(periods.length,4);
assert.equal(periods.flatMap(p=>p.groups).reduce((n,g)=>n+g.end-g.start,0),1440);
for(const p of periods){assert.equal(p.groups[0].start,p.start);assert.equal(p.groups.at(-1)!.end,p.end);p.groups.forEach((g,i)=>{if(i)assert.equal(g.start,p.groups[i-1].end)})}
assert.equal(JSON.stringify(day),before);
const spanning:Day={mode:'custom',goal:'',logs:[],blocks:[{id:'long',title:'研究原型',category:'work',start:660,end:810,note:'保持原始记录',done:false}]};
const split=dayOverview(spanning,defaults).flatMap(p=>p.groups).filter(g=>g.blocks.some(b=>b.id==='long'));
assert.deepEqual(split.map(g=>[g.start,g.end]),[[660,720],[720,810]]);
assert.equal(split.reduce((n,g)=>n+g.end-g.start,0),150);assert.equal(split[1].blocks[0],spanning.blocks[0]);
assert.equal(overviewGroupAt(split[0],720),false);assert.equal(overviewGroupAt(split[1],720),true);
const meals:Day={...spanning,blocks:[{...spanning.blocks[0],id:'prep',title:'准备晚餐',category:'meal',start:1110,end:1155},{...spanning.blocks[0],id:'eat',title:'晚餐',category:'meal',start:1155,end:1185},{...spanning.blocks[0],id:'clean',title:'收拾',category:'meal',start:1185,end:1200}]};
const meal=overviewGroups(meals,1080,1380).find(g=>g.category==='meal')!;
assert.equal(meal.title,'晚餐与收拾');assert.equal(meal.blocks.length,3);assert.equal(meal.end-meal.start,90);
const twoTasks:Day={...spanning,blocks:[{...spanning.blocks[0],id:'a',taskId:'a',start:660,end:690},{...spanning.blocks[0],id:'b',taskId:'b',start:690,end:720}]};
assert.equal(overviewGroups(twoTasks,660,720).length,2);
const empty=dayOverview({...spanning,blocks:[]},defaults);
assert.ok(empty.every(p=>p.groups.length===1&&p.groups[0].category===null));
assert.equal(empty.flatMap(p=>p.groups).reduce((n,g)=>n+g.end-g.start,0),1440);
console.log('PASS: overview preserves full-day duration, gaps, source records, cross-period task identity, meal grouping, distinct tasks, and empty plans');
