import {env} from 'cloudflare:workers';
import {CalendarError,base64url} from './calendar';
type Config={clientId:string,clientSecret:string,redirectUri:string,key:string};
export function calendarConfig():Config|null{
 const vars=env as unknown as Record<string,string|undefined>;
 const {GOOGLE_CLIENT_ID:clientId,GOOGLE_CLIENT_SECRET:clientSecret,GOOGLE_REDIRECT_URI:redirectUri,CALENDAR_TOKEN_KEY:key}=vars;
 if(!clientId||!clientSecret||!redirectUri||!key||!/^[a-f0-9]{64}$/i.test(key))return null;
 try{const u=new URL(redirectUri);if(u.protocol!=='https:'||u.pathname!=='/api/calendar/callback'||u.search||u.hash||u.username||u.password)return null}catch{return null}
 return {clientId,clientSecret,redirectUri,key};
}
export function requireConfig(){const config=calendarConfig();if(!config)throw new CalendarError('not_configured');return config}
async function encryptionKey(){const hex=requireConfig().key;return crypto.subtle.importKey('raw',Uint8Array.from(hex.match(/../g)!,h=>parseInt(h,16)),{name:'AES-GCM'},false,['encrypt','decrypt'])}
function decode(value:string){return Uint8Array.from(atob(value.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0))}
export async function seal(value:string,user:string){
 const iv=crypto.getRandomValues(new Uint8Array(12));
 const data=await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:new TextEncoder().encode(user)},await encryptionKey(),new TextEncoder().encode(value));
 return base64url(iv)+'.'+base64url(new Uint8Array(data));
}
export async function unseal(value:string,user:string){try{
 const [iv,data]=value.split('.');return new TextDecoder().decode(await crypto.subtle.decrypt({name:'AES-GCM',iv:decode(iv),additionalData:new TextEncoder().encode(user)},await encryptionKey(),decode(data)));
 }catch{throw new CalendarError('reconnect',401)}
}
export async function googleFetch(url:string,init:RequestInit={}){
 try{return await fetch(url,{...init,redirect:'error',signal:AbortSignal.timeout(10000)})}catch{throw new CalendarError('google_unavailable')}
}
export async function tokenRequest(values:Record<string,string>){
 const config=requireConfig();const r=await googleFetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:config.clientId,client_secret:config.clientSecret,...values})});
 const value=await r.json() as {access_token?:string,refresh_token?:string,scope?:string,error?:string};
 if(!r.ok||!value.access_token)throw new CalendarError(value.error==='invalid_grant'?'reconnect':'google_unavailable',r.status===400?401:503);
 return value as typeof value & {access_token:string};
}
export async function calendarRequest(path:string,accessToken:string,method='GET',body?:unknown){
 const r=await googleFetch('https://www.googleapis.com/calendar/v3'+path,{method,headers:{Authorization:'Bearer '+accessToken,...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});
 if([404,409,410,412].includes(r.status))return {status:r.status,data:null};
 if(!r.ok){
  let reason='';try{const error=await r.json() as {error?:{errors?:{reason?:string}[]}};reason=error.error?.errors?.[0]?.reason??''}catch{}
  throw new CalendarError(r.status===401?'reconnect':r.status===429||reason.includes('RateLimit')||reason==='rateLimitExceeded'?'rate_limited':r.status===403?'permission':'google_unavailable',r.status===401?401:503);
 }
 return {status:r.status,data:r.status===204?null:await r.json() as Record<string,any>};
}
