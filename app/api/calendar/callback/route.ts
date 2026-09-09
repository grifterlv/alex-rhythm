import {database} from '@/db';
import {acquireCalendarLock,connection,releaseCalendarLock} from '@/db/calendar';
import {CALENDAR_SCOPE,CalendarError,digest} from '@/lib/calendar';
import {googleFetch,requireConfig,seal,tokenRequest,unseal} from '@/lib/google-calendar';
import {clock,shiftDate} from '@/lib/planner';
export const dynamic='force-dynamic';
function finish(code:string){return new Response(null,{status:303,headers:{Location:'/?calendar='+encodeURIComponent(code),'Cache-Control':'no-store','Referrer-Policy':'no-referrer','Set-Cookie':'__Host-rhythm-calendar=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0'}})}
export async function GET(req:Request){
 const user=req.headers.get('oai-authenticated-user-id');if(!user)return finish('invalid_state');
 let lock:string|undefined;
 try{
  const config=requireConfig(),url=new URL(req.url);if(url.origin!==new URL(config.redirectUri).origin)throw new CalendarError('invalid_state',400);
  const state=url.searchParams.get('state')??'',code=url.searchParams.get('code')??'';
  const cookie=req.headers.get('cookie')?.split(';').map(v=>v.trim()).find(v=>v.startsWith('__Host-rhythm-calendar='))?.split('=')[1]??'';
  if(!state||state.length>256||!cookie||code.length>4096)throw new CalendarError('invalid_state',400);
  const db=database();
  const result=await db.prepare('DELETE FROM calendar_oauth WHERE user_id = ? AND state_hash = ? AND browser_hash = ? AND expires_at > ? RETURNING verifier').bind(user,await digest(state),await digest(cookie),Date.now()).all();
  if(!result.results.length)throw new CalendarError('invalid_state',400);
  if(url.searchParams.has('error'))return finish('cancelled');if(!code)throw new CalendarError('invalid_state',400);
  const old=await connection(user);if(old)lock=(await acquireCalendarLock(user)).lock_token;
  const tokens=await tokenRequest({grant_type:'authorization_code',code,redirect_uri:config.redirectUri,code_verifier:await unseal(String(result.results[0].verifier),user)});
  if(!tokens.scope?.split(' ').includes(CALENDAR_SCOPE))throw new CalendarError('permission',403);
  if(!tokens.refresh_token)throw new CalendarError('reconnect',401);
  const identity=await googleFetch('https://openidconnect.googleapis.com/v1/userinfo',{headers:{Authorization:'Bearer '+tokens.access_token}});
  if(!identity.ok)throw new CalendarError('reconnect',401);
  const account=await identity.json() as {sub?:string,email?:string,email_verified?:boolean};
  if(!account.sub||!account.email||account.email_verified!==true)throw new CalendarError('reconnect',401);
  const same=old?.google_sub===account.sub;
  const statements=[db.prepare('INSERT INTO calendar_connections (user_id, google_sub, email, refresh_token, calendar_id, start_date, last_revision, error, retry_at) VALUES (?, ?, ?, ?, ?, ?, -1, NULL, 0) ON CONFLICT(user_id) DO UPDATE SET google_sub = excluded.google_sub, email = excluded.email, refresh_token = excluded.refresh_token, calendar_id = excluded.calendar_id, start_date = excluded.start_date, last_revision = -1, error = NULL, retry_at = 0').bind(user,account.sub,account.email,await seal(tokens.refresh_token,user),same?old!.calendar_id:null,same?old!.start_date:shiftDate(clock().date,-1))];
  if(!same)statements.push(db.prepare('DELETE FROM calendar_events WHERE user_id = ?').bind(user));
  await db.batch(statements);return finish('connected');
 }catch(e){return finish(e instanceof CalendarError?e.code:'storage')}
 finally{if(lock)await releaseCalendarLock(user,lock)}
}
