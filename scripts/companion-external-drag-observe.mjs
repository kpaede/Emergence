import {evaluate} from './obsidian-cli.mjs';

/** Temporary, passive timing capture for an actual drag from Zotero or another application. */
function install(){
 window.__emExternalDragProbe?.stop();
 const view=app.workspace.getLeavesOfType('emergence-workspace')[0]?.view,p=view?.companionPanel,service=app.plugins.plugins.emergence?.companionService;if(!p||!service)throw Error('Companion unavailable');
 const state={active:true,samples:[],longFrames:[],mutations:0},doc=p.root.ownerDocument,win=doc.defaultView,frames=new Set(),marks=[];let lastRegion='',lastAt=-1000,lastDrag=-1000,lastDrop;
 const mutation=new MutationObserver(records=>{state.mutations+=records.length;});mutation.observe(p.root,{attributes:true,childList:true,subtree:true});
 const counters=()=>({reads:service.metrics.readCalls,sourceAnalyses:service.metrics.sourceAnalyses,characterScans:service.metrics.characterScans,mutations:state.mutations});
 const frame=fn=>{const id=win.requestAnimationFrame(()=>{frames.delete(id);fn();});frames.add(id);};
 const hover=event=>{
  const element=event.target instanceof Element?event.target:undefined,region=element?.closest('.em-companion')?element.closest('[data-em-section]')?'outline':element.closest('.em-reader-node,.mindmap-overlay,.lineage-view')?'entries':'companion':element?.closest('.markdown-source-view,.markdown-preview-view')?'main':undefined,at=performance.now();if(!region)return;lastDrag=at;if(region===lastRegion&&at-lastAt<400)return;lastRegion=region;lastAt=at;if(state.samples.length>=80)return;
  const before=counters(),sample={at,region,mode:p.mode,trusted:event.isTrusted,event:event.type,deliveryMs:Math.max(0,at-event.timeStamp),types:[...(event.dataTransfer?.types??[])],typeReadMs:performance.now()-at,draggingBefore:p.draggingEntries};state.samples.push(sample);const mark='em-zotero:'+region+':'+event.type+':'+state.samples.length;performance.mark(mark);marks.push(mark);if(event.type==='drop')lastDrop={sample,writes:service.metrics.writes,metrics:{...service.metrics}};
  queueMicrotask(()=>{sample.handlersMs=performance.now()-at;sample.draggingAfter=p.draggingEntries;});frame(()=>{sample.firstFrameMs=performance.now()-at;sample.draggingAtFrame=p.draggingEntries;frame(()=>{sample.secondFrameMs=performance.now()-at;sample.work=Object.fromEntries(Object.entries(counters()).map(([key,value])=>[key,value-before[key]]));});});
 };
 const end=()=>{lastRegion='';},drop=event=>{lastRegion='';hover(event);};doc.addEventListener('dragenter',hover,{capture:true});doc.addEventListener('dragover',hover,{capture:true});doc.addEventListener('dragend',end,{capture:true});doc.addEventListener('drop',drop,{capture:true});
 const unsubscribe=service.subscribe(()=>{if(lastDrop&&service.metrics.writes>lastDrop.writes){lastDrop.sample.savedAfterMs=performance.now()-lastDrop.sample.at;lastDrop.sample.saveWork=Object.fromEntries(['readMs','planMs','transactionMs','commitReadMs','sourceAnalyses'].map(key=>[key,service.metrics[key]-lastDrop.metrics[key]]));lastDrop=undefined;}});
 const observer=PerformanceObserver.supportedEntryTypes.includes('long-animation-frame')?new PerformanceObserver(list=>{if(performance.now()-lastDrag>10000)return;for(const entry of list.getEntries()){if(state.longFrames.length>=80)break;state.longFrames.push({at:entry.startTime,durationMs:entry.duration,blockingMs:entry.blockingDuration,styleStart:entry.styleAndLayoutStart,scripts:entry.scripts?.map(script=>({name:script.sourceFunctionName,url:script.sourceURL,durationMs:script.duration,forcedLayoutMs:script.forcedStyleAndLayoutDuration,invoker:script.invoker})).sort((a,b)=>b.durationMs-a.durationMs).slice(0,6)});}}):undefined;observer?.observe({type:'long-animation-frame'});
 const stop=()=>{state.active=false;doc.removeEventListener('dragenter',hover,{capture:true});doc.removeEventListener('dragover',hover,{capture:true});doc.removeEventListener('dragend',end,{capture:true});doc.removeEventListener('drop',drop,{capture:true});unsubscribe();mutation.disconnect();observer?.disconnect();for(const id of frames)win.cancelAnimationFrame(id);frames.clear();for(const mark of marks)performance.clearMarks(mark);};
 window.__emExternalDragProbe={state,stop};return {active:true,longFramesSupported:!!observer};
}
const action=process.argv[2]??'status';
if(action==='start')console.log(JSON.stringify(evaluate(`(${install.toString()})()`)));
else if(action==='stop')console.log(JSON.stringify(evaluate('(()=>{const probe=window.__emExternalDragProbe;probe?.stop();const state=probe?.state;delete window.__emExternalDragProbe;return state;})()'),null,2));
else console.log(JSON.stringify(evaluate('window.__emExternalDragProbe?.state'),null,2));
