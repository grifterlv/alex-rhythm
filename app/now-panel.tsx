'use client';
import {useLanguage} from './language-provider';
import {ArrowRight,Check,Clock3,Focus,Leaf,Pause,Play,Plus,RotateCcw} from 'lucide-react';
import {NextStepCard,TimerCheck,RecoverButton} from './recovery-controls';
import {Button} from '@/components/ui/button';
import {clock,elapsed,hm,type Block,type Snapshot} from '@/lib/planner';
export type ReplanIntent='delay'|'low'|'change'|'recover'|null;
type Props={nextStep:string,canNote:boolean,onNote:()=>void,reviewDue:boolean,onReview:()=>void,onRecover:()=>void,onFocus:()=>void,focus?:Block,next?:Block,active:Snapshot['active'],now:number,date:string,isToday:boolean,busy:boolean,goal:string,onStart:(b:Block)=>void,onPause:()=>void,onFinish:()=>void,onRecord:()=>void,onPlan:(intent:ReplanIntent)=>void,onToday:()=>void,canFinish:boolean};
export default function NowPanel(p:Props){
 const {tr,duration,blockTitle,blockNote,recordTitle}=useLanguage();

 const {focus,next,active,now,date,isToday,busy}=p;
 return <div className="execution-panel" id="now-panel" tabIndex={-1}>
  <section className="focus-card">
   <div className="focus-top"><span><Clock3 size={17}/>{active?tr("计时中"):isToday?tr("现在，先做这一件"):tr("选中的时间块")}</span>{focus&&!active&&<span>{hm(focus.start)}–{hm(focus.end)}</span>}</div>
   {p.goal&&<div className="focus-goal">{tr("今天的重点 · ")}{p.goal}</div>}
   <h2>{(active?recordTitle(active):blockTitle(focus))||tr("现在有一点空档")}</h2>
   {!active&&focus?.note&&<p>{blockNote(focus)}</p>}
   {!active&&!focus&&<p>{tr("可以休息一下，或安排接下来想做的事。")}</p>}
   {p.canNote&&<NextStepCard text={p.nextStep} onEdit={p.onNote} busy={busy}/>}
   {active?<><div className="timer-display" aria-label={tr("已记录 ")+duration((now-active.startedAt)/60000)}>{elapsed(now-active.startedAt)}</div><span className="timer-caption">{tr("开始于 ")}{hm(clock(active.startedAt).min)}{active.day!==date?' · '+active.day:''}{tr(" · 可暂停后继续")}</span></>:focus&&<div className="focus-estimate"><span>{tr("计划留出")}</span><strong>{duration(focus.end-focus.start)}</strong></div>}
   {active&&<TimerCheck due={p.reviewDue} busy={busy} onReview={p.onReview}/>}
   <div className="focus-buttons">{active?<><Button className="start-button" disabled={busy} onClick={p.onPause}><Pause/>{tr("暂停并记下")}</Button>{p.canFinish&&<Button className="finish-button" disabled={busy} onClick={p.onFinish}><Check/>{tr("完成")}</Button>}</>:isToday?<Button className="start-button" disabled={busy} onClick={()=>focus?p.onStart(focus):p.onPlan(null)}>{focus?<Play/>:<Plus/>}{focus?tr("开始这一件事"):tr("安排接下来")}</Button>:<Button className="start-button" disabled={busy} onClick={p.onToday}><ArrowRight/>{tr("回到今天计时")}</Button>}</div>
   <Button className="enter-focus-button" onClick={p.onFocus} disabled={busy}><Focus size={18}/>{tr("进入专注空间")}<ArrowRight size={16}/></Button>
   <div className="focus-secondary"><button onClick={p.onRecord} disabled={busy}><Plus size={16}/>{tr("忘记计时？补记")}</button>{!active&&focus&&!focus.done&&<button onClick={p.onFinish} disabled={busy}><Check size={16}/>{tr("已做完")}</button>}</div>
   {active&&focus&&active.blockId!==focus.id&&isToday&&<button className="switch-task" onClick={()=>p.onStart(focus)} disabled={busy}>{tr("切换到任务 {0}",[blockTitle(focus)])}<ArrowRight size={16}/></button>}
  </section>
  {next&&<div className="next-card"><span>{tr("下一项 · ")}{hm(next.start)}</span><strong>{blockTitle(next)}</strong><span>{tr("计划 ")}{duration(next.end-next.start)}</span></div>}
  {isToday&&<RecoverButton busy={busy} onClick={p.onRecover}/>}
  {isToday&&<details className="replan-card"><summary><RotateCcw size={17}/>{tr("计划有变化？")}</summary><p>{tr("先看调整方案，确认后再修改。")}</p><div className="replan-options"><Button variant="outline" disabled={busy} onClick={()=>p.onPlan('delay')}>{tr("晚了 15 分钟")}</Button><Button variant="outline" disabled={busy} onClick={()=>p.onPlan('low')}>{tr("精力不太够")}</Button><Button variant="ghost" disabled={busy} onClick={()=>p.onPlan('change')}><Plus size={16}/>{tr("临时多了一件事")}</Button></div></details>}
  <p className="execution-note"><Leaf size={15}/>{tr("从现在开始，也来得及。")}</p>
 </div>
}
