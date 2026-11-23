import type {Component} from 'obsidian';
import {iconButton} from '../ui/panel';
import {t} from '../i18n';

interface TextLine{top:number;bottom:number;left:number;right:number}
function textLines(row:HTMLElement):TextLine[]{
 const box=row.getBoundingClientRect(),lines:TextLine[]=[],editing=row.querySelector<HTMLElement>('.em-tetrad-edit-overlay .cm-content'),walker=row.ownerDocument.createTreeWalker(editing??row,NodeFilter.SHOW_TEXT);let node:Node|null;
 while((node=walker.nextNode())){
  if(!node.textContent?.trim()||node.parentElement?.closest('.em-tetrad-row-actions,.em-sr-only,.em-tetrad-edit-edges,.cm-widgetBuffer')||!editing&&node.parentElement?.closest('.em-tetrad-inline'))continue;
  const range=row.ownerDocument.createRange();
  // Word ranges exclude hanging whitespace without measuring every character.
  for(const word of node.textContent.matchAll(/\S+/gu)){
   range.setStart(node,word.index);range.setEnd(node,word.index+word[0].length);
   for(const rect of range.getClientRects()){
   if(!rect.width||!rect.height)continue;
   const existing=lines.find(line=>Math.abs(line.top-(rect.top-box.top))<2);
   if(existing){existing.left=Math.min(existing.left,rect.left-box.left);existing.right=Math.max(existing.right,rect.right-box.left);existing.bottom=Math.max(existing.bottom,rect.bottom-box.top);}
   else lines.push({top:rect.top-box.top,bottom:rect.bottom-box.top,left:rect.left-box.left,right:rect.right-box.left});
   }
  }
 }
 return lines.sort((a,b)=>a.top-b.top);
}
/** Two reusable handles follow the hovered visual line. No button per wrapped
 * line, and no controls in the center gutter between the two text columns. */
export function dragHandles(lifecycle:Component,row:HTMLElement,select:()=>void,start:(event:DragEvent)=>void,press:()=>void=()=>{}):void{
 let pressed=false,hideTimer:number|undefined,dirty=true;
 const win=row.ownerDocument.defaultView!;
 const actions=row.createDiv({cls:'em-tetrad-row-actions'}),handles=([false,true] as const).map(right=>{
  const handle=iconButton(actions,'grip-vertical',t('tetrad.dragEntry'),select);handle.draggable=true;handle.tabIndex=right?-1:0;lifecycle.registerDomEvent(handle,'dragstart',start);lifecycle.registerDomEvent(handle,'pointerdown',event=>{if(event.button===0){pressed=true;press();}});return handle;
 });
 let lines:TextLine[]=[],width=0,height=0;
 const refresh=()=>{lines=textLines(row);width=row.clientWidth;height=row.clientHeight;dirty=false;};
 const cancelHide=()=>{if(hideTimer!==undefined)win.clearTimeout(hideTimer);hideTimer=undefined;};
 const place=(line:TextLine)=>{
  const top=(line.top+line.bottom)/2-15;handles[0]!.style.setProperty('left',line.left-30+'px');handles[1]!.style.setProperty('left',line.right+'px');for(const handle of handles)handle.style.setProperty('top',top+'px');actions.classList.add('has-line');
 };
 const observer=new win.MutationObserver(()=>{dirty=true;});observer.observe(row,{subtree:true,childList:true,characterData:true});
 lifecycle.register(()=>{observer.disconnect();cancelHide();actions.remove();});
 lifecycle.registerDomEvent(row,'pointerenter',()=>{cancelHide();dirty=true;});
 lifecycle.registerDomEvent(row,'pointermove',event=>{
  cancelHide();if(pressed||actions.contains(event.target as Node))return;if(dirty||!lines.length||row.clientWidth!==width||row.clientHeight!==height)refresh();
  const y=event.clientY-row.getBoundingClientRect().top,line=lines.filter(line=>y>=line.top-2&&y<=line.bottom+2).sort((a,b)=>Math.abs(y-(a.top+a.bottom)/2)-Math.abs(y-(b.top+b.bottom)/2))[0];if(line)place(line);else actions.classList.remove('has-line');
 });
 lifecycle.registerDomEvent(row,'pointerleave',()=>{cancelHide();if(!pressed)hideTimer=win.setTimeout(()=>{hideTimer=undefined;if(!pressed)actions.classList.remove('has-line');},120);});
 const release=()=>{pressed=false;};
 lifecycle.registerDomEvent(row.ownerDocument,'pointerup',release);lifecycle.registerDomEvent(row.ownerDocument,'dragend',release);lifecycle.registerDomEvent(win,'blur',release);
 lifecycle.registerDomEvent(row.ownerDocument,'pointercancel',()=>{if(!row.classList.contains('is-dragging'))release();});
 for(const handle of handles)lifecycle.registerDomEvent(handle,'focus',()=>{refresh();if(!actions.classList.contains('has-line')&&lines[0])place(lines[0]);});
}
