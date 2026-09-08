'use client';
import {useEffect,useState} from 'react';
import {ArrowRight,Bookmark,Clock3,Pencil,RotateCcw} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import {Textarea} from '@/components/ui/textarea';
import {NativeSelect} from '@/components/ui/native-select';
import {Dialog,DialogContent,DialogHeader,DialogTitle,DialogDescription} from '@/components/ui/dialog';
import {duration,localInput,parseLocalInput,type Active} from '@/lib/planner';
import {reviewedSession,type TimerReview} from '@/lib/recovery';

export function NextStepCard({text,onEdit,busy}:{text:string,onEdit:()=>void,busy:boolean}){
 return <div className="next-step-card"><div><span><Bookmark size={16}/>回来先做这一小步</span><Button variant="ghost" size="sm" disabled={busy} onClick={onEdit} aria-label={text?'修改下一步':'留下一步'}><Pencil size={15}/>{text?'修改':'写一句'}</Button></div>{text?<p>{text}</p>:<p className="next-step-empty">例如：先把登录按钮改好。</p>}</div>;
}
export function TimerCheck({due,busy,onReview}:{due:boolean,busy:boolean,onReview:()=>void}){
 return <div className={'timer-check '+(due?'is-due':'')}>{due&&<p>这段计时已有一阵子没核对了。都在做这件事吗？</p>}<Button variant="ghost" disabled={busy} onClick={onReview}><Clock3 size={16}/>{due?'核对这段时间':'忘记暂停？修正计时'}</Button></div>;
}
export function RecoverButton({busy,onClick}:{busy:boolean,onClick:()=>void}){
 return <Button variant="outline" className="recover-entry" disabled={busy} onClick={onClick}><RotateCcw size={17}/>我跑偏了<ArrowRight size={16}/></Button>;
}
export type MemoTarget={date:string,id:string,title:string,text:string,paused?:boolean};
export function NextStepDialog({target,busy,onClose,onSave}:{target:MemoTarget|null,busy:boolean,onClose:()=>void,onSave:(text:string)=>Promise<boolean>}){
 const [text,setText]=useState(''),[error,setError]=useState('');
 useEffect(()=>{setText(target?.text??'');setError('')},[target]);
 return <Dialog open={!!target} onOpenChange={v=>!v&&!busy&&onClose()}><DialogContent className="recovery-dialog"><DialogHeader><DialogTitle>{target?.paused?'已经暂停，留个接头暗号？':'下一步，先做什么？'}</DialogTitle><DialogDescription>{target?.title} · 选填，写一句就够了。</DialogDescription></DialogHeader><form onSubmit={async e=>{e.preventDefault();setError('');try{if(await onSave(text))onClose()}catch(e){setError((e as Error).message)}}}><label className="recovery-field"><span>做到哪里了？回来先做什么？</span><Textarea autoFocus maxLength={240} value={text} disabled={busy} onChange={e=>setText(e.target.value)} placeholder="登录页面已搭好，下一步先接上提交按钮。"/></label><p className="recovery-help">会保存在这个任务里，下次打开就能看到。</p>{error&&<p className="form-error" role="alert">{error}</p>}<div className="recovery-actions"><Button type="button" variant="ghost" disabled={busy} onClick={onClose}>{target?.paused?'暂时不写':'取消'}</Button><Button disabled={busy} type="submit">{busy?'保存中…':'保存下一步'}</Button></div></form></DialogContent></Dialog>;
}
export type ReviewTarget={active:NonNullable<Active>,at:number,reason:'manual'|'pause'|'recover'};
export function TimerReviewDialog({target,busy,onClose,onSave}:{target:ReviewTarget|null,busy:boolean,onClose:()=>void,onSave:(review:TimerReview)=>Promise<boolean>}){
 const [kind,setKind]=useState<TimerReview['kind']>('keep'),[end,setEnd]=useState(''),[breakStart,setBreakStart]=useState(''),[breakEnd,setBreakEnd]=useState(''),[error,setError]=useState('');
 useEffect(()=>{setKind('keep');setError('');if(target){setEnd(localInput(target.at));setBreakStart(localInput(Math.max(target.active.startedAt,target.at-30*60000)));setBreakEnd(localInput(target.at))}},[target]);
 function input(resume=false):TimerReview{
  if(!target)throw new Error('请重新打开核对窗口。');
  const preserve=(value:string,original:number)=>localInput(original)===value?original:parseLocalInput(value);
  return {sessionId:target.active.id,at:target.at,kind,resume,...(kind==='end'?{end:preserve(end,target.at)}:kind==='break'?{breakStart:preserve(breakStart,target.active.startedAt),breakEnd:preserve(breakEnd,target.at)}:{})};
 }
 let preview='';if(target)try{const result=reviewedSession(target.active,input(),target.at);const work=result.logs.filter(l=>l.blockId===target.active.blockId).reduce((s,l)=>s+l.end-l.start,0);const rest=result.logs.filter(l=>l.blockId==='').reduce((s,l)=>s+l.end-l.start,0);preview=`这件事记入 ${duration(work/60000)}${rest?' · 休息 '+duration(rest/60000):''}`}catch{}
 async function save(resume:boolean){setError('');try{const value=input(resume);reviewedSession(target!.active,value);if(await onSave(value))onClose()}catch(e){setError((e as Error).message)}}
 return <Dialog open={!!target} onOpenChange={v=>!v&&!busy&&onClose()}><DialogContent className="recovery-dialog"><DialogHeader><DialogTitle>{target?.reason==='recover'?'先核对一下刚才的时间':'这段时间，都在做这件事吗？'}</DialogTitle><DialogDescription>{target?.active.title} · 以你确认的时间为准。</DialogDescription></DialogHeader>{target&&<>
 <div className="review-interval"><Clock3 size={19}/><div><strong>{duration((target.at-target.active.startedAt)/60000)}</strong><span>{localInput(target.active.startedAt).replace('T',' ')} → {localInput(target.at).replace('T',' ')} · 多伦多</span></div></div>
 <label className="recovery-field"><span>这段时间的实际情况</span><NativeSelect disabled={busy} value={kind} onChange={e=>{setKind(e.target.value as TimerReview['kind']);setError('')}}><option value="keep">一直在做，保留全部</option><option value="end">早就停了，调整结束时间</option><option value="break">中间休息了一段</option></NativeSelect></label>
 {kind==='end'&&<label className="recovery-field"><span>实际做到几点？</span><Input type="datetime-local" disabled={busy} value={end} onChange={e=>setEnd(e.target.value)}/><small>之后的时间不计入这件事；需要时可以另外补记。</small></label>}
 {kind==='break'&&<div className="recovery-time-fields"><label className="recovery-field"><span>休息开始</span><Input type="datetime-local" disabled={busy} value={breakStart} onChange={e=>setBreakStart(e.target.value)}/></label><label className="recovery-field"><span>休息结束</span><Input type="datetime-local" disabled={busy} value={breakEnd} onChange={e=>setBreakEnd(e.target.value)}/></label><p>休息前后分别记入任务，中间单独记为休息。</p></div>}
 {preview&&<p className="review-result" aria-live="polite">{preview}</p>}
 <p className="recovery-help">核对到打开窗口的时间。保存并暂停后，这一刻之后的时间不计入任务；关闭窗口则保持原来的计时。</p>
 {error&&<p className="form-error" role="alert">{error}</p>}
 <div className="recovery-actions"><Button variant="ghost" disabled={busy} onClick={onClose}>先不改</Button>{kind==='keep'&&target.reason==='manual'&&<Button variant="outline" disabled={busy} onClick={()=>save(true)}>保留并继续计时</Button>}<Button disabled={busy} onClick={()=>save(false)}>{busy?'保存中…':target.reason==='recover'?'确认时间，继续安排':kind==='keep'?'保留并暂停':'保存修正并暂停'}</Button></div>
 </>}</DialogContent></Dialog>;
}
