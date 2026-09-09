import assert from 'node:assert/strict';
import {env} from './cloudflare.mock';
import {GET,POST} from '../../app/api/calendar/route';
import {GET as callback} from '../../app/api/calendar/callback/route';
import {calendarBlockKeys,CALENDAR_SCOPE,eventPayload} from '../../lib/calendar';
import {calendarStatus,connection,syncCalendar,acquireCalendarLock,releaseCalendarLock} from '../../db/calendar';
import {seal,unseal} from '../../lib/google-calendar';
import {clock,shiftDate,type Day,type Block} from '../../lib/planner';

const origin='https://planner.test',user='calendar-alex',date=clock().date;
const request=(action:string,id=user)=>new Request(origin+'/api/calendar',{method:'POST',headers:{origin,'oai-authenticated-user-id':id,'content-type':'application/json'},body:JSON.stringify({action})});
assert.equal((await GET(new Request(origin+'/api/calendar'))).status,401);
assert.equal((await POST(new Request(origin+'/api/calendar',{method:'POST',headers:{'oai-authenticated-user-id':user,origin:'https://other.test'},body:'{}'}))).status,403);
assert.equal((await calendarStatus(user)).configured,false);
assert.equal((await POST(request('connect'))).status,503);
Object.assign(env,{GOOGLE_CLIENT_ID:'test-client',GOOGLE_CLIENT_SECRET:'test-secret',GOOGLE_REDIRECT_URI:origin+'/api/calendar/callback',CALENDAR_TOKEN_KEY:'ab'.repeat(32)});
const ciphertext=await seal('private-refresh-token',user);
assert.ok(!ciphertext.includes('private-refresh-token'));
assert.equal(await unseal(ciphertext,user),'private-refresh-token');
await assert.rejects(()=>unseal(ciphertext,'another-user'));
const b:Block={id:'block-1',title:'Work, then rest',category:'work',start:840,end:900,note:'Private medical note',done:false};
assert.equal((await eventPayload(user,'cal','2026-09-08',b)).start.dateTime,'2026-09-08T18:00:00.000Z');
assert.equal((await eventPayload(user,'cal','2026-11-10',b)).start.dateTime,'2026-11-10T19:00:00.000Z');
assert.equal((await eventPayload(user,'cal','2026-09-08',{...b,start:1380,end:1890})).end.dateTime,'2026-09-09T11:30:00.000Z');
await assert.rejects(()=>eventPayload(user,'cal','2026-03-08',{...b,start:150,end:180}));
const payload=await eventPayload(user,'cal',date,b),moved=await eventPayload(user,'cal',date,{...b,start:900,end:930});
assert.equal(payload.id,moved.id);assert.ok(!JSON.stringify(payload).includes(b.note));assert.ok(!('attendees' in payload));
const key1=calendarBlockKeys(date,[{...b,id:'task-a-0-840',taskId:'a'}])[0].key;
const key2=calendarBlockKeys(date,[{...b,id:'task-a-0-900',taskId:'a',start:900}])[0].key;
assert.equal(key1,key2);

