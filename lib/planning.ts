import {z} from 'zod';
import {type Block,type Category,type Day,clock,daySchema,duration,hm} from './planner';
export const settingsSchema=z.object({wake:z.number().int().min(300).max(660),breakfast:z.number().int().min(300).max(720),lunch:z.number().int().min(600).max(960),dinner:z.number().int().min(960).max(1320),bed:z.number().int().min(1200).max(1440),cook:z.number().int().min(15).max(90),gym:z.number().int().min(0).max(180),workGoal:z.number().int().min(0).max(600),buffer:z.number().int().min(15).max(90)}).superRefine((s,c)=>{if(s.breakfast<s.wake+15||s.breakfast+45>s.lunch-30||s.lunch+90>s.dinner-s.cook||s.dinner+60>s.bed-90)c.addIssue({code:'custom',message:'作息时间太接近，请为洗漱、准备餐食和睡前照顾猫咪留出空间。'})});
export type Settings=z.infer<typeof settingsSchema>;
export const defaults:Settings={wake:450,breakfast:465,lunch:720,dinner:1155,bed:1380,cook:45,gym:120,workGoal:360,buffer:30};
export function settingsOf(v:unknown):Settings{const p=settingsSchema.safeParse(v);return p.success?p.data:defaults}
export const taskSchema=z.object({id:z.string().min(1).max(80),title:z.string().trim().min(1).max(160),category:z.enum(['work','meal','move','cat','life','rest']),minutes:z.number().int().min(5).max(600).nullable(),priority:z.number().int().min(1).max(3),fixedStart:z.number().int().min(0).max(1439).nullable(),status:z.enum(['todo','done','archived']),note:z.string().max(600),nextStep:z.string().max(240).optional(),createdAt:z.number(),updatedAt:z.number(),sourceDate:z.string().max(10).optional()});
export type Task=z.infer<typeof taskSchema>;
export type Proposal={day:Day,unplaced:{id:string,title:string,reason:string}[],warnings:string[],conflicts:string[],basedOnDay:string,basedOnSettings:string,basedOnTasks:string,generatedAt:number,from:number};
export type PlanningDraft={input:string,selectedIds:string[],stage:'capture'|'clarify'|'preview',energy:'low'|'normal'|'high',gym:number,delay?:number,recoveryMinutes?:number|null,proposal:Proposal|null,updatedAt:number};
export function freshDraft(s=defaults):PlanningDraft{return {input:'',selectedIds:[],stage:'capture',energy:'normal',gym:s.gym,delay:0,proposal:null,updatedAt:Date.now()}}
const key=(name:string)=>'routine-'+name;
function block(name:string,title:string,category:Category,start:number,end:number,locked=false,note=''):Block{return {id:key(name),title,category,start,end,locked,note,done:false}}
export function fixedRoutine(s=defaults):Block[]{return [
 block('wake','起床、洗漱','life',s.wake,s.wake+15,true),
 block('breakfast','早餐','meal',s.breakfast,s.breakfast+30,true,'准备并好好吃早餐。'),
 block('lunch-prep','准备午餐','meal',s.lunch-30,s.lunch),
 block('lunch','午餐','meal',s.lunch,s.lunch+30,true),
 block('cook','准备晚饭','meal',s.dinner-s.cook,s.dinner),
 block('dinner','晚餐','meal',s.dinner,s.dinner+30,true),
 block('cleanup','收拾与装明日午饭','meal',s.dinner+30,s.dinner+45),
 block('cat-care','猫咪晚间照顾','cat',s.bed-90,s.bed-60,false,'铲屎、换水、清洁碗与猫咪刷牙；白天仍正常供食供水。'),
 block('hygiene','自己的刷牙与洗漱','life',s.bed-60,s.bed-45),
 block('read','读书，慢慢入睡','rest',s.bed-45,s.bed,false,'困了就停，不设页数目标。'),
 block('sleep','睡眠','rest',s.bed,s.wake+1440,true),
 ].sort((a,b)=>a.start-b.start)}
