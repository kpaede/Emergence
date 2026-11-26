import {evaluate} from './obsidian-cli.mjs';

/** Native external text/HTML dragenter, without a source dragstart or any drop. */
async function check(){
 const p=app.workspace.getLeavesOfType('emergence-workspace')[0]?.view?.companionPanel,debug=require('electron').remote.getCurrentWindow().webContents.debugger;
 if(!p||p.mode!=='reader'||p.reader.pending||p.native.pending||p.draggingEntries)throw Error('The reader must be idle');if(debug.isAttached())throw Error('A debugger is already attached');
 const saved={readerScroll:p.reader.list.scrollTop,outlineScroll:p.sections.scrollTop},checks={},samples=[],wait=ms=>new Promise(resolve=>setTimeout(resolve,ms)),cleanups=new Set();
 const data={items:[{mimeType:'text/plain',data:'External excerpt for hover only'},{mimeType:'text/html',data:'<p>External excerpt for hover only</p>'}],dragOperationsMask:1};
 const cancel=async()=>{await debug.sendCommand('Input.dispatchDragEvent',{type:'dragCancel',x:0,y:0,data});document.dispatchEvent(new DragEvent('dragend',{bubbles:true}));await wait(50);};
 try{
  debug.attach('1.3');
  for(const kind of ['outline','entry','between','end']){
   const slots=[...p.reader.list.querySelectorAll('.em-reader-slot')],target=kind==='outline'?p.sections.querySelector('[aria-current=true]'):kind==='entry'?p.reader.list.querySelector('.em-reader-node'):kind==='between'?slots[0]:slots.at(-1);if(!target)throw Error('Target missing: '+kind);
   target.scrollIntoView({block:'nearest'});await wait(60);const box=target.getBoundingClientRect(),x=Math.round(box.left+box.width*.65),y=Math.round(box.top+(box.height?Math.min(box.height*.5,35):0)),seen={enters:0,overs:0};
   const marked=()=>kind==='outline'?target.classList.contains('is-being-dragged-over'):kind==='entry'?(!!target.dataset.readerDrop||!p.reader.drag.line.hidden):!p.reader.drag.line.hidden;
   const event=e=>{if(e.type==='dragover')seen.overs++;else{seen.enters++;if(seen.firstMarked===undefined){seen.firstMarked=marked();seen.trusted=e.isTrusted;seen.handlerDelayMs=performance.now()-e.timeStamp;}}};target.addEventListener('dragenter',event);target.addEventListener('dragover',event);const cleanup=()=>{target.removeEventListener('dragenter',event);target.removeEventListener('dragover',event);};cleanups.add(cleanup);
   await debug.sendCommand('Input.dispatchDragEvent',{type:'dragEnter',x,y,data});checks[kind+'-markedOnFirstNativeDragenter']=seen.firstMarked===true&&seen.trusted===true;checks[kind+'-noDragoverNeeded']=seen.overs===0;checks[kind+'-externalDragRecognized']=p.draggingEntries;samples.push({kind,...seen});cleanup();cleanups.delete(cleanup);if(!Object.values(checks).every(Boolean))throw Error(JSON.stringify({checks,samples}));await cancel();checks[kind+'-cancelClearsDragState']=!p.draggingEntries;
  }
  return {checks,samples};
 }finally{
  if(debug.isAttached()){await cancel().catch(()=>{});debug.detach();}for(const cleanup of cleanups)cleanup();p.reader.list.scrollTop=saved.readerScroll;p.sections.scrollTop=saved.outlineScroll;
 }
}
evaluate(`(()=>{window.__emExternalHoverCheck={done:false};(${check.toString()})().then(result=>window.__emExternalHoverCheck={done:true,result}).catch(error=>window.__emExternalHoverCheck={done:true,failure:error.stack});return true;})()`);
let state;for(let n=0;n<600;n++){state=evaluate('window.__emExternalHoverCheck');if(state.done)break;await new Promise(resolve=>setTimeout(resolve,100));}if(!state?.done||state.failure)throw Error(JSON.stringify(state));console.log(JSON.stringify(state.result,null,2));evaluate('delete window.__emExternalHoverCheck');
