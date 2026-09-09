'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import {CalendarDays,Check,ExternalLink,Loader2,RefreshCw,Unplug} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {Dialog,DialogContent,DialogDescription,DialogHeader,DialogTitle} from './localized-dialog';
import {useLanguage} from './language-provider';
import {calendarErrorText,type CalendarStatus} from '@/lib/calendar';

export default function CalendarConnection({revision}:{revision:number}){
 const {tr,locale}=useLanguage();const [open,setOpen]=useState(false),[status,setStatus]=useState<CalendarStatus|null>(null);
 const [busy,setBusy]=useState(false),[notice,setNotice]=useState(''),[confirmation,setConfirmation]=useState<'disconnect'|'repair'|null>(null);
 const flight=useRef(false),mounted=useRef(true),callbackRef=useRef<()=>void>(()=>{});
 const errorText=(code:string)=>calendarErrorText[code]??'暂时无法读取日历连接，请重试。';
 const update=useCallback(async()=>{
  if(flight.current||!navigator.onLine||document.visibilityState==='hidden')return;
  flight.current=true;
  try{
   const res=await fetch('/api/calendar',{cache:'no-store'});const data=await res.json();if(!res.ok)throw new Error(data.error??'storage');
   if(!mounted.current)return;setStatus(data);
   if(data.connected&&data.pending&&!data.syncing&&(!data.retryAt||data.retryAt<=Date.now())&&!['setup_uncertain','calendar_missing','permission','invalid_time'].includes(data.error)){
    setStatus({...data,syncing:true});
    const sync=await fetch('/api/calendar',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'sync'})});
    const next=await sync.json();if(!sync.ok)throw new Error(next.error??'storage');if(mounted.current){setStatus(next);if(!next.error)setNotice('')}
   }
  }catch(e){if(mounted.current)setNotice(errorText((e as Error).message))}finally{flight.current=false}
 },[]);
 callbackRef.current=()=>void update();
 useEffect(()=>{
  mounted.current=true;
  const url=new URL(location.href),code=url.searchParams.get('calendar');
  if(code){setOpen(true);if(code!=='connected')setNotice(errorText(code));url.searchParams.delete('calendar');history.replaceState(history.state,'',url.pathname+url.search+url.hash)}
  const refresh=()=>callbackRef.current();refresh();
  window.addEventListener('online',refresh);document.addEventListener('visibilitychange',refresh);
  const timer=setInterval(refresh,30000);
  return()=>{mounted.current=false;clearInterval(timer);window.removeEventListener('online',refresh);document.removeEventListener('visibilitychange',refresh)};
 },[]);
 useEffect(()=>{const timer=setTimeout(()=>callbackRef.current(),800);return()=>clearTimeout(timer)},[revision]);
 useEffect(()=>{if(status?.pending&&!status.syncing&&!status.error){const timer=setTimeout(()=>callbackRef.current(),3000);return()=>clearTimeout(timer)}},[status]);
 async function action(value:'connect'|'sync'|'disconnect'|'repair'){
  if(flight.current){setNotice('另一页面正在同步，请稍候。');return}
  flight.current=true;setBusy(true);setNotice('');
  try{
   const res=await fetch('/api/calendar',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:value})});const data=await res.json();
   if(!res.ok)throw new Error(data.error??'storage');
   if(value==='connect'){
    const url=new URL(data.url);if(url.origin!=='https://accounts.google.com')throw new Error('storage');location.assign(url.toString());return;
   }
   setStatus(data);setConfirmation(null);
   if(value==='disconnect')setNotice('已停止同步，Google 日历中的已有事件仍然保留。');
  }catch(e){setNotice(errorText((e as Error).message))}finally{flight.current=false;setBusy(false)}
 }
 const label=!status?'正在载入':!status.configured?'尚未配置':!status.connected?'未连接':status.syncing?'正在同步':status.error?'同步需要处理':status.pending?'等待同步':'已同步';
 return <>
  <Button className="calendar-trigger" variant="outline" onClick={()=>{setOpen(true);void update()}} aria-label={tr('日历连接')+' · '+tr(label)}><CalendarDays size={16}/><span>{tr('日历连接')}</span>{status?.syncing?<Loader2 size={14} className="spin"/>:status?.connected&&!status.pending&&!status.error?<Check size={14}/>:null}</Button>
  <Dialog open={open} onOpenChange={value=>{setOpen(value);if(!value)setConfirmation(null)}}><DialogContent className="calendar-dialog"><DialogHeader><DialogTitle>{tr('连接 Google Calendar')}</DialogTitle><DialogDescription>{tr('把已确认的安排带到你的日历。')}</DialogDescription></DialogHeader>
   <div className="calendar-account"><CalendarDays size={24}/><div><strong>Google Calendar</strong>{status?.email&&<span>{status.email}</span>}</div><span className="calendar-status" role="status">{tr(label)}</span></div>
   <ul className="calendar-explanation"><li>{tr('独立日历 Alex Rhythm：同步已保存的时间块，包括固定作息。')}</li><li>{tr('同步昨天、今天及未来 60 天；草稿、待办池和实际用时不进入日历。')}</li><li>{tr('请在网站修改安排。修改会更新原事件，取消会移除对应事件。')}</li><li>{tr('网页打开时自动同步，关闭后未完成的同步会在下次打开时继续。')}</li><li>{tr('事件默认不提醒，避免通知过多；可在日历中自行设置。')}</li></ul>
   {status?.lastSyncedAt&&<p className="calendar-last-sync">{tr('上次同步：')}{new Date(status.lastSyncedAt).toLocaleString(locale)}</p>}
   {(notice||status?.error)&&<p className="calendar-notice" role="status">{tr(notice||errorText(status!.error!))}</p>}
   {status&&!status.configured&&<p className="calendar-setup-note">{tr('日历连接尚未配置，请先完成 Google 应用设置。')}</p>}
   <details className="calendar-apple"><summary>{tr('在 Apple 日历中查看')}</summary><p>{tr('在 iPhone 或 Mac 的日历账户设置中添加同一个 Google 账户，再勾选 Alex Rhythm 日历。')}</p><a href="https://support.google.com/calendar/answer/99358" target="_blank" rel="noreferrer">{tr('查看设置说明')}<ExternalLink size={14}/></a></details>
   {confirmation?<div className="calendar-confirm"><p>{tr(confirmation==='disconnect'?'停止后不再更新 Google 日历，已有事件会保留。确定断开？':'这会新建一个同步日历，旧日历和其中的事件会保留。请先检查 Google Calendar，避免同时显示两份安排。')}</p><div><Button variant="outline" disabled={busy} onClick={()=>setConfirmation(null)}>{tr('取消')}</Button><Button disabled={busy} onClick={()=>void action(confirmation)}>{tr(confirmation==='disconnect'?'确认断开':'新建同步日历')}</Button></div></div>:<div className="calendar-actions">
    {!status?<Button variant="outline" onClick={()=>void update()}>{tr('重试')}</Button>:status.connected?<><Button variant="outline" disabled={busy||status.syncing||Number(status.retryAt)>Date.now()} onClick={()=>void action('sync')}><RefreshCw size={16}/>{tr('立即同步')}</Button>{status.error==='permission'&&<Button disabled={busy} onClick={()=>void action('connect')}>{tr('重新连接 Google')}</Button>}{['calendar_missing','setup_uncertain'].includes(status.error??'')&&<Button variant="outline" disabled={busy} onClick={()=>setConfirmation('repair')}>{tr('新建同步日历')}</Button>}<Button variant="ghost" disabled={busy||status.syncing} onClick={()=>setConfirmation('disconnect')}><Unplug size={16}/>{tr('断开连接')}</Button></>:<Button disabled={busy||!status.configured} onClick={()=>void action('connect')}>{busy&&<Loader2 size={16} className="spin"/>}{tr(status.email?'重新连接 Google':'连接 Google 账户')}</Button>}
   </div>}
  </DialogContent></Dialog>
 </>;
}
