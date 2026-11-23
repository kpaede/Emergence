import type {EditorView} from '@codemirror/view';
import {solveFlowHeight} from './render/flow-metrics';

export interface EditMeasurement{height:number;projection:number;content:number;offset:number;inset:number;single:boolean}
const rectHeight=(root:HTMLElement):number=>{const rows=[...root.querySelectorAll<HTMLElement>(':scope > .tetrader-gloss')],first=rows[0]?.getBoundingClientRect(),last=rows.at(-1)?.getBoundingClientRect();return first&&last?last.bottom-first.top:0;};
function inertMedia(original:HTMLElement,clone:HTMLElement):void{
 const media=original.querySelectorAll<HTMLElement>('img,iframe,video,audio,canvas'),copies=clone.querySelectorAll<HTMLElement>('img,iframe,video,audio,canvas');
 copies.forEach((element,index)=>{const box=media[index]!.getBoundingClientRect(),standIn=(original.ownerDocument.win as Window&{createSpan:typeof createSpan}).createSpan({cls:element.className});standIn.style.setProperty('width',box.width+'px');standIn.style.setProperty('height',box.height+'px');standIn.classList.add('em-tetrad-probe-media');element.replaceWith(standIn);});
}
/** Measure the current native DOM off-screen at the actual width. This is a
 * short-lived layout probe, not another editor, document or persistent model.
 * Media are inert size stand-ins, so measuring never reloads embedded content. */
export function measureEdit(target:HTMLElement,view:EditorView,lineHeight:number):EditMeasurement{
 const document=target.ownerDocument,win=document.defaultView!,stream=target.closest<HTMLElement>('.tetrader-line-flow'),style=win.getComputedStyle(stream??target),width=(stream??target).getBoundingClientRect().width;
 const host=target.closest<HTMLElement>('.em-tetrad-preview')??target.closest<HTMLElement>('.tetrader-tetrad')?.parentElement??document.body,probe=(document.win as Window&{createDiv:typeof createDiv}).createDiv({cls:'callout tetrader-tetrad em-tetrad-flow-probe',attr:{'aria-hidden':'true'}});probe.inert=true;
 probe.style.setProperty('--em-tetrad-probe-width',width+'px');
 const wing=probe.createDiv({cls:stream?.parentElement?.className??''}),root=stream?stream.cloneNode(true) as HTMLElement:wing.createDiv(),copy=stream?root.querySelectorAll<HTMLElement>(':scope > .tetrader-gloss')[[...stream.querySelectorAll(':scope > .tetrader-gloss')].indexOf(target)]!:root;
 if(stream){inertMedia(stream,root);wing.append(root);}
 for(const property of ['font-family','font-size','font-weight','font-style','line-height','text-align'])root.style.setProperty(property,style.getPropertyValue(property));
 root.style.removeProperty('--tetrader-flow-content-height');root.classList.remove('has-active-edit','is-single-line');
 copy.classList.remove('is-editing','em-tetrad-edit-target');copy.classList.add('em-tetrad-probe-entry','em-tetrad-edit-overlay','markdown-source-view','mod-cm6','cm-s-obsidian');
 for(const cls of view.dom.classList)if(cls!=='cm-editor')copy.classList.add(cls);
 copy.style.removeProperty('height');copy.style.removeProperty('min-height');copy.style.removeProperty('--em-tetrad-edit-height');
 const content=view.contentDOM.cloneNode(true) as HTMLElement;content.style.removeProperty('height');content.style.removeProperty('min-height');content.querySelectorAll('.em-tetrad-edit-edges').forEach(element=>element.remove());
 inertMedia(view.contentDOM,content);
 copy.replaceChildren(content);probe.querySelectorAll('[id]').forEach(element=>element.removeAttribute('id'));
 try{
  host.append(probe);
  if(!stream)return {height:Math.max(lineHeight,copy.getBoundingClientRect().height),projection:0,content:0,offset:0,inset:0,single:true};
  root.classList.add('is-measuring');const rectangular=rectHeight(root),single=root.querySelectorAll(':scope > .tetrader-gloss').length===1&&rectangular<=lineHeight*1.2;root.classList.remove('is-measuring');root.classList.toggle('is-single-line',single);
  const solved=single?{height:rectangular,content:rectangular}:solveFlowHeight(rectangular,height=>{root.style.setProperty('--tetrader-flow-height',height+'px');return rectHeight(root);});
  const box=copy.getBoundingClientRect(),base=root.getBoundingClientRect();return {height:Math.max(lineHeight,box.height),projection:solved.height,content:solved.content,offset:box.top-base.top,inset:single?0:width*.45,single};
 }finally{probe.remove();}
}
