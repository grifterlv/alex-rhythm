'use client';
import type {ComponentProps} from 'react';
import {X} from 'lucide-react';
import {DialogContent as BaseContent,DialogClose} from '@/components/ui/dialog';
import {useLanguage} from './language-provider';
export {Dialog,DialogHeader,DialogTitle,DialogDescription} from '@/components/ui/dialog';

export function DialogContent({children,showCloseButton=true,...props}:ComponentProps<typeof BaseContent>){
 const {tr}=useLanguage();
 return <BaseContent {...props} showCloseButton={false}>{children}{showCloseButton&&<DialogClose className="localized-dialog-close" aria-label={tr('关闭')}><X size={18}/></DialogClose>}</BaseContent>;
}
