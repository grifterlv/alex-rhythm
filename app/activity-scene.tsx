'use client';
import {useLanguage} from './language-provider';
import {useEffect,useRef,useState} from 'react';
import {Box,ChevronLeft,ChevronRight,Loader2,Minus,Plus,RotateCcw} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {type FocusScene} from '@/lib/focus';
import type {SceneController} from '@/lib/focus-renderer';
export default function ActivityScene({scene,moving}:{scene:FocusScene,moving:boolean}){
 const {tr,focusScenes}=useLanguage();

 const host=useRef<HTMLDivElement>(null),controller=useRef<SceneController|null>(null),movingRef=useRef(moving);
 const [status,setStatus]=useState<'loading'|'ready'|'error'>('loading'),[attempt,setAttempt]=useState(0);
 movingRef.current=moving;
 useEffect(()=>{let cancelled=false;setStatus('loading');void import('@/lib/focus-renderer').then(({mountScene})=>{if(cancelled||!host.current)return;try{let failed=false;controller.current=mountScene(host.current,scene,movingRef.current,()=>{failed=true;if(!cancelled)setStatus('error')});if(!failed)setStatus('ready')}catch{setStatus('error')}}).catch(()=>!cancelled&&setStatus('error'));return()=>{cancelled=true;controller.current?.dispose();controller.current=null}},[scene,attempt]);
 useEffect(()=>controller.current?.setMoving(moving),[moving]);
 return <div className="activity-scene"><div ref={host} className="scene-canvas-host" role="img" aria-label={focusScenes[scene]+tr(" 3D 活动场景")}/>{status==='ready'&&<div className="scene-view-controls"><span>{tr('拖动查看场景')}</span><div className="scene-view-buttons" role="group" aria-label={tr('场景视角')}>
  <Button variant="ghost" size="icon" aria-label={tr('向左旋转')} title={tr('向左旋转')} onClick={()=>controller.current?.rotate(-1)}><ChevronLeft size={16}/></Button>
  <Button variant="ghost" size="icon" aria-label={tr('向右旋转')} title={tr('向右旋转')} onClick={()=>controller.current?.rotate(1)}><ChevronRight size={16}/></Button>
  <Button variant="ghost" size="icon" aria-label={tr('拉远')} title={tr('拉远')} onClick={()=>controller.current?.zoom(-1)}><Minus size={16}/></Button>
  <Button variant="ghost" size="icon" aria-label={tr('拉近')} title={tr('拉近')} onClick={()=>controller.current?.zoom(1)}><Plus size={16}/></Button>
  <Button variant="ghost" size="icon" aria-label={tr('重置视角')} title={tr('重置视角')} onClick={()=>controller.current?.resetView()}><RotateCcw size={16}/></Button>
 </div></div>}{status==='loading'&&<div className="scene-loading" role="status"><Loader2 className="spin"/>{tr("正在打开小场景…")}</div>}{status==='error'&&<div className="scene-loading scene-error" role="status"><Box size={34}/><strong>{focusScenes[scene]}</strong><p>{tr("这个设备暂时没有显示出 3D 场景。任务和计时仍可继续。")}</p><Button variant="outline" onClick={()=>setAttempt(n=>n+1)}>{tr("重试场景")}</Button></div>}</div>
}
