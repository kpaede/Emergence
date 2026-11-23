import {measureEdit} from './edit-measure';
import {StateEffect,StateField,type Extension} from '@codemirror/state';
import {Decoration,EditorView,WidgetType,type DecorationSet} from '@codemirror/view';
import {refreshTetradFlow} from './render/line-flow';

interface Edge {side:'left'|'right';start:number;slope:number;limit:number;height:number}
const clamp=(value:number,limit:number):number=>Math.max(0,Math.min(limit,value));
/** Continue the projection with a flat tail after the quadrant boundary. Never
 * let a newly wrapped line fall out of the shape while awaiting measurement. */
export function editEdgeShape(edge:Edge):{width:number;polygon:string}{
 const end=clamp(edge.start+edge.slope*edge.height,edge.limit),width=Math.max(edge.start,end),points:[number,number][]=[[edge.start,0]];
 const bound=edge.slope>0?edge.limit:0,at=edge.slope?(bound-edge.start)/edge.slope:Infinity;
 if(at>0&&at<edge.height)points.push([bound,at]);points.push([end,edge.height]);
 const contour=edge.side==='left'?[[0,0],...points,[0,edge.height]]:[[width,0],[width,edge.height],...[...points].reverse().map(([x,y])=>[width-x,y])];
 return {width,polygon:'polygon('+contour.map(([x,y])=>`${x}px ${y}px`).join(', ')+')'};
}
class EditEdges extends WidgetType {
 constructor(private edges:Edge[]){super();}
 eq(other:WidgetType):boolean{return other instanceof EditEdges&&JSON.stringify(this.edges)===JSON.stringify(other.edges);}
 get estimatedHeight():number{return 0;}
 toDOM(view:EditorView):HTMLElement{
  // Only this zero-height inline wrapper is a CM widget. Its floating children
  // shape the text without entering CM's document height as giant widgets.
  const wrapper=(view.dom.ownerDocument.win as Window&{createSpan:typeof createSpan}).createSpan({cls:'em-tetrad-edit-edges'});
  wrapper.setAttribute('aria-hidden','true');
  for(const edge of this.edges){const element=wrapper.createSpan({cls:'em-tetrad-edit-edge'}),shape=editEdgeShape(edge);element.style.cssFloat=edge.side;element.style.width=shape.width+'px';element.style.height=edge.height+'px';element.style.shapeOutside=shape.polygon;}
  return wrapper;
 }
 ignoreEvent():boolean{return true;}
}
/** Preserve the reading nodes and their footprint while editing in a shaped
 * native CM document above them. All extensions are local to this editor. */
