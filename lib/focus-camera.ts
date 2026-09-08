export type FocusView={yaw:number,elevation:number,zoom:number};
export const initialFocusView:FocusView={yaw:.72,elevation:.53,zoom:1};
const safe=(n:number,fallback:number)=>Number.isFinite(n)?n:fallback;
export function changeFocusView(view:FocusView,delta:Partial<FocusView>):FocusView{
 return {
  yaw:Math.max(.2,Math.min(1.3,safe(view.yaw+safe(delta.yaw??0,0),initialFocusView.yaw))),
  elevation:Math.max(.28,Math.min(.86,safe(view.elevation+safe(delta.elevation??0,0),initialFocusView.elevation))),
  zoom:Math.max(.82,Math.min(1.18,safe(view.zoom+safe(delta.zoom??0,0),initialFocusView.zoom)))
 };
}
