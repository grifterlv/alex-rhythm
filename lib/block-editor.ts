import {hm,minutes,type Block,type Day} from './planner';

export type TimeRange = Pick<Block,'start'|'end'>;

// Opening an empty slot creates only an editor draft, never a saved task or timer.
export function draftInGap(day:Day,range:TimeRange):Block|null{
 const {start,end}=range;
 if(!Number.isInteger(start)||!Number.isInteger(end)||start<0||end>2880||end<=start||day.blocks.some(b=>b.start<end&&b.end>start))return null;
 return {id:crypto.randomUUID(),title:'',category:'life',start,end,note:'',done:false};
}

export function editedBlockTimes(draft:TimeRange,startText:string,endText:string,wake:number):TimeRange{
 // A time input omits the date. Retain the prefilled day offset when its clock
 // value is unchanged, including a gap ending at the following wake time.
 const start=startText===hm(draft.start)?draft.start:minutes(startText,wake);
 let end=endText===hm(draft.end)?draft.end:minutes(endText,wake);
 if(end<=start)end+=1440;
 return {start,end};
}
