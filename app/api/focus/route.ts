import {z} from 'zod';
import {database} from '@/db';
import {conditionalUpsert,snapshot} from '@/db/snapshot';
import {dateSchema,daySchema} from '@/lib/planner';
import {routine} from '@/lib/planning';
import {reviewSchema,reviewedSession} from '@/lib/recovery';
export const dynamic='force-dynamic';
const json=(value:unknown,status=200)=>Response.json(value,{status,headers:{'Cache-Control':'no-store'}});
const schema=z.discriminatedUnion('action',[
 z.object({action:z.literal('note'),date:dateSchema,revision:z.number().int().min(0),targetDate:dateSchema,blockId:z.string().min(1).max(80),text:z.string().trim().max(240)}),
 z.object({action:z.literal('review'),date:dateSchema,revision:z.number().int().min(0),review:reviewSchema}),
]);
export async function POST(req:Request){
 const id=req.headers.get('oai-authenticated-user-id');if(!id)return json({error:'请登录后保存。'},401);
 const origin=req.headers.get('origin');if(origin&&origin!==new URL(req.url).origin)return json({error:'请求来源无效'},403);
 try{
  const raw=await req.text();if(raw.length>10000)return json({error:'内容太长，请缩短后重试。'},413);
  const parsed=schema.safeParse(JSON.parse(raw));if(!parsed.success)return json({error:'输入格式无效，请检查后重试。'},400);
  const p=parsed.data,state=await snapshot(id,p.date),db=database();
  if(state.revision!==p.revision)return json({error:'另一页面刚更新了记录，已同步。请检查后重试。',snapshot:state},409);
  const statements:D1PreparedStatement[]=[];let active=state.active;
  if(p.action==='note'){
   const target=state.days[p.targetDate]??(await snapshot(id,p.targetDate)).days[p.targetDate]??routine(state.settings);
   const block=target.blocks.find(b=>b.id===p.blockId);if(!block)return json({error:'这个时间块已经变化，请重新选择任务。'},409);
   if(block.taskId){
    const task=state.tasks?.find(t=>t.id===block.taskId);if(!task)return json({error:'找不到这个任务，请重新载入。'},409);
    statements.push(conditionalUpsert('planner_tasks',id,p.revision,task.id,{...task,nextStep:p.text,updatedAt:Date.now()}));
   }else{
    const day={...target,blocks:target.blocks.map(b=>b.id===block.id?{...b,nextStep:p.text}:b)};
    statements.push(conditionalUpsert('planner_days',id,p.revision,p.targetDate,day));
   }
  }else{
   let result;try{result=reviewedSession(active,p.review)}catch(e){return json({error:(e as Error).message},400)}
   const date=active!.day,day=state.days[date]??routine(state.settings);
   if(result.logs.length){
    const revised={...day,logs:[...day.logs,...result.logs].sort((a,b)=>a.start-b.start)};
    const valid=daySchema.safeParse(revised);if(!valid.success)return json({error:valid.error.issues[0].message},400);
    const start=result.logs[0].start,end=result.logs.at(-1)!.end;
    const overlaps=await db.prepare("SELECT 1 FROM planner_days d, json_each(d.data, '$.logs') j WHERE d.user_id = ? AND json_extract(j.value, '$.end') > ? AND json_extract(j.value, '$.start') < ? LIMIT 1").bind(id,start,end).all();
    if(overlaps.results.length)return json({error:'这段时间与已有记录重叠，请先在回顾中检查。'},400);
    statements.push(conditionalUpsert('planner_days',id,p.revision,date,valid.data));
   }
   active=result.active;
  }
  statements.push(db.prepare('UPDATE planner_accounts SET active = ?, revision = revision + 1 WHERE user_id = ? AND revision = ? RETURNING revision').bind(active?JSON.stringify(active):null,id,p.revision));
  const result=await db.batch(statements);
  if(!result.at(-1)!.results.length)return json({error:'记录刚有变化，请检查后再试。',snapshot:await snapshot(id,p.date)},409);
  return json({snapshot:await snapshot(id,p.date)});
 }catch(e){console.error('focus save',e);return json({error:e instanceof SyntaxError?'输入格式无效。':'保存暂时失败，输入仍在，请重试。'},e instanceof SyntaxError?400:503)}
}
