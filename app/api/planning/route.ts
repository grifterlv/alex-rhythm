import {z} from 'zod';
import {database} from '@/db';
import {snapshot,conditionalUpsert} from '@/db/snapshot';
import {clock,dateSchema,daySchema} from '@/lib/planner';
import {defaults,freshDraft,parseBrainDump,propose,routine,settingsSchema,taskSchema,taskFingerprint,type PlanningDraft,type Task} from '@/lib/planning';
export const dynamic='force-dynamic';
const json=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
const bodySchema=z.object({date:dateSchema,revision:z.number().int().min(0),action:z.enum(['capture','draft','generate','apply','settings','task']),input:z.string().max(6000).optional(),stage:z.enum(['capture','clarify']).optional(),selectedIds:z.array(z.string().max(80)).max(80).optional(),tasks:z.array(taskSchema).max(80).optional(),energy:z.enum(['low','normal','high']).optional(),gym:z.number().int().min(0).max(180).optional(),delay:z.number().int().min(0).max(120).optional(),recoveryMinutes:z.number().int().min(0).max(480).nullable().optional(),settings:settingsSchema.optional(),task:taskSchema.optional()});
export async function POST(req:Request){
 const id=req.headers.get('oai-authenticated-user-id');if(!id)return json({error:'请登录后规划日程。'},401);
 const origin=req.headers.get('origin');if(origin&&origin!==new URL(req.url).origin)return json({error:'请求来源无效'},403);
 try{
  const raw=await req.text();if(raw.length>300000)return json({error:'内容太长，请分批整理。'},413);
  const parsed=bodySchema.safeParse(JSON.parse(raw));if(!parsed.success)return json({error:parsed.error.issues[0]?.message??'输入无效'},400);
  const p=parsed.data;const state=await snapshot(id,p.date);
  if(state.revision!==p.revision)return json({error:'另一页面刚更新了记录，已载入最新内容。你的输入仍保留，请检查后重试。',snapshot:state},409);
  const settings=state.settings??defaults;const current=state.days[p.date]??routine(settings);const time=clock(Date.now(),settings.wake);
  if(['capture','draft','generate','apply'].includes(p.action)&&p.date<time.planDate)return json({error:'请规划今天或未来日期；过去的实际记录可在回顾里修改。'},400);
  let draft:PlanningDraft=structuredClone(state.draft??freshDraft(settings));
  let taskList=state.tasks??[];const updates:Task[]=[];const statements:D1PreparedStatement[]=[];
  if(p.action==='settings'){
   if(!p.settings)return json({error:'请填写作息设置'},400);
   statements.push(conditionalUpsert('planner_profiles',id,p.revision,undefined,p.settings));
  }else if(p.action==='task'){
   if(!p.task)return json({error:'任务信息缺失'},400);
   updates.push({...p.task,updatedAt:Date.now()});
   if(p.task.status==='done'||p.task.status==='archived'){
    const day={...current,blocks:current.blocks.map(b=>b.taskId===p.task!.id&&p.task!.status==='done'?{...b,done:true}:b)};
    if(state.active?.day===p.date&&current.blocks.some(b=>b.taskId===p.task!.id&&b.id===state.active!.blockId))return json({error:'请先暂停这个任务的计时，再修改任务状态。'},400);
    if(JSON.stringify(day)!==JSON.stringify(current))statements.push(conditionalUpsert('planner_days',id,p.revision,p.date,day));
   }
  }else if(p.action==='apply'){
   const proposal=draft.proposal;if(!proposal)return json({error:'请先生成一份日程草稿。'},400);
   if(proposal.conflicts.length)return json({error:'请先处理固定时间冲突，再生成草稿。'},400);
   const selected=taskList.filter(t=>draft.selectedIds.includes(t.id)&&t.status==='todo');
   if(proposal.basedOnDay!==JSON.stringify(current)||proposal.basedOnSettings!==JSON.stringify(settings)||proposal.basedOnTasks!==taskFingerprint(selected))return json({error:'日程、作息或任务已变化，请更新草稿后再确认。'},409);
   if(state.active?.day===p.date)return json({error:'请先暂停当天的计时，再应用新的日程。'},400);
   if(p.date===time.planDate&&Date.now()-proposal.generatedAt>5*60000)return json({error:'这份草稿已超过 5 分钟，请更新草稿，让计划从现在开始。'},409);
   const valid=daySchema.safeParse(proposal.day);if(!valid.success)return json({error:valid.error.issues[0].message},400);
   statements.push(conditionalUpsert('planner_days',id,p.revision,p.date,valid.data));
   draft={...draft,stage:'clarify',proposal:null,updatedAt:Date.now()};
   statements.push(conditionalUpsert('planner_drafts',id,p.revision,p.date,draft));
  }else{
   if(p.input!==undefined)draft.input=p.input;
   if(p.selectedIds)draft.selectedIds=[...new Set(p.selectedIds)];
   if(p.energy)draft.energy=p.energy;
   if(p.gym!==undefined)draft.gym=p.gym;
   if(p.delay!==undefined)draft.delay=p.delay;
   if(p.recoveryMinutes!==undefined)draft.recoveryMinutes=p.recoveryMinutes;
   if(p.tasks)updates.push(...p.tasks.map(t=>({...t,updatedAt:Date.now()})));
   if(p.action==='capture'){
    const text=draft.input.trim();if(!text)return json({error:'先写下想到的事，或直接从待办池选择。'},400);
    const existingNames=new Map(taskList.filter(t=>t.status==='todo').map(t=>[t.title.trim(),t]));
    const extracted=parseBrainDump(text,p.date);for(const t of extracted){const existing=existingNames.get(t.title.trim());if(existing){if(!draft.selectedIds.includes(existing.id))draft.selectedIds.push(existing.id)}else{updates.push(t);draft.selectedIds.push(t.id)}}
    draft.stage='clarify';
   }
   const map=new Map(taskList.map(t=>[t.id,t]));for(const t of updates)map.set(t.id,t);taskList=[...map.values()];
   draft.selectedIds=draft.selectedIds.filter(id=>taskList.some(t=>t.id===id&&t.status==='todo'));
   draft.proposal=null;
   if(p.action==='generate'){
    const missing=taskList.find(t=>draft.selectedIds.includes(t.id)&&t.minutes===null);if(missing)return json({error:`「${missing.title}」准备投入多久？请先选一个时长。`},400);
    draft.proposal=propose(p.date,current,settings,taskList,draft);draft.stage='preview';
   }else if(p.action==='draft')draft.stage=p.stage??'clarify';
   draft.updatedAt=Date.now();statements.push(conditionalUpsert('planner_drafts',id,p.revision,p.date,draft));
  }
  for(const t of updates)statements.push(conditionalUpsert('planner_tasks',id,p.revision,t.id,t));
  statements.push(database().prepare('UPDATE planner_accounts SET revision = revision + 1 WHERE user_id = ? AND revision = ? RETURNING revision').bind(id,p.revision));
  const results=await database().batch(statements);if(!results.at(-1)!.results.length)return json({error:'记录刚有变化，请检查最新内容后再试。',snapshot:await snapshot(id,p.date)},409);
  return json({snapshot:await snapshot(id,p.date)});
 }catch(e){console.error('planning',e);return json({error:e instanceof SyntaxError?'输入格式无效。':'暂时无法保存规划，你的输入仍保留，请重试。'},e instanceof SyntaxError?400:503)}
}