export class TetradEditGeometry {
 readonly extension:Extension;
 private redraw=StateEffect.define<void>();private stream:HTMLElement|null;private rootContent='';
 private minHeight:string;private savedHeight:string;private wasSingle=false;private initialY=0;private globalHeight=0;private inset=0;private positive=false;private gap=0;private font='';private align='';private lineHeight=18;
 private flowHeight='';private view?:EditorView;private observer?:ResizeObserver;private frame?:number;private measuring=false;private alive=true;private height:number;private extent=4096;private width:number;
 constructor(private target:HTMLElement,_value:string){
  const win=target.ownerDocument.defaultView!,box=target.getBoundingClientRect(),reference=target.querySelector('p')??target,style=win.getComputedStyle(reference);
  this.font=this.textStyle(style);this.align=style.textAlign;this.lineHeight=Number.parseFloat(style.lineHeight)||18;
  this.height=box.height||this.lineHeight;this.savedHeight=target.style.height;this.width=box.width;this.minHeight=target.style.minHeight;target.style.setProperty('--em-tetrad-edit-height',this.height+'px');
  target.style.height=this.height+'px';
  this.stream=target.closest<HTMLElement>('.tetrader-line-flow');this.flowHeight=this.stream?.style.getPropertyValue('--tetrader-flow-height')??'';this.rootContent=this.stream?.style.getPropertyValue('--tetrader-flow-content-height')??'';this.wasSingle=this.stream?.classList.contains('is-single-line')??false;this.captureProjection();
  const field=StateField.define<DecorationSet>({create:state=>this.decorations(state.doc.toString()),update:(value,tr)=>tr.docChanged||tr.effects.some(effect=>effect.is(this.redraw))?this.decorations(tr.state.doc.toString()):value,provide:field=>EditorView.decorations.from(field)});
  this.extension=field;
 }
 private textStyle(style:CSSStyleDeclaration):string{
  // The computed font shorthand may be empty when a theme sets additional
  // font properties. Copy the actual longhands, including spacing.
  return ['font-family','font-size','font-weight','font-style','font-stretch','font-variant','font-feature-settings','font-kerning','letter-spacing','word-spacing'].map(property=>property+':'+style.getPropertyValue(property)+';').join('');
 }
 private captureProjection():void{
  if(!this.stream)return;const box=this.target.getBoundingClientRect(),rootBox=this.stream.getBoundingClientRect(),edge=this.stream.querySelector<HTMLElement>('.tetrader-flow-left');
  this.initialY=box.top-rootBox.top;this.globalHeight=edge?.getBoundingClientRect().height??0;this.inset=edge?.getBoundingClientRect().width??0;
  this.positive=!!this.stream.closest('.tetrader-enhances,.tetrader-obsolesces');if(this.stream.classList.contains('is-single-line'))this.inset=0;
  this.gap=Number.parseFloat(this.target.ownerDocument.defaultView!.getComputedStyle(this.target).fontSize)*2;
  const paragraphs=[...this.target.querySelectorAll('p')];if(paragraphs.length>1){const gap=paragraphs[1]!.getBoundingClientRect().top-paragraphs[0]!.getBoundingClientRect().bottom;if(gap>0)this.gap=gap;}
  this.stream.classList.add('has-active-edit');
 }
 private decorations(value:string):DecorationSet{
  const ranges=[];
  if(this.inset>0&&this.globalHeight>0){
   const slope=(this.positive?1:-1)*this.inset/this.globalHeight,start=clamp((this.positive?0:this.inset)+slope*this.initialY,this.inset);
   const edges:Edge[]=([{side:'left',start,slope,limit:this.inset,height:this.extent},{side:'right',start:this.inset-start,slope:-slope,limit:this.inset,height:this.extent}]);ranges.push(Decoration.widget({widget:new EditEdges(edges),side:-1}).range(0));
  }
  let at=0;for(const line of value.split('\n')){
   const blank=!line.trim()&&this.gap>0&&value.includes('\n'),style=`${this.font}text-align:${this.align};line-height:${blank?this.gap:this.lineHeight}px;padding:0;text-indent:0;min-height:0;`+(blank?`height:${this.gap}px;min-height:0;`:'');
   ranges.push(Decoration.line({attributes:{style}}).range(at));at+=line.length+1;
  }
  return Decoration.set(ranges,true);
 }
 get pending():boolean{return this.frame!==undefined||this.measuring;}
 attach(view:EditorView):void{
  this.view=view;const win=this.target.ownerDocument.defaultView!;
  this.observer=new win.ResizeObserver(()=>{if(Math.abs(this.target.getBoundingClientRect().width-this.width)>.5||!this.pending&&Math.abs(this.nativeHeight()-this.height)>.5)this.schedule();});
  this.observer.observe(this.target);this.observer.observe(view.dom);
  this.target.ownerDocument.fonts?.addEventListener('loadingdone',this.fontsChanged);
  if(this.target.classList.contains('is-new'))this.schedule();
 }
 private fontsChanged=()=>this.schedule();
 changed(_view:EditorView):void{this.schedule();}
 private schedule():void{
  if(!this.alive||!this.view||this.frame!==undefined)return;
  this.frame=this.target.ownerDocument.defaultView!.requestAnimationFrame(()=>{this.frame=undefined;if(!this.alive||!this.view||!this.target.getBoundingClientRect().width)return;this.measuring=true;
   try{
    const style=this.target.ownerDocument.defaultView!.getComputedStyle(this.target.querySelector('p')??this.target),font=this.textStyle(style),lineHeight=Number.parseFloat(style.lineHeight)||18;
    if(font!==this.font||lineHeight!==this.lineHeight){this.font=font;this.lineHeight=lineHeight;this.align=style.textAlign;this.view.dispatch({effects:this.redraw.of()});}
    const next=measureEdit(this.target,this.view,this.lineHeight);
    this.height=next.height;this.globalHeight=next.projection;this.initialY=next.offset;this.inset=next.inset;this.extent=Math.max(4096,next.height+4096);
    this.target.style.height=next.height+'px';this.target.style.setProperty('--em-tetrad-edit-height',next.height+'px');
    if(this.stream){this.stream.classList.toggle('is-single-line',next.single);this.stream.style.setProperty('--tetrader-flow-height',next.projection+'px');this.stream.style.setProperty('--tetrader-flow-content-height',next.content+'px');}
    this.width=this.target.getBoundingClientRect().width;this.fitNative();
   }finally{this.measuring=false;}
  });
 }
 /** Account for actual native line boxes, without copying its optional tail
  * padding into the entry. Projection corrections only increase, so they cannot
  * feed a wrap oscillation back into the diagram. All passes finish in this frame. */
 private nativeHeight():number{
  const content=this.view?.contentDOM;if(!content)return this.height;
  const last=content.lastElementChild?.getBoundingClientRect();return Math.max(this.lineHeight,last?.height?last.bottom-content.getBoundingClientRect().top:this.height);
 }
 private fitNative():void{
  const view=this.view!;
  for(let pass=0;pass<8;pass++){
   view.dispatch({effects:this.redraw.of()});const actual=this.nativeHeight();this.height=actual;this.target.style.height=actual+'px';this.target.style.setProperty('--em-tetrad-edit-height',actual+'px');
   if(!this.stream)break;
   const rows=[...this.stream.querySelectorAll<HTMLElement>(':scope > .tetrader-gloss')],first=rows[0]?.getBoundingClientRect(),last=rows.at(-1)?.getBoundingClientRect(),total=first&&last?last.bottom-first.top:actual,single=rows.length===1&&actual<=this.lineHeight*1.2,root=this.stream.getBoundingClientRect();
   const offset=this.target.getBoundingClientRect().top-root.top,height=single?total:Math.max(this.globalHeight,total),inset=single?0:root.width*.45,changed=Math.abs(height-this.globalHeight)>.5||Math.abs(offset-this.initialY)>.5||Math.abs(inset-this.inset)>.5;
   this.stream.classList.toggle('is-single-line',single);this.stream.style.setProperty('--tetrader-flow-content-height',total+'px');this.stream.style.setProperty('--tetrader-flow-height',height+'px');
   this.globalHeight=height;this.initialY=offset;this.inset=inset;this.width=this.target.getBoundingClientRect().width;
   if(!changed)break;
  }
 }
 destroy():void{
  if(!this.alive)return;this.alive=false;this.observer?.disconnect();if(this.frame!==undefined)this.target.ownerDocument.defaultView!.cancelAnimationFrame(this.frame);this.target.ownerDocument.fonts?.removeEventListener('loadingdone',this.fontsChanged);this.target.style.height=this.savedHeight;this.target.style.minHeight=this.minHeight;this.target.style.removeProperty('--em-tetrad-edit-height');
  if(this.stream){this.stream.classList.remove('has-active-edit');this.stream.classList.toggle('is-single-line',this.wasSingle);if(this.flowHeight)this.stream.style.setProperty('--tetrader-flow-height',this.flowHeight);else this.stream.style.removeProperty('--tetrader-flow-height');if(this.rootContent)this.stream.style.setProperty('--tetrader-flow-content-height',this.rootContent);else this.stream.style.removeProperty('--tetrader-flow-content-height');}refreshTetradFlow(this.target);
 }
}
