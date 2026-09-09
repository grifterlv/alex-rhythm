import {localEpoch,ZONE,type Block} from './planner';

export const CALENDAR_SCOPE='https://www.googleapis.com/auth/calendar.app.created';
export const CALENDAR_SCOPES=CALENDAR_SCOPE+' openid email';
export type CalendarStatus={configured:boolean,connected:boolean,email?:string,calendarId?:string,pending?:boolean,syncing?:boolean,lastSyncedAt?:number|null,retryAt?:number,error?:string|null};
export class CalendarError extends Error {
 constructor(public code:string,public status=503){super(code);this.name='CalendarError'}
}
export async function digest(value:string){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value))),b=>b.toString(16).padStart(2,'0')).join('')}
export function base64url(bytes:Uint8Array){return btoa(String.fromCharCode(...bytes)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'')}
export function randomValue(){return base64url(crypto.getRandomValues(new Uint8Array(32)))}
export async function pkceChallenge(verifier:string){return base64url(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(verifier))))}
export function calendarBlockKeys(date:string,blocks:Block[]){
 const counts=new Map<string,number>();
 return [...blocks].sort((a,b)=>a.start-b.start).map(block=>{
  const part=block.taskId?(counts.get(block.taskId)??0):0;
  if(block.taskId)counts.set(block.taskId,part+1);
  return {block,key:date+'/'+(block.taskId?'task/'+block.taskId+'/'+part:'block/'+block.id)};
 });
}
export async function eventPayload(user:string,calendar:string,date:string,block:Block,localKey=date+'/block/'+block.id){
 const start=localEpoch(date,block.start),end=localEpoch(date,block.end);
 if(end<=start)throw new CalendarError('invalid_time',400);
 // Hex is a subset of Google's base32hex event-ID alphabet. IDs survive retries and time edits.
 const id='ar'+await digest(JSON.stringify([user,calendar,localKey]));
 return {id,summary:block.title,start:{dateTime:new Date(start).toISOString(),timeZone:ZONE},end:{dateTime:new Date(end).toISOString(),timeZone:ZONE},
  description:'Managed by Alex Rhythm. Edit this schedule in Alex Rhythm.',
  extendedProperties:{private:{alexRhythm:'1',localKey}},reminders:{useDefault:false},transparency:'opaque'};
}
export const calendarErrorText:Record<string,string>={
 not_configured:'日历连接尚未配置，请先完成 Google 应用设置。',
 reconnect:'Google 授权已失效，请重新连接。',
 permission:'没有获得所需的日历权限，请重新连接并允许访问。',
 calendar_missing:'同步日历无法访问。请在 Google Calendar 恢复该日历，或检查账户授权。',
 rate_limited:'Google 暂时限制了同步频率，稍后会重试。',
 google_unavailable:'暂时无法连接 Google，已保存的安排会在重试时继续同步。',
 invalid_time:'有一个时间块遇到夏令时冲突，请检查其开始和结束时间。',
 invalid_state:'这次连接已过期或来自另一窗口，请重新连接。',
 cancelled:'你取消了 Google 连接，日程没有变化。',
 busy:'另一页面正在同步，请稍候。',
 setup_uncertain:'Google 未确认日历创建结果。请先检查 Google Calendar，再选择是否新建同步日历。',
 storage:'暂时无法读取日历连接，请重试。',
};
