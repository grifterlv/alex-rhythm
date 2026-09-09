import {database} from './index';
import {clock,daySchema,shiftDate} from '@/lib/planner';
import {CalendarError,calendarBlockKeys,digest,eventPayload,type CalendarStatus} from '@/lib/calendar';
import {calendarConfig,calendarRequest,seal,tokenRequest,unseal} from '@/lib/google-calendar';

type Connection={user_id:string,google_sub:string,email:string,refresh_token:string|null,calendar_id:string|null,start_date:string,last_revision:number,last_window:string|null,last_synced_at:number|null,error:string|null,retry_at:number,lock_token:string|null,lock_until:number};
type EventRow={local_key:string,date:string,event_id:string,fingerprint:string};
export async function connection(user:string){return (await database().prepare('SELECT * FROM calendar_connections WHERE user_id = ?').bind(user).all()).results[0] as Connection|undefined}
export async function calendarStatus(user:string):Promise<CalendarStatus>{
 if(!calendarConfig())return {configured:false,connected:false};
 const c=await connection(user);if(!c)return {configured:true,connected:false};
 const a=(await database().prepare('SELECT revision FROM planner_accounts WHERE user_id = ?').bind(user).all()).results[0];
 return {configured:true,connected:!!c.refresh_token,email:c.email,calendarId:c.calendar_id&&c.calendar_id!=='creating'?c.calendar_id:undefined,
  pending:!!c.refresh_token&&(c.last_revision!==Number(a?.revision??0)||c.last_window!==clock().date),syncing:c.lock_until>Date.now(),lastSyncedAt:c.last_synced_at,retryAt:c.retry_at,error:c.error};
}
export async function acquireCalendarLock(user:string){
 const token=crypto.randomUUID();const r=await database().prepare('UPDATE calendar_connections SET lock_token = ?, lock_until = ? WHERE user_id = ? AND lock_until < ? RETURNING *').bind(token,Date.now()+120000,user,Date.now()).all();
 const c=r.results[0] as Connection|undefined;if(!c)throw new CalendarError('busy',409);return {...c,lock_token:token};
}
export async function releaseCalendarLock(user:string,token:string){await database().prepare('UPDATE calendar_connections SET lock_token = NULL, lock_until = 0 WHERE user_id = ? AND lock_token = ?').bind(user,token).run()}
export async function syncCalendar(user:string){
 const initial=await connection(user);if(!initial?.refresh_token)throw new CalendarError('reconnect',401);
 if(initial.retry_at>Date.now())return calendarStatus(user);
 const c=await acquireCalendarLock(user),db=database();const deadline=Date.now()+18000;let count=0;
 try{
  if(!c.refresh_token)throw new CalendarError('reconnect',401);
  let access:string|undefined;
  const auth=async()=>{
   if(access)return access;
   const token=await tokenRequest({grant_type:'refresh_token',refresh_token:await unseal(c.refresh_token!,user)});access=token.access_token;
   if(token.refresh_token)await db.prepare('UPDATE calendar_connections SET refresh_token = ? WHERE user_id = ? AND lock_token = ?').bind(await seal(token.refresh_token,user),user,c.lock_token).run();
   return access;
  };
  if(c.calendar_id==='creating')throw new CalendarError('setup_uncertain');
  if(!c.calendar_id){
   const accessToken=await auth();
   // Persist before this non-idempotent request: an ambiguous response must never create duplicates automatically.
   await db.prepare("UPDATE calendar_connections SET calendar_id = 'creating' WHERE user_id = ? AND lock_token = ?").bind(user,c.lock_token).run();
   c.calendar_id='creating';
   const result=await calendarRequest('/calendars',accessToken,'POST',{summary:'Alex Rhythm',description:'Confirmed schedules from Alex Rhythm. Make schedule changes in Alex Rhythm.',timeZone:'America/Toronto'});
   if(!result.data?.id)throw new CalendarError('setup_uncertain');c.calendar_id=String(result.data.id);
   await db.prepare('UPDATE calendar_connections SET calendar_id = ? WHERE user_id = ? AND lock_token = ?').bind(c.calendar_id,user,c.lock_token).run();
  }
  const today=clock().date,from=c.start_date>shiftDate(today,-1)?c.start_date:shiftDate(today,-1),to=shiftDate(today,60);
  const rows=await db.batch([
   db.prepare('SELECT revision FROM planner_accounts WHERE user_id = ?').bind(user),
   db.prepare('SELECT date, data FROM planner_days WHERE user_id = ? AND date >= ? AND date <= ? ORDER BY date').bind(user,from,to),
   db.prepare('SELECT local_key, date, event_id, fingerprint FROM calendar_events WHERE user_id = ? AND date >= ? AND date <= ?').bind(user,from,to),
  ]);
  const revision=Number(rows[0].results[0]?.revision??0),saved=new Map((rows[2].results as EventRow[]).map(e=>[e.local_key,e]));
  const desired=new Map<string,{date:string,payload:Awaited<ReturnType<typeof eventPayload>>,fingerprint:string}>();
  for(const row of rows[1].results){
   const date=String(row.date);const day=daySchema.parse(JSON.parse(String(row.data)));
   for(const {block,key} of calendarBlockKeys(date,day.blocks)){let payload;try{payload=await eventPayload(user,c.calendar_id,date,block,key)}catch{throw new CalendarError('invalid_time',400)}
    desired.set(key,{date,payload,fingerprint:await digest(JSON.stringify(payload))});
   }
  }
  const base='/calendars/'+encodeURIComponent(c.calendar_id)+'/events';
  const more=()=>count>=20||Date.now()>deadline;
  // Delete only IDs recorded as this integration's events, within the active sync window.
  for(const [key,old] of saved){if(desired.has(key))continue;if(more())return await pending();
   const r=await calendarRequest(base+'/'+encodeURIComponent(old.event_id)+'?sendUpdates=none',await auth(),'DELETE');
   if(![204,404,410].includes(r.status))throw new CalendarError('google_unavailable');
   await db.prepare('DELETE FROM calendar_events WHERE user_id = ? AND local_key = ?').bind(user,key).run();count++;
  }
  for(const [key,item] of desired){
   const old=saved.get(key);if(old?.fingerprint===item.fingerprint)continue;if(more())return await pending();
   let eventId=old?.event_id??item.payload.id;
   if(!old)await remember(key,item.date,eventId,'');
   let r=old?.fingerprint?await calendarRequest(base+'/'+encodeURIComponent(eventId)+'?sendUpdates=none',await auth(),'PUT',{...item.payload,id:eventId}):null;
   if(r&&[404,410].includes(r.status)){
    // Google keeps deleted-ID tombstones. Persist a replacement ID before inserting it.
    eventId='ar'+crypto.randomUUID().replace(/-/g,'');await remember(key,item.date,eventId,'');r=null;
   }
   if(!r){
    r=await calendarRequest(base+'?sendUpdates=none',await auth(),'POST',{...item.payload,id:eventId});
    if(r.status===409){
     const existing=await calendarRequest(base+'/'+encodeURIComponent(eventId),await auth());
     if(existing.data?.status==='cancelled'||[404,410].includes(existing.status)){
      await remember(key,item.date,'ar'+crypto.randomUUID().replace(/-/g,''),'');return await pending();
     }
     if(existing.data?.extendedProperties?.private?.localKey!==key||existing.data?.extendedProperties?.private?.alexRhythm!=='1')throw new CalendarError('google_unavailable');
     r=await calendarRequest(base+'/'+encodeURIComponent(eventId)+'?sendUpdates=none',await auth(),'PUT',{...item.payload,id:eventId});
    }
   }
   if(r.status===404)throw new CalendarError('calendar_missing');
   if(r.status>=400||!r.data?.id)throw new CalendarError('google_unavailable');
   await remember(key,item.date,eventId,item.fingerprint);count++;
  }
  await db.prepare('UPDATE calendar_connections SET last_revision = ?, last_window = ?, last_synced_at = ?, error = NULL, retry_at = 0 WHERE user_id = ? AND lock_token = ?').bind(revision,today,Date.now(),user,c.lock_token).run();
  return {...await calendarStatus(user),syncing:false};
  async function remember(key:string,date:string,eventId:string,fingerprint:string){await db.prepare('INSERT INTO calendar_events (user_id, local_key, date, event_id, fingerprint) VALUES (?, ?, ?, ?, ?) ON CONFLICT(user_id, local_key) DO UPDATE SET event_id = excluded.event_id, fingerprint = excluded.fingerprint').bind(user,key,date,eventId,fingerprint).run()}
  async function pending(){await db.prepare('UPDATE calendar_connections SET last_revision = -1, error = NULL, retry_at = 0 WHERE user_id = ? AND lock_token = ?').bind(user,c.lock_token).run();return {...await calendarStatus(user),syncing:false,pending:true}}
 }catch(e){
  const code=c.calendar_id==='creating'?'setup_uncertain':e instanceof CalendarError?e.code:'storage';const reconnect=code==='reconnect';
  await db.prepare('UPDATE calendar_connections SET error = ?, retry_at = ?, refresh_token = CASE WHEN ? THEN NULL ELSE refresh_token END WHERE user_id = ? AND lock_token = ?').bind(code,Date.now()+(code==='rate_limited'?300000:60000),reconnect?1:0,user,c.lock_token).run();
  return {...await calendarStatus(user),syncing:false};
 }finally{await releaseCalendarLock(user,c.lock_token)}
}
