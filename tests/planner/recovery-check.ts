import assert from 'node:assert/strict';
import {GET,PUT} from '../../app/api/planner/route';
import {POST as focusApi} from '../../app/api/focus/route';
import {POST as planningApi} from '../../app/api/planning/route';
import {clock,daySchema,shiftDate,type Snapshot,type Active} from '../../lib/planner';
import {defaults,freshDraft,propose,routine,fixedRoutine,type Task} from '../../lib/planning';
import {nextStepFor,reviewDue,reviewedSession} from '../../lib/recovery';

const now=Date.now(),start=now-120*60000,date=clock(start).planDate;
const headers={'oai-authenticated-user-id':'recovery-user',origin:'https://planner.test','content-type':'application/json'};
const req=(route:string,method:string,body:unknown)=>new Request('https://planner.test/api/'+route,{method,headers,body:JSON.stringify(body)});
const read=async(d=date):Promise<Snapshot>=>{const r=await GET(new Request('https://planner.test/api/planner?date='+d,{headers}));assert.equal(r.status,200);return r.json()};
let state=await read();
const task:Task={id:'resume-task',title:'开发登录功能',category:'work',minutes:120,priority:1,fixedStart:null,status:'todo',note:'',createdAt:now,updatedAt:now};
let r=await planningApi(req('planning','POST',{action:'task',date,revision:state.revision,task}));assert.equal(r.status,200);state=(await r.json()).snapshot;
const day=routine({...defaults,gym:0});
const block={id:'resume-block',taskId:task.id,title:task.title,category:'work' as const,start:510,end:630,note:'',done:false};
day.blocks.push(block);day.blocks.sort((a,b)=>a.start-b.start);
const active:Active={id:'review-session',day:date,blockId:block.id,title:block.title,category:'work',startedAt:start};
r=await PUT(req('planner','PUT',{date,revision:state.revision,days:{[date]:day},active}));assert.equal(r.status,200);state=(await r.json()).snapshot;
const call=async(action:string,extra:Record<string,unknown>,revision=state.revision)=>focusApi(req('focus','POST',{action,date,revision,...extra}));
assert.equal((await focusApi(new Request('https://planner.test/api/focus',{method:'POST'}))).status,401);
assert.equal((await focusApi(new Request('https://planner.test/api/focus',{method:'POST',headers:{...headers,origin:'https://other.test'},body:'{}'}))).status,403);
r=await call('note',{targetDate:date,blockId:block.id,text:'先把提交按钮接上'});assert.equal(r.status,200);state=(await r.json()).snapshot;
assert.equal(nextStepFor(await read(),block),'先把提交按钮接上');
assert.deepEqual(state.days[date],day);assert.deepEqual(state.active,active);
const other=await GET(new Request('https://planner.test/api/planner?date='+date,{headers:{...headers,'oai-authenticated-user-id':'other-recovery-user'}}));assert.equal((await other.json()).tasks.length,0);
r=await call('note',{targetDate:date,blockId:block.id,text:'stale'},state.revision-1);assert.equal(r.status,409);assert.equal(nextStepFor(await read(),block),'先把提交按钮接上');
// Routine notes survive a reload without becoming global task notes.
const routineBlock=day.blocks.find(b=>!b.taskId)!;
r=await call('note',{targetDate:date,blockId:routineBlock.id,text:'先拿出猫咪牙刷'});assert.equal(r.status,200);state=(await r.json()).snapshot;
assert.equal(state.days[date].blocks.find(b=>b.id===routineBlock.id)!.nextStep,'先拿出猫咪牙刷');
// Keep means timestamps remain intact, and a confirmed session is not immediately nagged again.
assert.equal(reviewDue(active,now),true);
r=await call('review',{review:{sessionId:active.id,at:now-60*60000,kind:'keep',resume:true}});assert.equal(r.status,200);state=(await r.json()).snapshot;
assert.equal(state.active!.startedAt,start);assert.equal(state.days[date].logs.length,0);assert.equal(reviewDue(state.active,now),false);
// Split work / rest / work atomically; do not change any plan blocks.
const blocksBefore=structuredClone(state.days[date].blocks),review={sessionId:active.id,at:now-40*60000,kind:'break' as const,breakStart:start+20*60000,breakEnd:start+40*60000,resume:false};
const oldRevision=state.revision;r=await call('review',{review});assert.equal(r.status,200);state=(await r.json()).snapshot;
assert.equal(state.active,null);assert.deepEqual(state.days[date].blocks,blocksBefore);assert.equal(state.days[date].logs.length,3);
assert.equal(state.days[date].logs.filter(l=>l.category==='work').reduce((s,l)=>s+l.end-l.start,0),60*60000);
assert.equal(state.days[date].logs.filter(l=>l.category==='rest').reduce((s,l)=>s+l.end-l.start,0),20*60000);
r=await call('review',{review},oldRevision);assert.equal(r.status,409);assert.equal((await read()).days[date].logs.length,3);
r=await call('review',{review});assert.equal(r.status,400);
// A later session can be shortened without touching earlier logs.
const second={...active,id:'shorten-session',startedAt:now-30*60000};
r=await PUT(req('planner','PUT',{date,revision:state.revision,days:{},active:second}));assert.equal(r.status,200);state=(await r.json()).snapshot;
r=await call('review',{review:{sessionId:second.id,at:now,kind:'end',end:now-25*60000,resume:false}});assert.equal(r.status,200);state=(await r.json()).snapshot;
assert.equal(state.days[date].logs.length,4);assert.equal(state.days[date].logs.at(-1)!.end-state.days[date].logs.at(-1)!.start,5*60000);
assert.throws(()=>reviewedSession(active,{...review,kind:'break',breakStart:start-1,breakEnd:start+1000}));
assert.throws(()=>reviewedSession(active,{...review,kind:'end',end:now+1000}));
assert.throws(()=>reviewedSession(active,{...review,sessionId:'different'}));
assert.equal(reviewedSession(active,{...review,kind:'end',end:start}).logs.length,0);
// Epoch math remains correct across midnight and the fall DST transition.
const dstStart=Date.parse('2026-11-01T04:30:00Z'),dstActive={...active,startedAt:dstStart};
const cross=reviewedSession(dstActive,{sessionId:active.id,at:dstStart+4*3600000,kind:'break',breakStart:dstStart+3600000,breakEnd:dstStart+2*3600000,resume:false},dstStart+4*3600000);
assert.equal(cross.logs.reduce((s,l)=>s+l.end-l.start,0),4*3600000);

