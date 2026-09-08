import {z} from 'zod';
import type {Active,Block,Log,Snapshot} from './planner';

export function nextStepFor(data:Snapshot,block?:Block){
 return block?.taskId?data.tasks?.find(t=>t.id===block.taskId)?.nextStep??block.nextStep??'':block?.nextStep??'';
}
export const REVIEW_AFTER_MS=90*60000;
export function reviewDue(active:Active,now:number){
 return !!active&&now-Math.max(active.startedAt,active.reviewedAt??0)>=REVIEW_AFTER_MS;
}
export const reviewSchema=z.object({
 sessionId:z.string().min(1).max(80),at:z.number().finite().positive(),
 kind:z.enum(['keep','end','break']),end:z.number().finite().positive().optional(),
 breakStart:z.number().finite().positive().optional(),breakEnd:z.number().finite().positive().optional(),
 resume:z.boolean(),
});
export type TimerReview=z.infer<typeof reviewSchema>;

// This transforms only the session the user reviewed. Never infer work from tab visibility.
export function reviewedSession(active:Active,input:TimerReview,now=Date.now()):{active:Active,logs:Log[]}{
 if(!active||active.id!==input.sessionId)throw new Error('这段计时已在其他页面变化，请关闭窗口后重新核对。');
 if(input.at<=active.startedAt||input.at>now)throw new Error('核对时间无效，请重新打开核对窗口。');
 if(input.resume){
  if(input.kind!=='keep')throw new Error('修正后会暂停计时，准备好后可以重新开始。');
  return {active:{...active,reviewedAt:input.at},logs:[]};
 }
 const logs:Log[]=[];
 const add=(start:number,end:number,rest=false)=>{if(end<=start)return;logs.push({id:logs.length?crypto.randomUUID():active.id,blockId:rest?'':active.blockId,title:rest?'休息（核对补记）':active.title,category:rest?'rest':active.category,start,end})};
 if(input.kind==='keep')add(active.startedAt,input.at);
 if(input.kind==='end'){
  if(input.end===undefined||input.end<active.startedAt||input.end>input.at)throw new Error('结束时间需在这次计时开始与核对时间之间。');
  add(active.startedAt,input.end);
 }
 if(input.kind==='break'){
  const start=input.breakStart,end=input.breakEnd;
  if(start===undefined||end===undefined||start<active.startedAt||end>input.at||end<=start)throw new Error('休息起止时间需落在这段计时内，且结束晚于开始。');
  add(active.startedAt,start);add(start,end,true);add(end,input.at);
 }
 return {active:null,logs};
}
