import {evaluate} from './obsidian-cli.mjs';

/** Measure the first visible hover, without priming layout between dragstart and dragover. */
async function check(){
 const view=app.workspace.getLeavesOfType('emergence-workspace')[0]?.view,p=view?.companionPanel,win=require('electron').remote.getCurrentWindow(),debug=win.webContents.debugger;
 if(!p||p.mode!=='reader'||p.reader.pending||p.native.pending||p.dialogs.size)throw Error('The reader must be idle.');
 if(debug.isAttached())throw Error('A debugger is already attached.');
 const saved={tab:view.tab,activeLeaf:app.workspace.activeLeaf,focus:document.activeElement,background:win.webContents.getBackgroundThrottling(),selection:[...p.reader.selected],focused:p.reader.focused,scroll:p.reader.list.scrollTop},samples=[];
 let tracing=false,trace;
 const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms)),frame=()=>new Promise(resolve=>requestAnimationFrame(resolve));
 const metrics=async()=>Object.fromEntries((await debug.sendCommand('Performance.getMetrics')).metrics.map(item=>[item.name,item.value]));
 const settle=async()=>{await frame();await frame();await wait(80);};
 const finish=async()=>{
  await debug.sendCommand('Input.dispatchDragEvent',{type:'dragCancel',x:0,y:0,data:{items:[],dragOperationsMask:1}}).catch(()=>{});
  await debug.sendCommand('Input.dispatchMouseEvent',{type:'mouseReleased',x:0,y:0,button:'left',buttons:0,clickCount:1}).catch(()=>{});await debug.sendCommand('Input.setInterceptDrags',{enabled:false}).catch(()=>{});document.dispatchEvent(new DragEvent('dragend',{bubbles:true}));await settle();
 };
 try{
  win.webContents.setBackgroundThrottling(false);debug.attach('1.3');await debug.sendCommand('Performance.enable');
  await debug.sendCommand('Tracing.start',{categories:'devtools.timeline,blink.user_timing,disabled-by-default-devtools.timeline.invalidationTracking',transferMode:'ReturnAsStream'});tracing=true;
  for(const condition of ['initial','warm','after-main-editor-focus','after-tab-work']){
   if(condition==='after-main-editor-focus'){const main=app.workspace.getLeavesOfType('markdown').find(leaf=>leaf.view.file?.path===p.document.source);if(main){app.workspace.setActiveLeaf(main,{focus:true});main.view.editor?.focus();await wait(500);}}
   if(condition==='after-tab-work'){view.switchTab('graph');await wait(800);view.switchTab('companion');await p.activate();await wait(800);}
   for(const destination of ['outline','entry']){
    const cards=[...p.reader.list.querySelectorAll('.em-reader-node')],source=cards[0]?.querySelector('.em-reader-grip'),target=destination==='outline'?p.sections.querySelector('[aria-current=true]'):cards[1]??cards[0];if(!source||!target)throw Error('Source or target missing.');
    target.scrollIntoView({block:'nearest'});await settle();const bounds=target.getBoundingClientRect(),x=Math.round(bounds.left+bounds.width*.74),y=Math.round(bounds.top+Math.min(bounds.height*.5,40)),transfer=new DataTransfer();
    let first,dispatchMs,frameMs,secondFrameMs,trusted=false;const startEvents=[];const recordStart=event=>startEvents.push({type:event.type,at:performance.now(),trusted:event.isTrusted});document.addEventListener('pointerdown',recordStart,{capture:true});document.addEventListener('dragstart',recordStart,{capture:true});const hover=event=>{if(first!==undefined)return;first=performance.now();trusted=event.isTrusted;queueMicrotask(()=>{dispatchMs=performance.now()-first;});requestAnimationFrame(()=>{frameMs=performance.now()-first;requestAnimationFrame(()=>{secondFrameMs=performance.now()-first;});});};target.addEventListener('dragover',hover,{capture:true});
    const sourceBounds=source.getBoundingClientRect(),sx=Math.round((sourceBounds.left+sourceBounds.right)/2),sy=Math.round((sourceBounds.top+sourceBounds.bottom)/2);
    const before=await metrics(),name=condition+'-'+destination;performance.mark(name+'-start');const started=performance.now();let startTrusted=false;const dragStarted=event=>{startTrusted=event.isTrusted;};source.addEventListener('dragstart',dragStarted,{once:true});
    await debug.sendCommand('Input.setInterceptDrags',{enabled:true});let intercept;const intercepted=new Promise(resolve=>{intercept=(_event,method,params)=>{if(method==='Input.dragIntercepted')resolve(params.data);};debug.on('message',intercept);});await debug.sendCommand('Input.dispatchMouseEvent',{type:'mouseMoved',x:sx,y:sy});await debug.sendCommand('Input.dispatchMouseEvent',{type:'mousePressed',x:sx,y:sy,button:'left',buttons:1,clickCount:1});for(const offset of [3,9,22])await debug.sendCommand('Input.dispatchMouseEvent',{type:'mouseMoved',x:sx-offset,y:sy+offset,button:'left',buttons:1});
    const data=await Promise.race([intercepted,wait(1000).then(()=>{throw Error('Native drag did not start '+name+' '+JSON.stringify({sx,sy,x,y}));})]);debug.removeListener('message',intercept);source.removeEventListener('dragstart',dragStarted);const startMs=performance.now()-started;await debug.sendCommand('Input.dispatchDragEvent',{type:'dragEnter',x,y,data});await debug.sendCommand('Input.dispatchDragEvent',{type:'dragOver',x,y,data});
    for(let n=0;n<100&&secondFrameMs===undefined;n++)await wait(10);performance.mark(name+'-end');const after=await metrics();target.removeEventListener('dragover',hover,{capture:true});document.removeEventListener('pointerdown',recordStart,{capture:true});document.removeEventListener('dragstart',recordStart,{capture:true});
    samples.push({condition,destination,trusted,startTrusted,startMs,startEvents:startEvents.map(event=>({...event,at:event.at-started})),dispatchMs,frameMs,secondFrameMs,totalMs:performance.now()-started,changes:Object.fromEntries(['LayoutCount','RecalcStyleCount','LayoutDuration','RecalcStyleDuration','ScriptDuration','TaskDuration','Nodes'].map(key=>[key,(after[key]-before[key])*(key.endsWith('Duration')?1000:1)]))});await finish();
   }
  }
  const completion=new Promise(resolve=>{const listener=(_event,method,params)=>{if(method==='Tracing.tracingComplete'){debug.removeListener('message',listener);resolve(params.stream);}};debug.on('message',listener);});await debug.sendCommand('Tracing.end');tracing=false;const handle=await completion;let text='';for(;;){const part=await debug.sendCommand('IO.read',{handle});text+=part.data;if(part.eof)break;}await debug.sendCommand('IO.close',{handle});require('fs').writeFileSync('/tmp/emergence-hover-trace.json',text);trace='/tmp/emergence-hover-trace.json';
  return {samples,tracePath:trace};
 }finally{
  if(debug.isAttached()){await finish().catch(()=>{});if(tracing)await debug.sendCommand('Tracing.end').catch(()=>{});await debug.sendCommand('Performance.disable').catch(()=>{});debug.detach();}
  document.dispatchEvent(new DragEvent('dragend',{bubbles:true}));view.switchTab(saved.tab);p.reader.navigate(saved.focused,false);p.reader.selected=new Set(saved.selection);p.reader.paint();p.reader.list.scrollTop=saved.scroll;win.webContents.setBackgroundThrottling(saved.background);if(saved.activeLeaf)app.workspace.setActiveLeaf(saved.activeLeaf,{focus:false});if(saved.focus?.isConnected)saved.focus.focus({preventScroll:true});
 }
}

evaluate(`(()=>{window.__emCompanionHoverCheck={done:false};(${check.toString()})().then(result=>window.__emCompanionHoverCheck={done:true,result}).catch(error=>window.__emCompanionHoverCheck={done:true,failure:error.stack});return true;})()`);
let state;for(let n=0;n<600;n++){state=evaluate('window.__emCompanionHoverCheck');if(state.done)break;await new Promise(resolve=>setTimeout(resolve,100));}
if(!state?.done||state.failure)throw Error(JSON.stringify(state));
console.log(JSON.stringify(state.result,null,2));evaluate('delete window.__emCompanionHoverCheck');