const tomorrow=shiftDate(clock().planDate,1),taskWithNote=state.tasks!.find(t=>t.id===task.id)!;
const draft={...freshDraft(),selectedIds:[task.id],gym:0,energy:'low' as const,recoveryMinutes:25};
const proposal=propose(tomorrow,routine({...defaults,gym:0}),defaults,[taskWithNote],draft);
const work=proposal.day.blocks.filter(b=>b.taskId===task.id);
assert.equal(work.reduce((sum,b)=>sum+b.end-b.start,0),25);assert.equal(work[0].nextStep,'先把提交按钮接上');assert.equal(work[0].partial,true);assert.equal(proposal.unplaced[0].id,task.id);
assert.equal(daySchema.safeParse(proposal.day).success,true);
for(const fixed of fixedRoutine(defaults).filter(b=>b.locked))assert.equal(proposal.day.blocks.find(b=>b.id===fixed.id)!.start,fixed.start);
const zero=propose(tomorrow,routine(defaults),defaults,[task],{...draft,recoveryMinutes:0});assert.equal(zero.day.blocks.some(b=>b.taskId===task.id),false);assert.equal(zero.unplaced.length,1);
const appointment={...task,id:'meeting',title:'电话会议',minutes:30,fixedStart:900};
const withMeeting=propose(tomorrow,routine(defaults),defaults,[task,appointment],{...draft,selectedIds:[task.id,appointment.id]});assert.equal(withMeeting.day.blocks.find(b=>b.taskId===appointment.id)!.start,900);
// The recovery draft persists; only explicit apply writes a plan. Partial completion keeps the task in the pool.
state=await read(tomorrow);
r=await planningApi(req('planning','POST',{action:'generate',date:tomorrow,revision:state.revision,selectedIds:[task.id],gym:0,energy:'low',recoveryMinutes:25}));assert.equal(r.status,200);state=(await r.json()).snapshot;
assert.equal(state.days[tomorrow],undefined);assert.equal(state.draft!.recoveryMinutes,25);
r=await planningApi(req('planning','POST',{action:'apply',date:tomorrow,revision:state.revision}));assert.equal(r.status,200);state=(await r.json()).snapshot;
const partialDay=structuredClone(state.days[tomorrow]);partialDay.blocks=partialDay.blocks.map(b=>b.taskId===task.id?{...b,done:true}:b);
r=await PUT(req('planner','PUT',{date:tomorrow,revision:state.revision,active:null,days:{[tomorrow]:partialDay}}));assert.equal(r.status,200);state=(await r.json()).snapshot;
assert.equal(state.tasks!.find(t=>t.id===task.id)!.status,'todo');assert.equal(nextStepFor(state,work[0]),'先把提交按钮接上');
const at=Date.parse('2026-09-07T13:00:00Z'); // 09:00 Toronto, partway through a flexible task.
const current=routine({...defaults,gym:0});current.blocks.push(block);current.blocks.sort((a,b)=>a.start-b.start);
const remaining=propose('2026-09-07',current,defaults,[task],draft,at);
assert.equal(remaining.day.blocks.find(b=>b.id===block.id)!.end,540);
assert.equal(remaining.day.blocks.filter(b=>b.taskId===task.id&&b.start>=540).reduce((sum,b)=>sum+b.end-b.start,0),25);
assert.deepEqual(remaining.day.logs,current.logs);assert.equal(remaining.conflicts.length,0);
console.log('PASS: durable next-step notes, task identity after replan, private writes, stale review rejection, confirmed timer, atomic rest split, shortened timer, DST epochs, recovery budget, protected anchors, explicit apply, partial work retained in backlog');