export function routine(s=defaults):Day {const b=fixedRoutine(s);b.push(block('cats-am','陪猫玩 ①','cat',s.breakfast+30,s.breakfast+45),block('cats-pm','陪猫玩 ②','cat',s.dinner+45,s.dinner+60));if(s.gym&&s.lunch+90+s.gym<=s.dinner-s.cook)b.push(block('gym','健身房与往返','move',s.lunch+90,s.lunch+90+s.gym,false,'含换装、往返和洗澡；按脚踝与肩膀恢复情况调整。'));return {mode:'custom',goal:'',blocks:b.sort((a,b)=>a.start-b.start),logs:[]}}
function chineseNum(v:string){if(/^\d+(\.\d+)?$/.test(v))return Number(v);const digits:Record<string,number>={'零':0,'一':1,'二':2,'两':2,'三':3,'四':4,'五':5,'六':6,'七':7,'八':8,'九':9};if(v==='十')return 10;if(v.includes('十')){const [a,b]=v.split('十');return (a?digits[a]:1)*10+(b?digits[b]:0)}return digits[v]??NaN}
export function extractMinutes(text:string):number|null{
 const half=text.match(/([\d一二两三四五六七八九十]+)(?:个)?半小时/);if(half)return chineseNum(half[1])*60+30;
 if(/半(?:个)?小时|half an? hour/i.test(text))return 30;
 const range=text.match(/([\d一二两三四五六七八九十]+)\s*(?:到|至|[-–~])\s*([\d一二两三四五六七八九十]+)\s*(小时|分钟|hours?|minutes?)/i);if(range)return null;
 const m=text.match(/([\d.一二两三四五六七八九十]+)\s*(?:个)?\s*(小时|分钟|分(?!钟)|hours?|hrs?|minutes?|mins?)\s*(半)?/i);if(!m)return null;const n=chineseNum(m[1]);const value=Math.round(n*(/小时|hour|hr/i.test(m[2])?60:1)+(m[3]?30:0));return value>=5&&value<=600?value:null;
}
export function extractStart(text:string):number|null{
 const m=text.match(/(早上|上午|中午|下午|傍晚|晚上)?\s*(\d{1,2})[:：](\d{2})/);if(m){let h=Number(m[2]);if(/下午|傍晚|晚上/.test(m[1]??'')&&h<12)h+=12;const min=Number(m[3]);return h<24&&min<60?h*60+min:null}
 const c=text.match(/(早上|上午|中午|下午|傍晚|晚上)\s*([\d一二两三四五六七八九十]+)\s*点(半|一刻|三刻|\d{1,2}分?)?/);if(!c)return null;let h=chineseNum(c[2]);if(/下午|傍晚|晚上/.test(c[1])&&h<12)h+=12;const min=c[3]==='半'?30:c[3]==='一刻'?15:c[3]==='三刻'?45:parseInt(c[3]??'0');return h<24&&min<60?h*60+min:null;
}
export function parseBrainDump(input:string,date:string):Task[]{
 // Conservative extraction: keep the user's words, then explicitly ask for missing duration.
 const clauses=input.replace(/(?:然后|另外|再来|接着|以及|还要|还需要|还想)/g,'\n').replace(/和(?=(?:买|写|修|学|读|做|整理|处理|准备|联系|去))/g,'\n').replace(/\s+and\s+(?=(?:buy|write|fix|read|study|prepare|call|meet)\b)/gi,'\n').split(/[\n，,；;。]+/).map(x=>x.trim().replace(/^[-•\d]+[.)、]\s*/,''));const merged:string[]=[];
 for(const part of clauses){if(!part)continue;const timeOnly=/^(?:大约|大概|预计|需要|花|用|耗时)?\s*[\d一二两三四五六七八九十半.]+\s*(?:个)?\s*(小时|分钟|分|hours?|minutes?)(?:半)?$/i.test(part);if(timeOnly&&merged.length)merged[merged.length-1]+='，'+part;else merged.push(part)}
 return merged.slice(0,30).map(raw=>{const category:Category=/开会|会议|通话|call|meeting|代码|开发|修复|研究|工作|项目|code|debug/i.test(raw)?'work':/买菜|购物|做饭|清洁|家务|grocer/i.test(raw)?'meal':/健身|骑车|锻炼|运动|理疗|gym|bike/i.test(raw)?'move':/猫|cat/i.test(raw)?'cat':/读书|阅读|睡觉|read/i.test(raw)?'rest':'work';return {id:crypto.randomUUID(),title:raw.slice(0,160),category,minutes:extractMinutes(raw),priority:/最重要|优先|必须|一定|务必|urgent|must/i.test(raw)?1:/有空|顺便|可以以后|不急|maybe/i.test(raw)?3:2,fixedStart:extractStart(raw),status:'todo',note:raw.length>160?raw.slice(0,600):'',createdAt:Date.now(),updatedAt:Date.now(),sourceDate:date}});
}
function overlaps(a:Block,b:Block){return a.start<b.end&&a.end>b.start}
function gaps(blocks:Block[],from:number,to:number){const out:{start:number,end:number}[]=[];let cursor=from;for(const b of [...blocks].sort((a,b)=>a.start-b.start)){if(b.end<=cursor)continue;if(b.start>=to)break;if(b.start>cursor)out.push({start:cursor,end:Math.min(to,b.start)});cursor=Math.max(cursor,b.end)}if(cursor<to)out.push({start:cursor,end:to});return out}
export function taskFingerprint(tasks:Task[]){return JSON.stringify(tasks.map(t=>({id:t.id,title:t.title,minutes:t.minutes,priority:t.priority,fixedStart:t.fixedStart,status:t.status,category:t.category,nextStep:t.nextStep})).sort((a,b)=>a.id.localeCompare(b.id)))}
export function propose(date:string,current:Day,s:Settings,tasks:Task[],draft:PlanningDraft,now=Date.now()):Proposal{
 const time=clock(now,s.wake);const today=date===time.planDate;const from=today?Math.min(s.bed,Math.ceil((time.planMinute+5+(draft.delay??0))/5)*5):s.wake;
 const frozen=today?current.blocks.filter(b=>b.start<time.planMinute||b.done).map(b=>({...b,...(draft.recoveryMinutes!=null&&b.taskId&&!b.locked&&!b.done&&b.end>time.planMinute?{end:time.planMinute}:{})})):current.blocks.filter(b=>b.done).map(b=>({...b}));
 let blocks:Block[]=[...frozen,...current.blocks.filter(b=>!b.taskId&&!/^(routine-|normal-|shopping-|slow-)/.test(b.id)&&!frozen.some(f=>f.id===b.id)).map(b=>({...b,locked:true}))];const warnings:string[]=[],conflicts:string[]=[],unplaced:Proposal['unplaced']=[];
 const add=(b:Block,hard=false)=>{if(blocks.some(x=>x.id===b.id))return true;const collision=blocks.find(x=>overlaps(x,b));if(collision){if(hard&&!b.taskId&&frozen.some(f=>f.id===collision.id)&&collision.category===b.category&&collision.start<=b.start&&collision.end>=b.end)return true;if(hard)conflicts.push(`「${b.title}」${hm(b.start)} 与「${collision.title}」冲突。`);return false}blocks.push(b);return true};
 for(const b of fixedRoutine(s)){if(today&&b.start<time.planMinute)continue;add({...b,nextStep:current.blocks.find(x=>x.id===b.id)?.nextStep},true)}
 const taskBlock=(t:Task,start:number,end:number,i:number):Block=>({id:`task-${t.id}-${i}-${start}`,taskId:t.id,title:t.title.slice(0,80),category:t.category,start,end,locked:t.fixedStart!==null,note:t.note.slice(0,500),nextStep:t.nextStep,done:false});
 const selected=tasks.filter(t=>draft.selectedIds.includes(t.id)&&t.status==='todo').sort((a,b)=>draft.selectedIds.indexOf(a.id)-draft.selectedIds.indexOf(b.id));
 for(const t of selected.filter(t=>t.fixedStart!==null)){if(!t.minutes){unplaced.push({id:t.id,title:t.title,reason:'请确认预计时长'});continue}const start=t.fixedStart!;if(frozen.some(b=>b.taskId===t.id))continue;if(start<from||start+t.minutes>s.bed){conflicts.push(`「${t.title}」的固定时间已过去，或超出清醒时间。`);continue}add(taskBlock(t,start,start+t.minutes,0),true)}
 const placeRoutine=(b:Block,min:number,max:number)=>{b={...b,nextStep:current.blocks.find(x=>x.id===b.id)?.nextStep};if(today&&current.blocks.some(x=>x.id===b.id&&x.start<time.planMinute))return;if(blocks.some(x=>x.id===b.id))return;if(b.start>=from&&add(b))return;const duration=b.end-b.start;const windows=gaps(blocks,Math.max(from,min),max).filter(g=>g.end-g.start>=duration).sort((a,c)=>Math.abs(a.start-b.start)-Math.abs(c.start-b.start));if(windows[0])add({...b,start:windows[0].start,end:windows[0].start+duration});else warnings.push(`「${b.title}」还没有合适的空档，请调整时长或约会。`)};
 placeRoutine(block('cats-am','陪猫玩 ①','cat',s.breakfast+30,s.breakfast+45),s.breakfast+30,s.bed-90);
 placeRoutine(block('cats-pm','陪猫玩 ②','cat',s.dinner+45,s.dinner+60),s.breakfast+30,s.bed-90);
 const explicitGym=selected.some(t=>t.category==='move'&&/健身|gym/i.test(t.title));if(explicitGym&&draft.gym)warnings.push('已按你选中的健身任务安排，默认健身房时间窗不重复添加。');
 if(draft.gym&&!explicitGym)placeRoutine(block('gym','健身房与往返','move',s.lunch+90,s.lunch+90+draft.gym,false,'含往返、准备、训练和洗澡；按恢复情况调整。'),s.lunch+60,s.dinner-s.cook);
 if(s.buffer){const windows=gaps(blocks,from,s.bed-90).filter(g=>g.end-g.start>=s.buffer);const evening=[...windows].reverse()[0];if(evening)add(block('buffer','留白 · 休息或临时变化','life',evening.end-s.buffer,evening.end));else warnings.push('没有完整的缓冲时间，请减少一些任务。')}
 let budget=draft.recoveryMinutes??Infinity;
 const chunk=draft.energy==='low'?25:draft.energy==='high'?50:40;const rest=draft.energy==='low'?10:5;
 for(const t of selected.filter(t=>t.fixedStart===null).sort((a,b)=>a.priority-b.priority)){
  if(!t.minutes){unplaced.push({id:t.id,title:t.title,reason:'请确认预计时长'});continue}
  const doneMinutes=frozen.filter(b=>b.taskId===t.id).reduce((sum,b)=>sum+Math.max(b.done?b.end-b.start:0,current.logs.filter(l=>l.blockId===b.id).reduce((n,l)=>n+(l.end-l.start)/60000,0)),0);
  const needed=Math.max(0,t.minutes-Math.floor(doneMinutes));if(!needed)continue;let remaining=needed;const candidate=[...blocks];let count=0;
  const splittable=t.category==='work'&&!/开会|会议|通话|电话|call|meeting/i.test(t.title);
  if(budget<5||(!splittable&&budget<needed)){unplaced.push({id:t.id,title:t.title,reason:'超出这次留下的时间，继续保留在待办池。'});continue}
  remaining=Math.min(needed,budget);const allocation=remaining;
  const earliest=t.category==='move'&&/健身|gym/i.test(t.title)?Math.max(from,s.lunch+60):from;
  for(const g of gaps(candidate,earliest,s.bed-90)){if(!splittable&&g.end-g.start<remaining)continue;let cursor=g.start;while(remaining>=5&&g.end-cursor>=5){const len=Math.min(remaining,splittable?chunk:remaining,g.end-cursor);if(len<5)break;candidate.push(taskBlock(t,cursor,cursor+len,100+count++));cursor+=len;remaining-=len;if(t.category==='work'&&g.end-cursor>=rest){candidate.push(block(`break-${t.id}-${count}`,'短休息','life',cursor,cursor+rest));cursor+=rest}}
   if(remaining===0)break;
  }
  const placed=allocation-remaining;
  if(remaining===0||(draft.recoveryMinutes!=null&&splittable&&placed>0)){const existingCount=blocks.length;blocks=candidate.map((b,i)=>i>=existingCount&&b.taskId===t.id&&placed<needed?{...b,partial:true}:b);budget-=placed;if(placed<needed)unplaced.push({id:t.id,title:t.title,reason:`这次先推进 ${duration(placed)}，其余 ${duration(needed-placed)} 留在待办池，下次再决定。`})}
  else unplaced.push({id:t.id,title:t.title,reason:`还需 ${duration(needed)}，剩余空档不足；保留在待办池。`});
 }
 blocks.sort((a,b)=>a.start-b.start);const work=blocks.filter(b=>b.category==='work').reduce((sum,b)=>sum+b.end-b.start,0);if(work<s.workGoal)warnings.push(`已排工作 ${duration(work)}，你的目标是 ${duration(s.workGoal)}。可补充任务，也可以保留空档。`);if(work>480)warnings.push(`工作已超过 8 小时，请检查是否需要减少任务。`);
 const day:Day={...current,mode:'custom',goal:selected.find(t=>t.priority===1)?.title.slice(0,240)??current.goal,blocks};
 const valid=daySchema.safeParse(day);if(!valid.success)conflicts.push(valid.error.issues[0].message);
 return {day,unplaced,warnings,conflicts,basedOnDay:JSON.stringify(current),basedOnSettings:JSON.stringify(s),basedOnTasks:taskFingerprint(selected),generatedAt:now,from};
}
