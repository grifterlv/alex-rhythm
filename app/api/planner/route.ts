import {snapshot,conditionalUpsert} from '@/db/snapshot';
import { database } from '@/db';
import { activeSchema, dateSchema, daySchema, shiftDate, clock, type Day } from '@/lib/planner';
import { z } from 'zod';
export const dynamic='force-dynamic';
const json=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
function user(req:Request){return req.headers.get('oai-authenticated-user-id')}
export async function GET(req:Request){
 const id=user(req);if(!id)return json({error:'请登录后打开你的私人日程。'},401);
 const parsed=dateSchema.safeParse(new URL(req.url).searchParams.get('date'));if(!parsed.success)return json({error:'日期无效'},400);
 try{return json(await snapshot(id,parsed.data))}catch(e){console.error('planner load',e);return json({error:'暂时无法读取记录，请重试。'},503)}
}
const updateSchema=z.object({date:dateSchema,revision:z.number().int().min(0),active:activeSchema,days:z.record(dateSchema,daySchema)}).refine(v=>Object.keys(v.days).length<=2);
export async function PUT(req:Request){
 const id=user(req);if(!id)return json({error:'请登录后保存日程。'},401);
 const origin=req.headers.get('origin');if(origin&&origin!==new URL(req.url).origin)return json({error:'请求来源无效'},403);
 try {
  const raw=await req.text();if(raw.length>1500000)return json({error:'单次记录过多，请分开保存。'},413);
  const parsed=updateSchema.safeParse(JSON.parse(raw));if(!parsed.success)return json({error:parsed.error.issues[0]?.message||'记录格式无效'},400);
  const p=parsed.data;
  for(const [date,day] of Object.entries(p.days)){
   const sorted=[...day.logs].sort((a,b)=>a.start-b.start);
   if(sorted.some(l=>![date,shiftDate(date,1)].includes(clock(l.start).date)))return json({error:'实际开始时间需属于对应作息日。'},400);
   if(sorted.some(l=>l.end>Date.now()+60000))return json({error:'实际记录的结束时间不能晚于现在。'},400);
   if(p.active?.day===date&&sorted.some(l=>l.end>p.active!.startedAt))return json({error:'记录与正在进行的计时重叠，请先暂停。'},400);
  }
  if(p.active&&![p.active.day,shiftDate(p.active.day,1)].includes(clock(p.active.startedAt).date))return json({error:'计时所属日期无效'},400);
  if(p.active&&p.active.startedAt>Date.now()+60000)return json({error:'计时开始时间无效'},400);
  const db=database();
  const incoming=Object.values(p.days).flatMap(d=>d.logs);
  const ranges=[...incoming,...(p.active?[{start:p.active.startedAt,end:Date.now()+1}]:[])];
  if(ranges.length){
   const keys=Object.keys(p.days);
   const lower=Math.min(...ranges.map(l=>l.start)),upper=Math.max(...ranges.map(l=>l.end));
   const exclusion=keys.length?' AND d.date NOT IN ('+keys.map(()=>'?').join(',')+')':'';
   const existing=await db.prepare("SELECT j.value AS value FROM planner_days d, json_each(d.data, '$.logs') j WHERE d.user_id = ?"+exclusion+" AND json_extract(j.value, '$.end') > ? AND json_extract(j.value, '$.start') < ?").bind(id,...keys,lower,upper).all();
   const all=[...ranges,...existing.results.map(r=>JSON.parse(r.value as string))].sort((a,b)=>a.start-b.start);
   if(all.some((l,i)=>i>0&&l.start<all[i-1].end))return json({error:'这段时间与已有记录或正在进行的计时重叠，请先修正。'},400);
  }
  const statements=Object.entries(p.days).map(([date,day]:[string,Day])=>db.prepare('INSERT INTO planner_days (user_id, date, data) SELECT ?, ?, ? FROM planner_accounts WHERE user_id = ? AND revision = ? ON CONFLICT(user_id, date) DO UPDATE SET data = excluded.data').bind(id,date,JSON.stringify(day),id,p.revision));
  const current=await snapshot(id,p.date);
  for(const task of current.tasks??[]){
   const linked=Object.values(p.days).flatMap(day=>day.blocks.filter(b=>b.taskId===task.id));
   if(!linked.length)continue;
   const finished=linked.every(b=>b.done)&&(!linked.some(b=>b.partial)||linked.reduce((sum,b)=>sum+b.end-b.start,0)>=(task.minutes??Infinity));
   const status=finished?'done':task.status==='archived'?'archived':'todo';
   if(task.status!==status)statements.push(conditionalUpsert('planner_tasks',id,p.revision,task.id,{...task,status,updatedAt:Date.now()}));
  }
  statements.push(db.prepare('UPDATE planner_accounts SET active = ?, revision = revision + 1 WHERE user_id = ? AND revision = ? RETURNING revision').bind(p.active?JSON.stringify(p.active):null,id,p.revision));
  const results=await db.batch(statements);
  if(!results[results.length-1].results.length)return json({error:'另一页面刚更新了记录，已同步最新内容。请检查后再保存。',snapshot:await snapshot(id,p.date)},409);
  return json({revision:p.revision+1,snapshot:await snapshot(id,p.date)});
 }catch(e){console.error('planner save',e);return json({error:e instanceof SyntaxError?'记录格式无效':'保存暂时失败，你的输入还在，请重试。'},e instanceof SyntaxError?400:503)}
}
