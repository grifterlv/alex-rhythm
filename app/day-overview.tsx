'use client';
import {useLanguage} from './language-provider';
import {useEffect,useMemo,useState,type CSSProperties} from 'react';
import {ArrowRight,BookOpen,Cat,Check,Clock3,CookingPot,Dumbbell,Focus,Laptop,Leaf,Moon,Pause,Plus,RotateCcw,Sun,Sunrise,Sunset} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {NativeSelect} from '@/components/ui/native-select';
import {Dialog,DialogContent,DialogHeader,DialogTitle,DialogDescription} from './localized-dialog';
import {elapsed,hm,type Active,type Block,type Day} from '@/lib/planner';
import type {Settings} from '@/lib/planning';
import {dayOverview,overviewGroupAt,type OverviewGroup} from '@/lib/day-overview';
import type {TimeRange} from '@/lib/block-editor';

type Props={day:Day,date:string,settings:Settings,active:Active,now:number,minute:number,isToday:boolean,busy:boolean,current?:Block,nextStep:string,getNextStep:(b:Block)=>string,onFocus:()=>void,onPause:()=>void,onRecover:()=>void,onReview:()=>void,reviewDue:boolean,onDetails:(id?:string)=>void,onPlan:()=>void,canPlan:boolean,onAddInGap:(range:TimeRange)=>void,onToggleComplete:(b:Block)=>void};
const icons={morning:Sunrise,afternoon:Sun,evening:Sunset,night:Moon};
const activityIcons={work:Laptop,meal:CookingPot,move:Dumbbell,cat:Cat,life:Sun,rest:BookOpen};
const periodArt:Record<string,string>={morning:'morning',afternoon:'afternoon',evening:'evening'};
export default function DayOverview(p:Props){
 const {tr,duration,categories,blockTitle,blockNote,recordTitle,groupTitle,timeLabel}=useLanguage();

 const periods=useMemo(()=>dayOverview(p.day,p.settings),[p.day,p.settings]);
 const daytime=periods.filter(x=>x.id!=='night'),night=periods.find(x=>x.id==='night');
 const currentPeriod=periods.find(x=>x.start<=p.minute&&p.minute<x.end)?.id??'morning';
 const [mobilePeriod,setMobilePeriod]=useState(p.isToday?currentPeriod:'morning'),[selectedId,setSelectedId]=useState<string|null>(null);
 useEffect(()=>{setMobilePeriod(p.isToday?currentPeriod:'morning');setSelectedId(null)},[p.date]);
 const selected=periods.flatMap(x=>x.groups).find(x=>x.id===selectedId);
 const start=periods[0]?.start??p.settings.wake,end=p.settings.bed,span=Math.max(1,end-start);
 const groups=daytime.flatMap(x=>x.groups);
 const planned=Object.keys(categories).map(key=>{const category=key as Block['category'];return {category,minutes:groups.filter(g=>g.category===category).reduce((n,g)=>n+g.end-g.start,0)}}).filter(x=>x.minutes>0);
 const free=groups.filter(g=>!g.category).reduce((n,g)=>n+g.end-g.start,0);
 const current=p.active??p.current,live=!!p.active;
 const completion=p.day.blocks.filter(b=>b.done).length;
 const choose=(g:OverviewGroup)=>{if(g.blocks.length)setSelectedId(g.id)};
 return <div className="day-overview">
  <section className="overview-current" id="overview-current" tabIndex={-1}>
   <div className="overview-current-copy"><span className="overview-kicker"><Clock3 size={16}/>{live?tr("实际计时中"):p.isToday?(p.current&&p.current.start>p.minute?tr("接下来 · ")+hm(p.current.start):tr("现在 · ")+hm(p.minute)):tr("这一天的重点")}</span><h2>{p.isToday||live?(p.active?recordTitle(p.active):blockTitle(p.current))||tr("现在有一点空档"):p.day.goal||tr("按自己的节奏安排")}</h2><p>{p.isToday||live?(p.nextStep?tr("下一步：")+p.nextStep:'')||(live?tr("计时会在后台继续，准备好休息时再暂停。"):p.current?tr("这是计划建议，开始专注后才会计时。"):tr("可以留一点空白，也可以安排接下来。")):tr("先看整体安排，需要时再展开细节。")}</p></div>
   <div className="overview-current-action">{live&&<span className="overview-live-time" role="timer" aria-live="off">{elapsed(p.now-p.active!.startedAt)}</span>}<div className="overview-primary-actions">{live&&<Button disabled={p.busy} onClick={p.onPause}><Pause size={17}/>{tr("暂停")}</Button>}<Button disabled={p.busy} onClick={live||p.isToday&&p.current?p.onFocus:p.canPlan?p.onPlan:()=>p.onDetails()}>{live||p.isToday&&p.current?<Focus size={18}/>:<ArrowRight size={18}/>} {live?tr("回到专注"):p.isToday&&p.current?tr("进入专注"):p.canPlan?tr("安排这一天"):tr("查看详细日程")}</Button></div><div className="overview-quick-actions">{p.isToday&&<Button variant="ghost" disabled={p.busy} onClick={p.onRecover}><RotateCcw size={15}/>{tr("我跑偏了")}</Button>}{live&&<Button variant="ghost" className={p.reviewDue?'needs-check':''} disabled={p.busy} onClick={p.onReview}>{p.reviewDue?tr("这段时间都在做吗？核对一下"):tr("核对计时")}</Button>}</div></div>
  </section>
  <section className="overview-rhythm" aria-label={tr("清醒时间的计划分布")}>
   <div className="overview-section-heading"><div><h2>{tr("一天的节奏")}</h2><p>{tr("色块长度代表计划时长")}</p></div><div className="overview-completion"><span>{completion} / {p.day.blocks.length}{tr(" 项已完成")}</span><progress value={completion} max={Math.max(1,p.day.blocks.length)} aria-label={tr("完成进度")}/></div></div>
   <div className="overview-time-map" role="img" aria-label={tr("清醒时间 {0} 至 {1}。{2}；未安排 {3}。", [hm(start), hm(end), planned.map(x=>categories[x.category].label+' '+duration(x.minutes)).join('；'), duration(free)])}>
    {groups.map(g=><span key={g.id} className={'overview-map-segment '+(!g.category?'is-free':'')} style={{left:(g.start-start)/span*100+'%',width:(g.end-g.start)/span*100+'%',background:g.category?categories[g.category].color:undefined}}/>)}
    {p.isToday&&p.minute>=start&&p.minute<end&&<span className="overview-now-line" style={{left:(p.minute-start)/span*100+'%'}}/>}
   </div>
   <div className="overview-map-scale"><span>{hm(start)}{tr(" 起床")}</span><span>{hm(end)}{tr(" 睡前")}</span></div>
   <div className="overview-legend">{planned.map(x=><span key={x.category}><i style={{background:categories[x.category].color}}/>{categories[x.category].label}<b>{duration(x.minutes)}</b></span>)}<span><i className="free-key"/>{tr("未安排")}<b>{duration(free)}</b></span>{p.isToday&&p.minute>=start&&p.minute<end&&<span className="now-key"><i/>{tr("现在 ")}{hm(p.minute)}</span>}</div>
  </section>
  <div className="overview-period-heading"><div><h2>{tr("把一天分成三段")}</h2><p>{tr("时间越长，色块越高 · 短任务保留可读高度")}</p></div><Button variant="ghost" disabled={p.busy} onClick={()=>p.onDetails()}>{tr("详细日程")}<ArrowRight size={16}/></Button></div>
  <label className="overview-period-picker"><span>{tr("查看时段")}</span><NativeSelect value={mobilePeriod} onChange={e=>setMobilePeriod(e.target.value)}>{daytime.map(x=><option key={x.id} value={x.id}>{tr(x.title)} · {hm(x.start)}–{hm(x.end)}</option>)}{night&&<option value="night">{tr("夜间 · ")}{hm(night.start)}{tr(" 之后")}</option>}</NativeSelect></label>
  <div className="overview-periods">{daytime.map(period=>{const Icon=icons[period.id as keyof typeof icons],art=periodArt[period.id];return <section key={period.id} className={'overview-period '+(mobilePeriod===period.id?'mobile-visible':'')} data-period={period.id} aria-label={tr(period.title)+tr("安排")}>
   {art&&<div className="overview-period-art" aria-hidden="true"><img src={`/images/day-overview/${art}-960.webp`} srcSet={`/images/day-overview/${art}-480.webp 480w, /images/day-overview/${art}-960.webp 960w`} sizes="(max-width: 760px) 100vw, 33vw" width={1672} height={941} loading="lazy" decoding="async" alt=""/></div>}
   <header><div><Icon size={21}/><h3>{tr(period.title)}</h3></div><span>{hm(period.start)}–{hm(period.end)}</span></header>
   <div className="overview-period-track" aria-hidden="true">{period.groups.map(g=><span key={g.id} style={{width:(g.end-g.start)/(period.end-period.start)*100+'%',background:g.category?categories[g.category].color:'#e8ece4'}}/>)}</div>
   <div className="overview-groups">{period.groups.map(g=>{const running=p.active?.day===p.date&&g.blocks.some(b=>b.id===p.active!.blockId),at=p.isToday&&overviewGroupAt(g,p.minute),done=!!g.blocks.length&&g.blocks.every(b=>b.done),ActivityIcon=g.category?activityIcons[g.category]:Leaf,groupHeight=(g.end-g.start)/6+'rem';return g.category?<button key={g.id} className={'overview-group '+(running?'is-running ':'')+(at?'is-now ':'')+(done?'is-done':'')} style={{'--group-height':groupHeight,'--group-color':categories[g.category].color,'--group-pale':categories[g.category].pale} as CSSProperties} onClick={()=>choose(g)} aria-label={tr("{0} 至 {1}，{2}，{3}，{4}查看详情", [timeLabel(g.start), timeLabel(g.end), groupTitle(g), duration(g.end-g.start), running?tr('计时中，'):done?tr('已完成，'):''])}>
    <span className="overview-group-time"><span className="overview-activity-icon" aria-hidden="true"><ActivityIcon size={21}/>{done&&<span className="overview-activity-done"><Check size={10}/></span>}</span>{hm(g.start)}</span><span className="overview-group-copy"><strong>{groupTitle(g)}</strong><span>{running?<b>{tr("计时中 · ")}</b>:at?<b>{tr("计划此刻 · ")}</b>:null}{duration(g.end-g.start)}{g.blocks.length>1?' · '+g.blocks.length+tr(" 个步骤"):''}</span></span><ArrowRight size={14}/>
   </button>:<GapButton key={g.id} group={g} current={at} busy={p.busy} onAdd={p.onAddInGap}/>})}</div>
  </section>})}</div>
  {night&&<section className={'overview-night '+(mobilePeriod==='night'?'mobile-visible':'')}><div><Moon size={21}/><h3>{tr("夜间")}</h3><span>{timeLabel(night.start)}–{timeLabel(night.end)}</span></div><div className="overview-night-items">{night.groups.map(g=>g.category?<button key={g.id} onClick={()=>choose(g)}><span>{groupTitle(g)}</span><strong>{duration(g.end-g.start)}</strong><ArrowRight size={15}/></button>:<GapButton compact key={g.id} group={g} current={p.isToday&&overviewGroupAt(g,p.minute)} busy={p.busy} onAdd={p.onAddInGap}/>)}</div></section>}
  <Dialog open={!!selected} onOpenChange={v=>!v&&setSelectedId(null)}><DialogContent className="overview-detail-dialog"><DialogHeader><DialogTitle>{groupTitle(selected)}</DialogTitle><DialogDescription>{selected&&tr("{0}–{1} · 计划 {2}", [timeLabel(selected.start), timeLabel(selected.end), duration(selected.end-selected.start)])}</DialogDescription></DialogHeader><div className="overview-detail-list">{selected?.blocks.map(b=><article key={b.id}><span>{timeLabel(b.start)}–{timeLabel(b.end)}</span><h3>{blockTitle(b)}</h3>{p.getNextStep(b)&&<p>{tr("下一步：")}{p.getNextStep(b)}</p>}{b.note&&<p>{blockNote(b)}</p>}<div className="overview-detail-actions"><Button variant="outline" disabled={p.busy} onClick={()=>p.onToggleComplete(b)}><Check size={16}/>{b.done?tr("撤销完成"):tr("完成这一项")}</Button><Button variant="ghost" disabled={p.busy} onClick={()=>{setSelectedId(null);p.onDetails(b.id)}}>{tr("在详细日程中打开")}<ArrowRight size={16}/></Button></div></article>)}</div></DialogContent></Dialog>
 </div>;
}

function GapButton({group,current,busy,compact=false,onAdd}:{group:OverviewGroup,current:boolean,busy:boolean,compact?:boolean,onAdd:(range:TimeRange)=>void}){
 const {tr,duration,timeLabel}=useLanguage();
 return <button type="button" className={'overview-gap overview-gap-action '+(current?'is-now ':'')+(compact?'overview-night-gap':'')} style={compact?undefined:{'--group-height':(group.end-group.start)/6+'rem'} as CSSProperties} disabled={busy} onClick={()=>onAdd({start:group.start,end:group.end})} aria-label={tr('在 {0}–{1} 的未安排时间添加任务',[timeLabel(group.start),timeLabel(group.end)])}>
  <span className="overview-gap-copy"><strong>{tr('未安排')} · {duration(group.end-group.start)}</strong><span>{timeLabel(group.start)}–{timeLabel(group.end)}{current?' · '+tr('现在'):''}</span></span>
  <span className="overview-gap-add"><Plus size={17} aria-hidden="true"/>{tr('添加任务')}</span>
 </button>;
}
