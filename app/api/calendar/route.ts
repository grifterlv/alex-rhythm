import {database} from '@/db';
import {acquireCalendarLock,calendarStatus,connection,releaseCalendarLock,syncCalendar} from '@/db/calendar';
import {CALENDAR_SCOPES,CalendarError,digest,pkceChallenge,randomValue} from '@/lib/calendar';
import {googleFetch,requireConfig,seal,unseal} from '@/lib/google-calendar';
import {z} from 'zod';
export const dynamic='force-dynamic';
const json=(data:unknown,status=200,headers:Record<string,string>={})=>Response.json(data,{status,headers:{'Cache-Control':'no-store','Referrer-Policy':'no-referrer',...headers}});
export async function GET(req:Request){
 const user=req.headers.get('oai-authenticated-user-id');if(!user)return json({error:'unauthorized'},401);
 try{return json(await calendarStatus(user))}catch{return json({error:'storage'},503)}
}
export async function POST(req:Request){
 const user=req.headers.get('oai-authenticated-user-id');if(!user)return json({error:'unauthorized'},401);
 if(req.headers.get('origin')!==new URL(req.url).origin)return json({error:'origin'},403);
 try{
  const raw=await req.text();if(raw.length>1024)return json({error:'input'},413);
  const parsed=z.object({action:z.enum(['connect','sync','disconnect','repair'])}).safeParse(JSON.parse(raw));if(!parsed.success)return json({error:'input'},400);
  const action=parsed.data.action,db=database();
  if(action==='connect'){
   const config=requireConfig();if(new URL(req.url).origin!==new URL(config.redirectUri).origin)throw new CalendarError('not_configured');
   const state=randomValue(),verifier=randomValue(),browser=randomValue();
   await db.prepare('INSERT INTO calendar_oauth (user_id, state_hash, verifier, browser_hash, expires_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT(user_id) DO UPDATE SET state_hash = excluded.state_hash, verifier = excluded.verifier, browser_hash = excluded.browser_hash, expires_at = excluded.expires_at').bind(user,await digest(state),await seal(verifier,user),await digest(browser),Date.now()+600000).run();
   const url=new URL('https://accounts.google.com/o/oauth2/v2/auth');url.search=new URLSearchParams({client_id:config.clientId,redirect_uri:config.redirectUri,response_type:'code',scope:CALENDAR_SCOPES,access_type:'offline',prompt:'consent select_account',state,code_challenge:await pkceChallenge(verifier),code_challenge_method:'S256'}).toString();
   return json({url:url.toString()},200,{'Set-Cookie':`__Host-rhythm-calendar=${browser}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=600`});
  }
  if(action==='sync'){requireConfig();return json(await syncCalendar(user))}
  const existing=await connection(user);if(!existing)return json(await calendarStatus(user));
  const locked=await acquireCalendarLock(user);
  try{
   if(action==='disconnect'){
    await db.batch([
     db.prepare('UPDATE calendar_connections SET refresh_token = NULL, error = NULL, retry_at = 0, last_revision = -1 WHERE user_id = ? AND lock_token = ?').bind(user,locked.lock_token),
     db.prepare('DELETE FROM calendar_oauth WHERE user_id = ?').bind(user),
    ]);
    if(locked.refresh_token){try{await googleFetch('https://oauth2.googleapis.com/revoke',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({token:await unseal(locked.refresh_token,user)})})}catch{/* Local disconnection succeeds even when Google is unreachable. */}}
   }else{
    if(!locked.refresh_token||!(locked.calendar_id==='creating'||locked.error==='calendar_missing'))return json({error:'input'},400);
    await db.batch([
     db.prepare('UPDATE calendar_connections SET calendar_id = NULL, last_revision = -1, error = NULL, retry_at = 0 WHERE user_id = ? AND lock_token = ?').bind(user,locked.lock_token),
     db.prepare('DELETE FROM calendar_events WHERE user_id = ?').bind(user),
    ]);
   }
  }finally{await releaseCalendarLock(user,locked.lock_token)}
  return json(await calendarStatus(user));
 }catch(e){const error=e instanceof CalendarError?e:new CalendarError('storage');return json({error:error.code},error.status)}
}
