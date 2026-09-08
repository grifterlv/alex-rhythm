import { z } from 'zod';
import type {Settings,Task,PlanningDraft} from './planning';
export const ZONE = 'America/Toronto';
export const categories = {
 work: { label: '工作', color: '#6470d9', pale: '#eef0ff' },
 meal: { label: '饮食与家务', color: '#cf9150', pale: '#fff4e6' },
 move: { label: '运动', color: '#428c77', pale: '#eaf5ef' },
 cat: { label: '猫咪', color: '#b579a1', pale: '#f8edf5' },
 life: { label: '生活与社交', color: '#799096', pale: '#edf4f4' },
 rest: { label: '阅读与睡眠', color: '#8183a1', pale: '#f0eff8' },
} as const;
export type Category = keyof typeof categories;
const catSchema = z.enum(['work','meal','move','cat','life','rest']);
export const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v => !isNaN(Date.parse(v)) && new Date(v).toISOString().slice(0,10) === v);
export const blockSchema = z.object({id:z.string().min(1).max(80),title:z.string().trim().min(1).max(80),category:catSchema,start:z.number().int().min(0).max(2879),end:z.number().int().min(1).max(2880),note:z.string().max(500),nextStep:z.string().max(240).optional(),partial:z.boolean().optional(),done:z.boolean(),locked:z.boolean().optional(),taskId:z.string().max(80).optional()}).refine(b=>b.end>b.start,'结束时间需晚于开始时间');
export const logSchema = z.object({id:z.string().min(1).max(80),blockId:z.string().max(80),title:z.string().trim().min(1).max(80),category:catSchema,start:z.number().finite().positive(),end:z.number().finite().positive()}).refine(l=>l.end>l.start,'实际时长无效');
export const daySchema = z.object({mode:z.enum(['normal','shopping','slow','custom']),goal:z.string().max(240),blocks:z.array(blockSchema).max(80),logs:z.array(logSchema).max(500)}).superRefine((d,ctx)=>{
 const b=[...d.blocks].sort((a,b)=>a.start-b.start);
 if(b.some((v,i)=>i>0&&v.start<b[i-1].end))ctx.addIssue({code:'custom',message:'计划时间有重叠，请先调整相邻时间块'});
 if(new Set(b.map(v=>v.id)).size!==b.length)ctx.addIssue({code:'custom',message:'时间块编号重复'});
 const logs=[...d.logs].sort((a,b)=>a.start-b.start);
 if(logs.some((v,i)=>i>0&&v.start<logs[i-1].end))ctx.addIssue({code:'custom',message:'实际记录有重叠，请调整起止时间'});
});
export const activeSchema = z.object({id:z.string().max(80),day:dateSchema,blockId:z.string().max(80),title:z.string().max(80),category:catSchema,startedAt:z.number().finite().positive(),reviewedAt:z.number().finite().positive().optional()}).nullable();
export type Block=z.infer<typeof blockSchema>;
export type Log=z.infer<typeof logSchema>;
export type Day=z.infer<typeof daySchema>;
export type Active=z.infer<typeof activeSchema>;
export type Snapshot={revision:number,active:Active,days:Record<string,Day>,settings?:Settings,tasks?:Task[],draft?:PlanningDraft|null};
export function shiftDate(date:string,n:number){return new Date(Date.parse(date+'T12:00:00Z')+n*86400000).toISOString().slice(0,10)}
export function clock(now=Date.now(),dayStart=450) {
 const parts=new Intl.DateTimeFormat('en-CA',{timeZone:ZONE,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(now);
 const p=Object.fromEntries(parts.map(v=>[v.type,v.value]));
 const date=`${p.year}-${p.month}-${p.day}`;const min=Number(p.hour)*60+Number(p.minute);
 return {date,min,planDate:min<dayStart?shiftDate(date,-1):date,planMinute:min<dayStart?min+1440:min};
}
export function localEpoch(date:string,minute:number){
 const d=shiftDate(date,Math.floor(minute/1440));const m=minute%1440;
 const target=Date.parse(`${d}T${String(Math.floor(m/60)).padStart(2,'0')}:${String(m%60).padStart(2,'0')}:00Z`);
 let guess=target;
 for(let i=0;i<4;i++){const p=clock(guess);const local=Date.parse(p.date+'T00:00:00Z')+p.min*60000;guess+=target-local;}
 const check=clock(guess);if(check.date!==d||check.min!==m)throw new Error('这个本地时间因夏令时调整而不存在，请换一个时间');return guess;
}
export function hm(min:number){return `${String(Math.floor((min%1440)/60)).padStart(2,'0')}:${String(min%60).padStart(2,'0')}`}
export function minutes(value:string,dayStart=450){const [h,m]=value.split(':').map(Number);const n=h*60+m;return n<dayStart?n+1440:n}
export function duration(min:number){const n=Math.max(0,Math.round(min));return n>=60?`${Math.floor(n/60)} 小时${n%60?' '+n%60+' 分':''}`:`${n} 分钟`}
export function localInput(ms:number){const p=clock(ms);return p.date+'T'+hm(p.min)}
export function parseLocalInput(value:string){const [d,t]=value.split('T');const [h,m]=t.split(':').map(Number);return localEpoch(d,h*60+m)}
export function elapsed(ms:number){const s=Math.max(0,Math.floor(ms/1000));return `${String(Math.floor(s/3600)).padStart(2,'0')}:${String(Math.floor(s/60)%60).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`}
const base: [string,Category,number,number,string][] = [
 ['起床、洗漱','life',450,465,'拉开窗帘，喝水，把手机留在一边。'],
 ['准备并吃早餐','meal',465,495,'默认组合：燕麦＋原味酸奶或豆奶＋水果。'],
 ['陪猫玩 ①','cat',495,510,'两只轮流玩，15 分钟就完成这一轮。'],
 ['工作 ① · 核心任务','work',510,690,'先写一个小动作。工作 25–40 分钟，短休 3–5 分钟；休息时暂停计时。'],
 ['准备午餐','meal',690,720,'加热昨晚留好的午饭，补一份蔬菜。'],
 ['午餐','meal',720,750,'好好吃饭，不需要赶。'],
 ['轻工作 ②','work',750,810,'邮件、回复、整理。想饭后走走时，用其中 5–10 分钟，按脚踝耐受调整。'],
 ['健身房与往返','move',810,930,'含换装、通勤、训练与洗澡；约 14:00 开始训练。运动按脚踝和肩膀恢复情况调整。'],
 ['工作 ③ · 推进与收尾','work',930,1110,'下午集中推进，结束前写下明天的第一步。'],
 ['做晚饭、吃饭与收拾','meal',1110,1200,'做饭 45 分钟＋吃饭 30 分钟＋收拾、装明日午饭 15 分钟。'],
 ['陪猫玩 ②','cat',1200,1215,'再玩 15 分钟，今天合计 30 分钟。'],
 ['社交与自由时间','life',1215,1290,'和朋友或 Sabrina 通话、放松。精力允许可挪 1 小时工作。'],
 ['猫咪晚间照顾','cat',1290,1320,'铲屎、清洁碗、换水、猫咪刷牙或适应练习。白天仍按习惯供食供水。'],
 ['自己的刷牙与洗漱','life',1320,1335,'洗漱后调暗灯光，把明天需要的物品放门边。'],
 ['读书，慢慢入睡','rest',1335,1380,'纸书或低亮度阅读器，不设页数目标，困了就停。'],
 ['睡眠','rest',1380,1890,'23:00–次日 07:30，预留 8.5 小时睡眠窗口。'],
];
export function template(mode:Day['mode']='normal'):Day{
 let rows=base;
 if(mode==='shopping') rows=[...base.slice(0,9),['简餐与收拾','meal',1110,1170,'用预备餐，给买菜留时间。'],['陪猫玩 ②','cat',1170,1185,'15 分钟。'],['准备购物清单','meal',1185,1200,'先看冰箱，再拿购物袋。'],['买菜、往返与归置','meal',1200,1290,'固定清单；重物可配送。出发前确认营业时间。'],...base.slice(12)] as typeof base;
 if(mode==='slow') rows=[...base.slice(0,9),['做晚饭、吃饭与收拾','meal',1110,1230,'给做饭、吃饭、清洁和装午饭完整 2 小时。'],['陪猫玩 ②','cat',1230,1245,'15 分钟。'],['社交与自由时间','life',1245,1290,'留 45 分钟放松，不挤占睡眠。'],...base.slice(12)] as typeof base;
 return {mode,goal:'',blocks:rows.map(([title,category,start,end,note],i)=>({id:`${mode}-${i}`,title,category,start,end,note,done:false})),logs:[]};
}
export function getDay(s:Snapshot,date:string):Day{return s.days[date]??template()}
export function totals(day:Day,active:Active,date:string,now:number){
 return Object.keys(categories).map(key=>{const cat=key as Category;return {cat,...categories[cat],planned:day.blocks.filter(b=>b.category===cat).reduce((s,b)=>s+b.end-b.start,0),actual:day.logs.filter(l=>l.category===cat).reduce((s,l)=>s+(l.end-l.start)/60000,0)+(active?.day===date&&active.category===cat?Math.max(0,now-active.startedAt)/60000:0)}});
}
