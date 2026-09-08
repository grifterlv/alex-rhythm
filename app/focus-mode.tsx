'use client';
import {useEffect,useRef,useState} from 'react';
import {ArrowLeft,ArrowRight,Check,Clock3,Leaf,Loader2,Pause,Play,Plus,Settings2} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {NativeSelect} from '@/components/ui/native-select';
import {Dialog,DialogContent,DialogDescription,DialogTitle} from '@/components/ui/dialog';
import {focusElapsed,focusScenes,type FocusScene} from '@/lib/focus';
import {clock,elapsed,hm,type Block} from '@/lib/planner';
import {NextStepCard,TimerCheck,RecoverButton} from './recovery-controls';
import ActivityScene from './activity-scene';

type Props={nextStep:string,onNote:()=>void,reviewDue:boolean,onReview:()=>void,onRecover:()=>void,open:boolean,title:string,scene:FocusScene,block?:Block,next?:Block,date:string,startedAt?:number,savedMs:number,now:number,running:boolean,done:boolean,busy:boolean,loading:boolean,error:string,online:boolean,syncing:boolean,canStart:boolean,canFinish:boolean,canUndo:boolean,onUndo:()=>void,onClose:()=>void,onStart:()=>void,onPause:()=>void,onFinish:()=>void,onNext:()=>void,onChoose:()=>void,onRecord:()=>void};
export default function FocusMode(p:Props){
 const [motion,setMotion]=useState(true),[reduced,setReduced]=useState(false),[sceneOverride,setSceneOverride]=useState<FocusScene|'auto'>('auto');
 const heading=useRef<HTMLHeadingElement>(null);
 useEffect(()=>{const media=window.matchMedia('(prefers-reduced-motion: reduce)');const update=()=>setReduced(media.matches);update();media.addEventListener('change',update);try{setMotion(localStorage.getItem('liubai-focus-motion')!=='off')}catch{}return()=>media.removeEventListener('change',update)},[]);
 useEffect(()=>setSceneOverride('auto'),[p.block?.id,p.title]);
 function toggleMotion(){const next=!motion;setMotion(next);try{localStorage.setItem('liubai-focus-motion',next?'on':'off')}catch{}}
 const displayScene=sceneOverride==='auto'?p.scene:sceneOverride;
 const total=focusElapsed(p.savedMs,p.running?p.startedAt:undefined,p.now);
 const paused=!p.running&&!p.done&&p.savedMs>0;
 return <Dialog open={p.open} onOpenChange={v=>!v&&p.onClose()}><DialogContent className="focus-space" showCloseButton={false} onOpenAutoFocus={e=>{e.preventDefault();heading.current?.focus()}}>
  <header className="focus-space-header"><Button variant="ghost" onClick={p.onClose}><ArrowLeft size={18}/>返回日程</Button><span className="focus-wordmark"><Leaf size={19}/>留白 · 专注空间</span><span className={'focus-save-state '+(!p.online?'offline':'')} role="status">{!p.online?'连接中断':p.busy?'正在保存…':p.syncing?'正在同步…':'私人记录已连接'}</span></header>
  <div className="focus-space-body">
   <div className="focus-activity-stage">
    {p.loading?<div className="scene-loading"><Loader2 className="spin"/>正在接上你的一天…</div>:<ActivityScene scene={displayScene} moving={p.running&&motion&&!reduced}/>}
    <div className="scene-caption"><span>{focusScenes[displayScene]}</span><span>{p.done?'这一项完成了':p.running?(motion&&!reduced?'陪你慢慢推进':'静止画面'):paused?'休息一下，再继续':'准备好了再开始'}</span></div>
   </div>
   <section className="focus-task-panel">
    <div className={'focus-state-label '+(p.done?'is-complete':'')}><span>{p.done?<Check size={17}/>:p.running?<Clock3 size={17}/>:<Pause size={17}/>}</span>{p.done?'完成一件事了':p.running?'现在正在做':paused?'已暂停':'接下来，专心做'}</div>
    <DialogTitle ref={heading} tabIndex={-1} className="focus-task-title">{p.title||'选择一件想做的事'}</DialogTitle>
    <DialogDescription className="focus-task-description">{p.block?.note||'先做眼前这一小步。'}</DialogDescription>
    {p.block&&<NextStepCard text={p.nextStep} onEdit={p.onNote} busy={p.busy||p.loading}/>}
    <div className="focus-total"><span>这一项累计投入</span><div role="timer" aria-live="off" aria-label={'累计投入 '+elapsed(total)}>{elapsed(total)}</div></div>
    <p className="focus-session-detail">{p.running&&p.startedAt?`这次开始于 ${hm(clock(p.startedAt).min)}`:p.done?'实际记录已保留。':paused?'已保存的时间会接着累计。':'点击开始后，才会记录实际用时。'}{p.block&&` · 计划 ${hm(p.block.start)}–${hm(p.block.end)}`}</p>
    {p.error&&<div className="focus-error" role="alert">{p.error}</div>}
    {!p.online&&<p className="focus-offline-note">正在显示上次同步的记录。恢复连接后再保存；计时不会因切换页面自动暂停。</p>}
    {p.running&&<TimerCheck due={p.reviewDue} busy={p.busy||p.loading} onReview={p.onReview}/>}
    <div className="focus-space-actions">{p.running?<><Button className="focus-primary-action" disabled={p.busy||p.loading} onClick={p.onPause}><Pause/>暂停并保存</Button>{p.canFinish&&<Button variant="outline" disabled={p.busy||p.loading} onClick={p.onFinish}><Check/>完成这一项</Button>}</>:p.done?<><Button className="focus-primary-action" disabled={p.busy||p.loading} onClick={p.next?p.onNext:p.onChoose}>{p.next?'看看下一项':'回到日程'}<ArrowRight/></Button></>:<><Button className="focus-primary-action" disabled={p.busy||p.loading} onClick={p.canStart?p.onStart:p.onChoose}>{p.canStart?<Play/>:<Plus/>}{p.canStart?(paused?'继续这一项':'开始专注'):'选择今天的任务'}</Button>{p.canFinish&&<Button variant="outline" disabled={p.busy||p.loading} onClick={p.onFinish}><Check/>已做完</Button>}</>}</div>
    <div className="focus-space-secondary">{p.done&&p.canUndo&&<Button variant="ghost" disabled={p.busy} onClick={p.onUndo}>撤销完成</Button>}<Button variant="ghost" disabled={p.busy||p.loading} onClick={p.onRecord}><Plus size={16}/>补记用时</Button><Button variant="ghost" onClick={p.onChoose} disabled={p.busy||p.loading}>选择其他任务</Button></div>
    <RecoverButton busy={p.busy||p.loading} onClick={p.onRecover}/>
    {p.next&&<div className="focus-next-peek"><span>下一项 · {hm(p.next.start)}</span><strong>{p.next.title}</strong><small>等你准备好，再切换。</small></div>}
   </section>
  </div>
  <footer className="focus-space-footer"><span>{p.running?'退出专注或切到其他标签页，计时仍会继续。':'按 Esc 可回到日程。'}</span><details className="focus-scene-settings"><summary><Settings2 size={17}/>画面设置</summary><div><Button variant="outline" onClick={toggleMotion} aria-pressed={!motion} disabled={reduced}>{reduced?'跟随系统：减少动态效果':motion?'让画面静止':'恢复轻动画'}</Button><label><span>活动场景</span><NativeSelect value={sceneOverride} onChange={e=>setSceneOverride(e.target.value as FocusScene|'auto')}><option value="auto">自动 · {focusScenes[p.scene]}</option>{Object.entries(focusScenes).map(([key,title])=><option key={key} value={key}>{title}</option>)}</NativeSelect></label></div></details></footer>
 </DialogContent></Dialog>
}
