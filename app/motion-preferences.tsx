'use client';
import {createContext,useContext,useEffect,useState,type ReactNode} from 'react';
import {Sparkles} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {useLanguage} from './language-provider';

const MotionContext=createContext({enabled:true,reduced:false,toggle:()=>{}});
export function MotionProvider({children}:{children:ReactNode}){
 const [enabled,setEnabled]=useState(true),[reduced,setReduced]=useState(false);
 useEffect(()=>{
  const media=window.matchMedia('(prefers-reduced-motion: reduce)');
  const update=()=>setReduced(media.matches);update();media.addEventListener('change',update);
  try{const stored=localStorage.getItem('alex-rhythm-motion')??localStorage.getItem('liubai-focus-motion');if(stored==='off')setEnabled(false)}catch{}
  const sync=(e:StorageEvent)=>{if(e.key==='alex-rhythm-motion')setEnabled(e.newValue!=='off')};window.addEventListener('storage',sync);
  return()=>{media.removeEventListener('change',update);window.removeEventListener('storage',sync)};
 },[]);
 useEffect(()=>{document.body.dataset.motion=enabled&&!reduced?'full':'reduced'},[enabled,reduced]);
 const toggle=()=>{const next=!enabled;setEnabled(next);try{localStorage.setItem('alex-rhythm-motion',next?'on':'off')}catch{}};
 return <MotionContext.Provider value={{enabled,reduced,toggle}}>{children}</MotionContext.Provider>;
}
export const useMotionPreferences=()=>useContext(MotionContext);
export function MotionToggle(){
 const {tr}=useLanguage(),{enabled,reduced,toggle}=useMotionPreferences();
 const label=reduced?tr('跟随系统：减少动态效果'):enabled?tr('关闭动态效果'):tr('开启动效');
 return <Button className="motion-toggle" variant="ghost" onClick={toggle} disabled={reduced} aria-label={label} title={label} aria-pressed={enabled&&!reduced}><Sparkles size={16}/><span>{tr('动态效果')}</span></Button>;
}
