'use client';
import {createContext,useCallback,useContext,useEffect,useMemo,useState,type ReactNode} from 'react';
import {Languages} from 'lucide-react';
import {NativeSelect} from '@/components/ui/native-select';
import {detectLocale,isLocale,LANGUAGE_KEY,languageNames,localizedHelpers,locales,type Locale} from '@/lib/i18n';

const LanguageContext=createContext({locale:'zh-CN' as Locale,setLocale:(_locale:Locale)=>{},persistent:true});
export function LanguageProvider({children}:{children:ReactNode}){
 const [locale,setState]=useState<Locale>('zh-CN'),[persistent,setPersistent]=useState(true);
 useEffect(()=>{
  try{const stored=localStorage.getItem(LANGUAGE_KEY);setState(isLocale(stored)?stored:detectLocale(navigator.language))}catch{setState(detectLocale(navigator.language));setPersistent(false)}
  const sync=(event:StorageEvent)=>{if(event.key===LANGUAGE_KEY&&isLocale(event.newValue))setState(event.newValue)};
  window.addEventListener('storage',sync);return()=>window.removeEventListener('storage',sync);
 },[]);
 useEffect(()=>{
  document.documentElement.lang=locale;
  document.querySelector('meta[name="description"]')?.setAttribute('content',localizedHelpers(locale).tr('安排时间，记录真实用时，为生活留一点空间。'));
 },[locale]);
 const setLocale=useCallback((next:Locale)=>{if(!isLocale(next))return;setState(next);try{localStorage.setItem(LANGUAGE_KEY,next);setPersistent(true)}catch{setPersistent(false)}},[]);
 const value=useMemo(()=>({locale,setLocale,persistent}),[locale,setLocale,persistent]);
 return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}
export function useLanguage(){
 const context=useContext(LanguageContext);
 return {...useMemo(()=>localizedHelpers(context.locale),[context.locale]),setLocale:context.setLocale,persistent:context.persistent};
}
export function LanguagePicker(){
 const {locale,setLocale,tr,persistent}=useLanguage();
 return <div className="language-control"><label className="language-picker"><Languages size={18} aria-hidden="true"/><span className="sr-only">{tr('界面语言')}</span><NativeSelect aria-label={tr('界面语言')} value={locale} onChange={e=>isLocale(e.target.value)&&setLocale(e.target.value)}>{locales.map(language=><option key={language} value={language} lang={language}>{languageNames[language]}</option>)}</NativeSelect></label>{!persistent&&<span className="language-storage-note" role="status">{tr('语言已切换，但此浏览器无法记住选择。')}</span>}</div>;
}
