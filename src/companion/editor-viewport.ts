import type {NativeView} from './native-types';

/** Bring the focused editing surface into the canvas viewport using Cytoscape's API. */
export function watchEditorViewport(view:NativeView,host:HTMLElement):void{
 const window=host.ownerDocument.defaultView!;let editor:HTMLElement|undefined,frame:number|undefined;
 const reveal=()=>{
  frame=undefined;const graph=view.cy;if(!graph||!editor||!host.contains(editor))return;
  const rect=editor.getBoundingClientRect(),bounds=host.getBoundingClientRect(),left=bounds.left+12,right=bounds.right-48,top=bounds.top+12,bottom=bounds.bottom-12;
  const x=rect.left<left?left-rect.left:rect.right>right?right-rect.right:0,y=rect.top<top?top-rect.top:rect.bottom>bottom?bottom-rect.bottom:0;
  if(Math.abs(x)>1||Math.abs(y)>1)graph.panBy({x,y});
 };
 const schedule=()=>{frame??=window.requestAnimationFrame(reveal);},observer=new ResizeObserver(schedule);
 view.registerDomEvent(host,'focusin',event=>{const element=(event.target as HTMLElement).closest<HTMLElement>('.node-editor-host');if(!element)return;observer.disconnect();editor=element;observer.observe(element);schedule();},{capture:true});
 view.register(()=>{observer.disconnect();if(frame!==undefined)window.cancelAnimationFrame(frame);});
}
