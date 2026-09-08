import type {Block,Category,Snapshot} from './planner';

export const focusScenes={desk:'书桌',reading:'阅读角',cycling:'健身房',cats:'猫咪乐园',kitchen:'小厨房',rest:'窗边休息'} as const;
export type FocusScene=keyof typeof focusScenes;
export type FocusTarget={date:string,id:string};

export function sceneForActivity(activity:{title:string,category:Category}|undefined):FocusScene{
 if(!activity)return 'rest';
 const title=activity.title;
 if(/睡|休息|散步|社交|通话|买菜|购物|sleep|rest|walk|grocer|shopping|dormir|descans|pasear|caminar|compras/i.test(title))return 'rest';
 if(/读书|阅读|read|book|leer|lectura|libro/i.test(title))return 'reading';
 if(activity.category==='cat')return 'cats';
 if(activity.category==='meal')return 'kitchen';
 if(activity.category==='move')return 'cycling';
 if(activity.category==='work')return 'desk';
 return 'rest';
}

export function focusRecord(data:Snapshot,target:FocusTarget|null,fallback?:Block){
 const active=data.active;
 const date=active?.day??target?.date??'';
 const id=active?.blockId??target?.id??'';
 const day=data.days[date];
 const block=day?.blocks.find(b=>b.id===id)??(fallback?.id===id?fallback:undefined);
 const activity=active?{title:active.title,category:active.category}:block;
 const savedMs=(day?.logs??[]).filter(l=>l.blockId===id).reduce((sum,l)=>sum+l.end-l.start,0);
 return {date,id,block,activity,savedMs,running:!!active,done:!!block?.done&&!active};
}

// Wall-clock timestamps, not animation frames, remain the authority for actual time.
export function focusElapsed(savedMs:number,startedAt:number|undefined,now:number){
 return Math.max(0,savedMs)+(startedAt===undefined?0:Math.max(0,now-startedAt));
}

export function shouldAnimate(visible:boolean,running:boolean,motion:boolean,reducedMotion:boolean){
 return visible&&running&&motion&&!reducedMotion;
}
