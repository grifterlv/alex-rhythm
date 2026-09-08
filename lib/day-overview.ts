import {categories,type Block,type Day} from './planner';
import type {Settings} from './planning';

export type OverviewGroup={id:string,start:number,end:number,category:Block['category']|null,title:string,blocks:Block[]};
export type OverviewPeriod={id:string,title:string,start:number,end:number,groups:OverviewGroup[]};
function groupTitle(blocks:Block[]){
 if(blocks.length===1)return blocks[0].title;
 if(blocks.every(b=>b.taskId&&b.taskId===blocks[0].taskId))return blocks[0].title;
 const titles=blocks.map(b=>b.title).join(' ');
 if(blocks[0].category==='meal'){
  if(/晚饭|晚餐/.test(titles))return '晚餐与收拾';
  if(/午饭|午餐/.test(titles))return '午餐与准备';
  if(/早餐/.test(titles))return '早餐与准备';
 }
 return blocks.every(b=>b.title===blocks[0].title)?blocks[0].title:categories[blocks[0].category].label;
}

// Presentation only: clip across period boundaries, preserve source IDs, and include every gap.
export function overviewGroups(day:Day,start:number,end:number):OverviewGroup[]{
 const out:OverviewGroup[]=[];let cursor=start;
 const gap=(a:number,b:number)=>{if(b>a)out.push({id:`gap-${a}-${b}`,start:a,end:b,category:null,title:'留白',blocks:[]})};
 for(const block of [...day.blocks].sort((a,b)=>a.start-b.start)){
  if(block.end<=start||block.start>=end)continue;
  const a=Math.max(start,block.start),b=Math.min(end,block.end);gap(cursor,a);
  const previous=out.at(-1);
  const merge=previous&&previous.end===a&&previous.category===block.category&&
   ((!block.taskId&&previous.blocks.every(x=>!x.taskId)&&(block.category==='meal'||previous.blocks.every(x=>x.title===block.title)))||!!block.taskId&&previous.blocks.every(x=>x.taskId===block.taskId));
  if(merge){previous.end=b;previous.blocks.push(block);previous.title=groupTitle(previous.blocks)}
  else out.push({id:`${block.id}-${a}`,start:a,end:b,category:block.category,title:block.title,blocks:[block]});
  cursor=b;
 }
 gap(cursor,end);return out;
}
export function dayOverview(day:Day,settings:Settings):OverviewPeriod[]{
 const start=Math.min(settings.wake,...day.blocks.map(b=>b.start));
 const end=Math.max(settings.wake+1440,...day.blocks.map(b=>b.end));
 const parts=[{id:'morning',title:'上午',start,end:720},{id:'afternoon',title:'下午',start:720,end:1080},{id:'evening',title:'晚上',start:1080,end:settings.bed},{id:'night',title:'夜间',start:settings.bed,end}];
 return parts.filter(p=>p.end>p.start).map(p=>({...p,groups:overviewGroups(day,p.start,p.end)}));
}
export function overviewGroupAt(group:OverviewGroup,minute:number){return group.start<=minute&&minute<group.end}
