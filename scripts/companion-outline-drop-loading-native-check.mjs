import {evaluate} from './obsidian-cli.mjs';

/** Isolated real-vault fixture; does not switch the user's tab, editor or settings. */
async function check(){
 const plugin=app.plugins.plugins.emergence,user=app.workspace.getLeavesOfType('emergence-workspace')[0].view.companionPanel,settings=structuredClone(plugin.settings),root='Emergence outline loading check '+Date.now(),host=user.root.parentElement.createDiv(),checks={},samples=[];
 host.style.cssText='position:fixed;left:-10000px;top:0;width:690px;height:800px;pointer-events:none;';
 let service,panel;const assert=(name,value)=>{checks[name]=!!value;if(!value)throw Error(name);};
 try{
  await app.vault.createFolder(root);const source=await app.vault.create(root+'/Main.md',Array.from({length:38},(_,i)=>'# Heading '+i+'\n'+'Source text. '.repeat(1200)+'\n').join(''));
  service=new plugin.companionService.constructor(app,{},()=>settings,async()=>{});service.load();const path=await service.create(source.path,{mode:'sections',location:'beside',folder:''}),doc=await service.readForView(path),first=doc.sections[0].id,second=doc.sections[1].id;
  const saved=service.snapshot();service.unload();service=new plugin.companionService.constructor(app,saved,()=>settings,async()=>{});service.load();
  panel=new user.constructor(app,host,service,()=>source.path,user.ownerLeaf);panel.load();Object.assign(panel,{path,selected:first,pinned:true,followCursor:false});panel.setVisible(true);const start=performance.now();await panel.refresh(true);for(let n=0;n<15;n++)await Promise.resolve();const initialPrepareMs=performance.now()-start;
  assert('allHeadingsAvailable',panel.sections.querySelectorAll('[data-em-section]').length===38);assert('outlineNotHidden',!panel.splitHost.hidden);assert('readerReady',panel.reader.isShowing(path,first));
  const sourceBefore=await app.vault.read(source);await service.sync(path);
  for(const mode of ['off','subtree']){
   settings.companion={...settings.companion,outlineSizes:mode};panel.refreshOutlineSizes();const row=panel.sections.querySelector('[data-em-section="'+second+'"]'),transfer=new DataTransfer(),text='External quotation '+mode+'.\n\nA second paragraph with [[a link]].';transfer.setData('text/plain',text);transfer.setData('text/html','<p>External quotation</p>');const before={...service.metrics},at=performance.now();row.dispatchEvent(new DragEvent('dragenter',{bubbles:true,cancelable:true,dataTransfer:transfer}));const hoverMs=performance.now()-at;if(!row.classList.contains('is-being-dragged-over'))throw Error(JSON.stringify({mode,checks,row:row.outerHTML,issue:panel.document.unavailableFiles?.[second],loaded:panel.navigation.lifecycle?._loaded,types:transfer.types}));assert(mode+'-marksExternalDropImmediately',true);
   const dropped=performance.now();row.dispatchEvent(new DragEvent('drop',{bubbles:true,cancelable:true,dataTransfer:transfer}));await panel.navigation.flush();for(let n=0;n<15;n++)await Promise.resolve();const dropMs=performance.now()-dropped;
   assert(mode+'-savedTextVisible',panel.document.sections.find(s=>s.id===second).raw.includes('External quotation '+mode));assert(mode+'-stableOutlineRow',panel.sections.querySelector('[data-em-section="'+second+'"]')===row);assert(mode+'-noSavingMessage',!panel.root.querySelector('.em-reader-drop-saving,.em-companion-drop-status'));assert(mode+'-singleFreshBundleRead',service.metrics.readCalls-before.readCalls===1);
   samples.push({mode,hoverMs,dropMs,...Object.fromEntries(['readCalls','readMs','planMs','transactionMs','commitReadMs','sourceAnalyses','characterScans'].map(key=>[key,service.metrics[key]-before[key]]))});
  }
  assert('mainDocumentUnchanged',await app.vault.read(source)===sourceBefore);return {checks,initialPrepareMs,sourceCharacters:sourceBefore.length,samples,visibility:document.visibilityState};
 }finally{
  if(panel){await panel.shutdown().catch(()=>{});panel.unload();}if(service)service.unload();host.remove();const folder=app.vault.getAbstractFileByPath(root);if(folder)await app.vault.delete(folder,true);
 }
}
evaluate(`(()=>{window.__emOutlineLoadingCheck={done:false};(${check.toString()})().then(result=>window.__emOutlineLoadingCheck={done:true,result}).catch(error=>window.__emOutlineLoadingCheck={done:true,failure:error.stack});return true;})()`);
let state;for(let n=0;n<600;n++){state=evaluate('window.__emOutlineLoadingCheck');if(state.done)break;await new Promise(resolve=>setTimeout(resolve,100));}if(!state?.done||state.failure)throw Error(JSON.stringify(state));console.log(JSON.stringify(state.result,null,2));evaluate('delete window.__emOutlineLoadingCheck');
