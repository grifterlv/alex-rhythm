import type {Block,Day} from './planner';

export function suggestedBlock(day:Day,minute:number,isToday:boolean,selected:string,activeId?:string){
 return day.blocks.find(b=>b.id===selected)??day.blocks.find(b=>b.id===activeId)??
  day.blocks.find(b=>!b.done&&(!isToday||b.end>minute));
}

export type PlanChange={key:string,title:string,before:Block[],after:Block[],kind:'new'|'changed'|'removed'};
export function planChanges(before:Day,after:Day):PlanChange[]{
 const group=(blocks:Block[])=>{const map=new Map<string,Block[]>();for(const b of blocks){if(b.id.startsWith('routine-break-'))continue;const key=b.taskId?'task:'+b.taskId:b.id;map.set(key,[...(map.get(key)??[]),b])}return map};
 const old=group(before.blocks),next=group(after.blocks);
 const signature=(blocks:Block[])=>JSON.stringify([...blocks].sort((a,b)=>a.start-b.start).map(b=>[b.start,b.end,b.title,b.category,!!b.locked]));
 return [...new Set([...next.keys(),...old.keys()])].flatMap(key=>{
  const a=old.get(key)??[],b=next.get(key)??[];
  if(signature(a)===signature(b))return [];
  return [{key,title:(b[0]??a[0]).title,before:a,after:b,kind:!a.length?'new':!b.length?'removed':'changed'} as PlanChange];
 });
}
