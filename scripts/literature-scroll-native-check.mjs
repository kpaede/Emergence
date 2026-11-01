import {mkdirSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {evaluate,reloadPlugin} from './obsidian-cli.mjs';
const out=resolve('docs/literature-scroll');mkdirSync(out,{recursive:true});
if(!process.argv.includes('--current'))reloadPlugin();
async function check(OUT){
 const v=app.workspace.getLeavesOfType('emergence-workspace')[0].view,p=v.graphPanel,c=v.controller,w=require('@electron/remote').getCurrentWindow(),wc=w.webContents;
 const previous={body:document.body.className,bg:wc.getBackgroundThrottling(),settings:JSON.stringify(c.settings()),active:c.activePath,focus:document.activeElement},report={cases:[],screenshots:[],errors:[]};
 const wait=ms=>new Promise(r=>window.setTimeout(r,ms));let host,panel;
 const error=e=>report.errors.push(String(e.error??e.reason??e.message));window.addEventListener('error',error);window.addEventListener('unhandledrejection',error);
 try{
  wc.setBackgroundThrottling(false);
  for(const theme of ['light','dark'])for(const width of [280,328])for(const view of ['context','search'])for(const location of ['middle','bottom']){
   document.body.removeClass('theme-light','theme-dark');document.body.addClass('theme-'+theme);
   host=document.body.createDiv({cls:'em-workspace'});host.style.cssText='position:fixed;left:10px;top:10px;width:'+width+'px;height:480px;z-index:99999;background:var(--background-primary)';const target=host.createDiv();
   const settings=JSON.parse(JSON.stringify(c.settings())),snapshot={version:88000,builtAt:0,nodes:[],edges:[],fields:[],rules:{},groups:[],diagnostics:[],unresolved:[],partial:false,breadcrumbsVersion:'synthetic layout only'};
   const node=(id,title)=>({id,title,exists:true,type:'md',aliases:[],tags:[],mtime:0,size:0});snapshot.nodes.push(node('UI focus.md','Kontextprüfung'));
   for(let i=0;i<18;i++){const id='UI link '+i+'.md';snapshot.nodes.push(node(id,'Verweis '+i));snapshot.edges.push({id:'link-'+i,source:'UI focus.md',target:id,field:'',layer:'obsidian',explicit:true,provenance:'synthetic layout only',occurrences:[]});}
   for(let i=0;i<4;i++){const id='zotlit:work:ui-'+i,reference={indexedKey:'UITEST0'+i,citekey:'uiKey'+i,title:'Synthetische Literaturangabe '+i};snapshot.nodes.push({...node(id,reference.title),type:'cited-work',exists:false,citation:{reference,citekey:reference.citekey,state:'noteless',indexedKey:reference.indexedKey}});snapshot.edges.push({id:'citation-'+i,source:'UI focus.md',target:id,field:'zitiert',layer:'zotlit',explicit:true,provenance:'synthetic layout only',occurrences:[],reference});}
   panel=new p.semantic.constructor(target,()=>settings,()=>{throw Error('Unexpected settings write');},{activate:()=>{},inspect:()=>{},literature:()=>{},backlinks:()=>snapshot.nodes.filter(n=>n.type==='md'&&n.id!=='UI focus.md').map(n=>n.id),bibliography:async reference=>({id:reference.indexedKey,content:[{t:'Str',c:'Beispielautor. 2026.'},{t:'Space'},{t:'Emph',c:[{t:'Str',c:reference.title}]},{t:'Str',c:'. Eine längere Literaturangabe für die isolierte Prüfung des Scrollverhaltens. Verlag.'}]})});panel.render(snapshot,'UI focus.md');let scroller=target;if(view==='search'){host.addClass('em-panel-search');host.style.overflowY='auto';target.style.cssText='position:relative;inset:auto;overflow:visible;overflow-anchor:auto;height:auto;';scroller=host;}await wait(120);
   const rows=[...target.querySelectorAll('.em-literature-reference')],row=rows.at(-1),title=row.querySelector('.em-literature-title'),below=target.querySelector('[data-syn-relation=links]');
   // A lower anchor models the browser choosing a following heading instead of the hovered citation.
   if(location==='bottom')for(const section of target.querySelector('.em-syn-diagram').children)if(!section.matches('[data-syn-relation=links],.em-syn-backlinks'))section.style.overflowAnchor='none';
   wc.sendInputEvent({type:'mouseMove',x:1,y:1});previous.focus?.blur();await wait(60);
   scroller.scrollTop=location==='bottom'?scroller.scrollHeight:row.getBoundingClientRect().top-scroller.getBoundingClientRect().top+scroller.scrollTop-160;await wait(100);
   // The row's offset parent is the diagram; keep its final visible line inside the scroller.
   const bounds=row.getBoundingClientRect(),screen=scroller.getBoundingClientRect();if(bounds.bottom<screen.top+16||bounds.top>screen.bottom-16){scroller.scrollTop+=bounds.bottom-screen.bottom+48;await wait(100);}
   const before={scroll:scroller.scrollTop,y:title.getBoundingClientRect().top,below:below.getBoundingClientRect().top,height:row.offsetHeight};
   const r=row.getBoundingClientRect(),container=scroller.getBoundingClientRect();wc.sendInputEvent({type:'mouseMove',x:Math.round(r.left+r.width/2),y:Math.round(Math.max(container.top+8,Math.min(r.bottom-8,r.top+8)))});await wait(120);
   const after={scroll:scroller.scrollTop,y:title.getBoundingClientRect().top,below:below.getBoundingClientRect().top,height:row.offsetHeight},entry={theme,width,view,location,before,after,scrollDelta:after.scroll-before.scroll,titleDelta:after.y-before.y,followingDelta:after.below-before.below,expanded:after.height>before.height};report.cases.push(entry);
   if(location==='bottom'){wc.invalidate();const r=host.getBoundingClientRect(),name=theme+'-'+width+'-'+view+'-'+location+'.png',shot=await w.capturePage({x:Math.round(r.x),y:Math.round(r.y),width:Math.round(r.width),height:Math.round(r.height)});require('fs').writeFileSync(OUT+'/'+name,shot.toPNG());report.screenshots.push(name);}
   wc.sendInputEvent({type:'mouseMove',x:1,y:1});await panel.destroy();panel=undefined;host.remove();host=undefined;
  }
  if(previous.settings!==JSON.stringify(c.settings())||previous.active!==c.activePath)throw Error('User state changed');return report;
 }finally{await panel?.destroy();host?.remove();document.body.className=previous.body;wc.setBackgroundThrottling(previous.bg);if(previous.focus?.isConnected)previous.focus.focus({preventScroll:true});window.removeEventListener('error',error);window.removeEventListener('unhandledrejection',error);}
}
evaluate(`(()=>{window.__emLitScroll={done:false};(${check.toString()})(${JSON.stringify(out)}).then(report=>window.__emLitScroll={done:true,report}).catch(e=>window.__emLitScroll={done:true,failure:e.stack});return true;})()`);
let state;for(let i=0;i<240;i++){state=evaluate('window.__emLitScroll');if(state.done)break;await new Promise(r=>setTimeout(r,100));}const reportName=process.argv.includes('--current')?'before.json':'checks.json';writeFileSync(out+'/'+reportName,JSON.stringify(state,null,2)+'\n');if(!state?.done||state.failure)throw Error(JSON.stringify(state));console.log(JSON.stringify(state.report,null,2));evaluate('delete window.__emLitScroll');
if(!process.argv.includes('--current')&&state.report.cases.some(c=>!c.expanded||Math.abs(c.scrollDelta)>1||Math.abs(c.titleDelta)>1||c.followingDelta<1))throw Error('Hover changed scroll position or preceding content.');
