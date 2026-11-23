import {decorateTetrad} from '../src/tetrad/editor-ui';
/** Isolated native regression fixture. Never focuses editors or writes notes. */
import {Component,Plugin} from 'obsidian';
import {initializeLanguage} from '../src/i18n';
import {renderTetrad} from '../src/tetrad/render/source';
import {TetradEditGeometry} from '../src/tetrad/edit-geometry';
import {TetradInlineEditor} from '../src/tetrad/inline-editor';
import {measureTetradFlow} from '../src/tetrad/render/line-flow';
import {tetradEntries} from '../src/tetrad/entries';
import {parseSource} from '../src/tetrad/source';
import {DEFAULT_PATTERN,TetradStore} from '../src/tetrad/patterns';

type Rect={x:number;y:number;width:number;height:number};
const wait=(ms:number)=>new Promise(resolve=>setTimeout(resolve,ms));
function textRects(element:HTMLElement):Rect[]{
 const values:Rect[]=[],walker=element.ownerDocument.createTreeWalker(element,NodeFilter.SHOW_TEXT);let node:Node|null;
 while((node=walker.nextNode())){
  if(!/[\p{L}\p{N}]/u.test(node.textContent??'')||node.parentElement?.closest('.em-sr-only,.em-tetrad-edit-edges,.cm-widgetBuffer'))continue;
  const range=element.ownerDocument.createRange(),text=node.textContent??'';
  // Hanging whitespace in pre-wrap may extend beyond a CSS Shape. Inspect the
  // visible glyphs, grouping them by visual line, rather than counting spaces.
  for(let at=0;at<text.length;at++){
   if(/\s/u.test(text[at]!))continue;range.setStart(node,at);range.setEnd(node,at+1);
   const rect=range.getBoundingClientRect();if(rect.width<=0||rect.height<=0)continue;
   const last=values.at(-1);if(last&&Math.abs(last.y-rect.y)<.5){const right=Math.max(last.x+last.width,rect.right);last.x=Math.min(last.x,rect.x);last.width=right-last.x;last.height=Math.max(last.height,rect.height);}else values.push({x:rect.x,y:rect.y,width:rect.width,height:rect.height});
  }
 }
 return values;
}
function boxes(host:HTMLElement):Rect[]{return [...host.querySelectorAll('.tetrader-statement,.tetrader-gloss')].map(element=>{const b=element.getBoundingClientRect();return{x:b.x,y:b.y,width:b.width,height:b.height};});}
function stable(a:Rect[],b:Rect[]):boolean{return a.length===b.length&&a.every((rect,i)=>Math.abs(rect.x-b[i]!.x)<.75&&Math.abs(rect.y-b[i]!.y)<.75&&Math.abs(rect.width-b[i]!.width)<.75&&Math.abs(rect.height-b[i]!.height)<.75);}
async function settle(geometry:TetradEditGeometry):Promise<void>{
 const pending=geometry;
 for(let pass=0;pass<80;pass++){await wait(16);if(!pending.pending){await wait(16);if(!pending.pending)return;}}
 throw Error('Text projection did not settle.');
}
function inspect(target:HTMLElement,inline:TetradInlineEditor,glyphOffset:number){
 const view=inline.markdown.native.cm,rects=textRects(view.contentDOM),box=target.getBoundingClientRect(),stream=target.closest<HTMLElement>('.tetrader-line-flow'),root=stream?.getBoundingClientRect(),lineHeight=Number.parseFloat(getComputedStyle(view.contentDOM.querySelector('.cm-line')!).lineHeight);
 const inset=stream&&!stream.classList.contains('is-single-line')?root!.width*.45:0,positive=!!stream?.closest('.tetrader-enhances,.tetrader-obsolesces'),height=Number.parseFloat(stream?.style.getPropertyValue('--tetrader-flow-height')??'0');
 const violations=rects.filter(rect=>{
  if(!stream||!inset||!height)return rect.x<box.x-1||rect.x+rect.width>box.right+1;
  const y=Math.max(0,rect.y-glyphOffset-root!.y),start=Math.min(1,y/height),end=Math.min(1,(y+lineHeight)/height);
  const left=root!.x+inset*(positive?end:1-start),right=root!.right-inset*(positive?1-start:end);
  return rect.x<left-1||rect.x+rect.width>right+1;
 });
 const lastBox=view.contentDOM.querySelector<HTMLElement>('.cm-line:last-child')?.getBoundingClientRect(),excess=lastBox?box.height-(lastBox.bottom-view.contentDOM.getBoundingClientRect().top):0;
 const last=rects.at(-1),clipped=!!last&&last.y+last.height>box.bottom+lineHeight/2;
 const caret=view.coordsAtPos(0),align=getComputedStyle(view.contentDOM.querySelector('.cm-line')!).textAlign;
 const y=box.top-(root?.top??box.top),start=height?Math.min(1,y/height):0,end=height?Math.min(1,(y+lineHeight)/height):0;
 const left=(root?.left??box.left)+inset*(positive?end:1-start),right=(root?.right??box.right)-inset*(positive?1-start:end);
 const emptyCaretDelta=!view.state.doc.length&&caret?Math.abs(caret.left-(align==='right'?right:left)):0;
 return {rects:rects.length?[rects[0]!,rects.at(-1)!]:[],lineCount:rects.length,violations:violations.slice(0,5),violationCount:violations.length,excess,clipped,targetHeight:box.height,contentHeight:view.contentDOM.getBoundingClientRect().height,inset,height,emptyCaretDelta,caret:caret&&{x:caret.left,y:caret.top},expectedCaret:align==='right'?right:left};
}
export default class PositionProbe extends Plugin {
 async onload():Promise<void>{
  const global=window as Window&{__emTetradPosition?:unknown};global.__emTetradPosition={done:false};
  void this.check().then(result=>{global.__emTetradPosition={done:true,...result};}).catch((error:unknown)=>{global.__emTetradPosition={done:true,failure:error instanceof Error?error.stack:String(error)};});
 }
 private async check(){
  initializeLanguage('de');const savedFocus=document.activeElement,savedOwner=this.app.workspace.activeEditor,component=new Component();component.load();
  const scope=document.body.createDiv({attr:{id:'em-tetrad-position-scope'}}),sheet=document.head.createEl('style');
  sheet.textContent='#em-tetrad-position-scope {'+await this.app.vault.adapter.read(this.manifest.dir+'/styles.css')+'}';
  const host=scope.createDiv({cls:'em-workspace em-tetrad em-tetrad-graphic'});host.style.cssText='position:fixed;left:-10000px;top:0;width:650px;height:1200px;overflow:visible;pointer-events:none;';
  const preview=host.createDiv({cls:'em-tetrad-preview markdown-rendered'}),settings=new TetradStore(undefined,async()=>{}).settings(DEFAULT_PATTERN);settings.centerDisplay='none';settings.legendPosition='none';
  const report:unknown[]=[];let layout:Awaited<ReturnType<typeof renderTetrad>>|undefined,geometry:TetradEditGeometry|undefined,inline:TetradInlineEditor|undefined;
  try{
   for(const theme of ['light','dark'])for(const name of ['Crowd','Microphone','Newspaper','Empty']){
    scope.className='theme-'+theme;
    const file=this.app.vault.getFileByPath('Emergence Beispiele/Tetraden/'+(name==='Empty'?'Crowd':name)+'.md');if(!file)throw Error('Missing example '+name);
    const original=await this.app.vault.read(file),source=name==='Empty'?'> [!tetrad] Empty\n>\n'+['Enhances','Reverses into','Retrieves','Obsolesces'].map(label=>'> ## '+label+'\n> Core\n>\n').join(''):original,callout=preview.createDiv({cls:'callout',attr:{'data-callout':'tetrad'}});
    layout=await renderTetrad(this.app,callout,source,DEFAULT_PATTERN,settings,file.path,component);decorateTetrad(callout);await wait(100);measureTetradFlow(callout);
    for(const law of ['enhances','reverses','retrieves','obsolesces'] as const){
     const wing=preview.querySelector<HTMLElement>('.tetrader-'+law)!;
     for(const kind of name==='Crowd'?['core','row']:['row']){
     const target=name==='Empty'?wing.querySelector<HTMLElement>('[data-em-placeholder]')!:wing.querySelector<HTMLElement>(kind==='core'?'.tetrader-statement':'.tetrader-gloss');if(!target)continue;
     const model=tetradEntries(parseSource(source,DEFAULT_PATTERN).sections.get(law)!.body),index=Number(target.dataset.emEntryIndex),value=target.dataset.emPlaceholder?'Gloss':kind==='core'?model.core!.content:model.entries.find(entry=>entry.index===index)!.content,before=boxes(preview),reading=textRects(target),glyphOffset=reading.length?reading[0]!.y-(target.querySelector('p')??target).getBoundingClientRect().y:-2;
     geometry=new TetradEditGeometry(target,value);target.addClass('is-editing','em-tetrad-edit-target');const overlay=target.createDiv({cls:'em-tetrad-edit-overlay'});
     inline=component.addChild(new TetradInlineEditor(this.app,overlay,value,file,async()=>{throw Error('Test must never save.');},()=>{},false,geometry));await wait(100);
     const editing=inspect(target,inline,glyphOffset),row={name,theme,kind,law,still:name==='Empty'||stable(before,boxes(preview)),dx:reading.length?editing.rects[0]!.x-reading[0]!.x:0,dy:reading.length?editing.rects[0]!.y-reading[0]!.y:0,editing,cases:[] as unknown[]};report.push(row);
     const samples=[value+' '+('More words for further automatic line wrapping. ').repeat(20),('Pasted text that wraps into many diagonal lines. ').repeat(8)+'\n\n'+('Another paragraph with [[Native links]] and **bold text**. ').repeat(5),'X'.repeat(900),'Short',''];if(name==='Empty')samples.push(('A long pasted excerpt with further automatic line wrapping. ').repeat(180));
     for(const text of samples){
      inline.setValue(text);await settle(geometry);row.cases.push({textLength:text.length,...inspect(target,inline,glyphOffset)});
     }
     inline.setValue(('Narrow view of a pasted paragraph. ').repeat(20));host.style.width='420px';await settle(geometry);row.cases.push({width:420,...inspect(target,inline,glyphOffset)});host.style.width='650px';await wait(100);
     component.removeChild(inline);inline=undefined;geometry.destroy();geometry=undefined;target.classList.remove('is-editing','em-tetrad-edit-target');if(name==='Empty')target.remove();await wait(50);
    }
     // Reproduce + exactly: a new, empty row at each insertion position. An
     // existing paragraph cleared later does not cover the initial caret.
     const flow=wing.querySelector<HTMLElement>('.tetrader-line-flow')!;
     for(const before of [...flow.querySelectorAll<HTMLElement>(':scope > .tetrader-gloss'),null]){
      if(flow.querySelector('[data-em-placeholder]'))continue;
      const target=flow.createDiv({cls:'tetrader-gloss is-new'});if(before)before.before(target);
      geometry=new TetradEditGeometry(target,'');target.addClass('is-editing','em-tetrad-edit-target');
      inline=component.addChild(new TetradInlineEditor(this.app,target.createDiv({cls:'em-tetrad-edit-overlay'}),'',file,async()=>{throw Error('Test must never save.');},()=>{},false,geometry));
      await settle(geometry);
      const row={name,theme,kind:'addition',law,still:true,dx:0,dy:0,editing:inspect(target,inline,-2),cases:[] as unknown[]};report.push(row);
      row.cases.push({textLength:0,...inspect(target,inline,-2)});
      inline.setValue('A');await settle(geometry);row.cases.push({textLength:1,...inspect(target,inline,-2)});
      inline.setValue('');await settle(geometry);row.cases.push({textLength:0,...inspect(target,inline,-2)});
      component.removeChild(inline);inline=undefined;geometry.destroy();geometry=undefined;target.remove();await wait(50);
     }
    }
    layout.destroy();layout=undefined;preview.empty();if(await this.app.vault.read(file)!==original)throw Error('Example contents changed.');
   }
   return {report,focusUnchanged:document.activeElement===savedFocus,ownerUnchanged:this.app.workspace.activeEditor===savedOwner};
  }finally{if(inline)component.removeChild(inline);geometry?.destroy();layout?.destroy();component.unload();scope.remove();sheet.remove();}
 }
}