const originalFetch=globalThis.fetch;
const events=new Map<string,Record<string,any>>();let creates=0,writes=0,failNextInsert=false,failCreate=false,invalidRefresh=false,rateLimited=false;
globalThis.fetch=async(input,init={})=>{
 const url=String(input),method=init.method??'GET';
 if(url==='https://oauth2.googleapis.com/token'){
  if(invalidRefresh&&String(init.body).includes('refresh_token'))return Response.json({error:'invalid_grant'},{status:400});
  return Response.json({access_token:'test-access',refresh_token:'private-refresh-token',scope:CALENDAR_SCOPE+' openid email'});
 }
 if(url==='https://openidconnect.googleapis.com/v1/userinfo')return Response.json({sub:'google-alex',email:'alex@example.test',email_verified:true});
 if(url==='https://oauth2.googleapis.com/revoke')return new Response(null,{status:200});
 assert.ok(url.startsWith('https://www.googleapis.com/calendar/v3/'));
 assert.equal(new Headers(init.headers).get('authorization'),'Bearer test-access');
 if(url.endsWith('/calendars')){assert.equal(method,'POST');creates++;if(failCreate)throw new Error('Lost calendar response');return Response.json({id:'calendar-'+creates})}
 if(rateLimited)return Response.json({error:{errors:[{reason:'rateLimitExceeded'}]}},{status:403});
 const u=new URL(url),id=decodeURIComponent(u.pathname.split('/').at(-1)!);
 if(method!=='GET'){assert.equal(u.searchParams.get('sendUpdates'),'none');writes++}
 if(method==='POST'){
  const data=JSON.parse(String(init.body));if(events.has(data.id))return Response.json({}, {status:409});events.set(data.id,data);
  if(failNextInsert){failNextInsert=false;throw new Error('Google accepted insert, response lost')}
  return Response.json(data);
 }
 if(method==='PUT'){
  if(!events.has(id)||events.get(id)?.status==='cancelled')return Response.json({}, {status:410});
  const data=JSON.parse(String(init.body));events.set(id,data);return Response.json(data);
 }
 if(method==='DELETE'){events.delete(id);return new Response(null,{status:204})}
 return events.has(id)?Response.json(events.get(id)):Response.json({}, {status:404});
};
try{
 const connect=await POST(request('connect'));assert.equal(connect.status,200);
 const cookie=connect.headers.get('set-cookie')!.split(';')[0];assert.ok(connect.headers.get('set-cookie')!.includes('HttpOnly'));
 const url=new URL((await connect.json()).url);assert.equal(url.origin,'https://accounts.google.com');
 assert.equal(url.searchParams.get('scope'),CALENDAR_SCOPE+' openid email');assert.equal(url.searchParams.get('code_challenge_method'),'S256');
 const callbackRequest=(id=user,c=cookie)=>new Request(origin+'/api/calendar/callback?code=test-code&state='+url.searchParams.get('state'),{headers:{'oai-authenticated-user-id':id,cookie:c}});
 assert.ok((await callback(callbackRequest('wrong-user'))).headers.get('location')!.includes('invalid_state'));
 assert.ok((await callback(callbackRequest(user,'__Host-rhythm-calendar=wrong'))).headers.get('location')!.includes('invalid_state'));
 assert.equal((await callback(callbackRequest())).headers.get('location'),'/?calendar=connected');
 assert.ok((await callback(callbackRequest())).headers.get('location')!.includes('invalid_state'));
 const connected=await calendarStatus(user);assert.equal(connected.connected,true);assert.equal(connected.email,'alex@example.test');assert.ok(!JSON.stringify(connected).includes('token'));
 assert.equal((await calendarStatus('sabrina')).connected,false);
 let revision=0;
 const save=async(blocks:Block[],d=date)=>{
  await env.DB.prepare('INSERT INTO planner_days (user_id, date, data) VALUES (?, ?, ?) ON CONFLICT(user_id, date) DO UPDATE SET data = excluded.data').bind(user,d,JSON.stringify({mode:'custom',goal:'',logs:[],blocks} satisfies Day)).run();
  await env.DB.prepare('INSERT INTO planner_accounts (user_id, revision) VALUES (?, ?) ON CONFLICT(user_id) DO UPDATE SET revision = excluded.revision').bind(user,++revision).run();
 };
 // An unconfirmed draft cannot become calendar events, and another user's saved day is isolated.
 await env.DB.prepare('INSERT INTO planner_drafts (user_id, date, data) VALUES (?, ?, ?)').bind(user,date,JSON.stringify({proposal:{day:{blocks:[b]}}})).run();
 await env.DB.prepare('INSERT INTO planner_days (user_id, date, data) VALUES (?, ?, ?)').bind('sabrina',date,JSON.stringify({mode:'custom',goal:'',logs:[],blocks:[b]})).run();
 await syncCalendar(user);assert.equal(events.size,0);assert.equal(creates,1);
 await save([b]);await save([{...b,id:'far-away'}],shiftDate(date,61));
 failNextInsert=true;let status=await syncCalendar(user);assert.equal(status.error,'google_unavailable');assert.equal(events.size,1);
 await env.DB.prepare('UPDATE calendar_connections SET retry_at = 0 WHERE user_id = ?').bind(user).run();
 status=await syncCalendar(user);assert.equal(status.pending,false);assert.equal(events.size,1);assert.equal(creates,1);
 const eventId=[...events.keys()][0],before=writes;
 await save([{...b,done:true}]);await syncCalendar(user);assert.equal(writes,before,'Completion tracking must not rewrite calendar events');
 await save([{...b,start:960,end:1000}]);await syncCalendar(user);assert.equal([...events.keys()][0],eventId);assert.equal(events.size,1);
 const lease=await acquireCalendarLock(user);assert.equal((await POST(request('sync'))).status,409);await releaseCalendarLock(user,lease.lock_token);
 rateLimited=true;await save([{...b,start:970,end:1010}]);status=await syncCalendar(user);assert.equal(status.error,'rate_limited');assert.ok(status.retryAt!>Date.now());
 const limitedWrites=writes;await syncCalendar(user);assert.equal(writes,limitedWrites,'Backoff prevents hammering Google');rateLimited=false;
 await env.DB.prepare('UPDATE calendar_connections SET retry_at = 0 WHERE user_id = ?').bind(user).run();
 events.set(eventId,{status:'cancelled'});await syncCalendar(user);assert.ok([...events.keys()].some(id=>id!==eventId),'A deleted Google ID must get a persisted replacement');
 events.delete(eventId);
 await save([]);await syncCalendar(user);assert.equal(events.size,0);
 await save(Array.from({length:24},(_,i)=>({...b,id:'many-'+i,start:500+i*10,end:510+i*10})));
 status=await syncCalendar(user);assert.equal(status.pending,true);assert.equal(events.size,20);
 status=await syncCalendar(user);assert.equal(status.pending,false);assert.equal(events.size,24);
 const oldSize=events.size;
 assert.equal((await POST(request('disconnect'))).status,200);assert.equal((await connection(user))?.refresh_token,null);assert.equal(events.size,oldSize);
 assert.equal((await POST(request('sync'))).status,401);
 // An ambiguous calendar creation is paused instead of automatically creating another calendar.
 await env.DB.prepare('INSERT INTO calendar_connections (user_id, google_sub, email, refresh_token, start_date) VALUES (?, ?, ?, ?, ?)').bind('ambiguous','google-b','b@example.test',await seal('private-refresh-token','ambiguous'),date).run();
 failCreate=true;await syncCalendar('ambiguous');const createCount=creates;
 await env.DB.prepare('UPDATE calendar_connections SET retry_at = 0 WHERE user_id = ?').bind('ambiguous').run();
 status=await syncCalendar('ambiguous');assert.equal(status.error,'setup_uncertain');assert.equal(creates,createCount);failCreate=false;
 await POST(request('repair','ambiguous'));invalidRefresh=true;
 status=await syncCalendar('ambiguous');assert.equal(status.connected,false);assert.equal(status.error,'reconnect');invalidRefresh=false;
 console.log('PASS: calendar auth/state/PKCE/account isolation, token encryption, Toronto DST, stable event IDs, saved-only sync, update/delete, lost-response retry, batching, rate limits, disconnect and ambiguous creation');
}finally{globalThis.fetch=originalFetch}
