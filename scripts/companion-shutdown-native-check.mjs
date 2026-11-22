import {resolve} from 'node:path';
import {writeFileSync} from 'node:fs';
import {command,evaluate,reloadPlugin} from './obsidian-cli.mjs';
if(command('vault',['info=path'])!==resolve('../../..'))throw Error('Wrong vault.');
reloadPlugin();
async function check(){
 const plugin=app.plugins.plugins.emergence,v=app.workspace.getLeavesOfType('emergence-workspace')[0].view,c=v.controller,p=v.companionPanel,service=plugin.companionService,wc=require('electron').remote.getCurrentWindow().webContents;
 const saved={tab:v.tab,active:c.activePath,selection:c.selection,leaf:app.workspace.activeLeaf,files:app.vault.getFiles().length,path:p.path,sourcePath:p.sourcePath,selected:p.selected,pinned:p.pinned,follow:p.followCursor,settings:JSON.stringify(plugin.settings),background:wc.getBackgroundThrottling()};
 const root='Emergence shutdown check '+Date.now(),checks={},wait=ms=>new Promise(resolve=>setTimeout(resolve,ms)),assert=(name,value)=>{checks[name]=!!value;if(!value)throw Error(name);};
 const until=async fn=>{for(let i=0;i<400;i++){if(await fn())return;await wait(25);}throw Error('Shutdown check timeout');};let leaf;
 try{
  wc.setBackgroundThrottling(false);await app.vault.createFolder(root);const original='# A\n\nUnchanged source.\n',main=await app.vault.create(root+'/Source.md',original);leaf=app.workspace.getLeaf('tab');await leaf.openFile(main);await wait(100);c.activePath=main.path;
  const path=await service.create(main.path,{mode:'document',location:'folder',folder:root}),section=(await service.read(path)).sections[0].id;
  await service.executeMany(path,[{kind:'add',section,id:'shutdown-first',text:'Original thought',placement:'last'},{kind:'add',section,id:'shutdown-child',target:'shutdown-first',text:'Protected nested thought',placement:'last'}]);const before=(await service.read(path)).sections[0].raw;
  Object.assign(p,{path,sourcePath:main.path,selected:section,pinned:true,followCursor:false});v.switchTab('companion');
  for(const kind of ['eome','lineage']){
   service.setViewMode(path,kind);await p.refresh(true);await until(()=>kind==='eome'?p.native.view?.cy?.nodes().length===2:p.nativeHost.querySelectorAll('.lineage-card').length===2);const native=p.native.view,stale={app:native.app,file:native.file},pending='Unsaved '+kind+' text\n\n- A list within the thought\n\nFinal paragraph.';
   if(kind==='eome'){native.selectNode(native.getFlatNodes()[0].line);native.wrapper.focus();native.wrapper.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',code:'Enter',bubbles:true,cancelable:true}));await until(()=>p.native.editing);native.app.workspace.activeEditor.editor.setValue(pending);p.native.finishEditor=()=>{throw Error('Injected failure while finishing the fixture editor');};}
   else{const element=p.nativeHost.querySelector('.lineage-view');element.focus();element.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',code:'Enter',bubbles:true,cancelable:true}));await until(()=>p.native.editing);await native.inlineEditor.mounting;native.inlineEditor.getEditor().setValue(pending);native.inlineEditor.unloadNode=()=>{throw Error('Injected failure while finishing the fixture editor');};}
   let failure=false;try{await p.shutdown();}catch{failure=true;}assert(kind+'ReportsShutdownFailure',failure);
   assert(kind+'DisposesOriginalEditor',!native._loaded&&!p.native.view&&!p.nativeHost.childElementCount);assert(kind+'NoRecoveredCopies',!('nativeDrafts'in service.snapshot()));
   const persisted=(await plugin.loadData()).companion;assert(kind+'NoPersistedCopies',!('nativeDrafts'in persisted)&&!('drafts'in persisted));
   let rejected=false;try{await stale.app.vault.modify(stale.file,'Stale callback');}catch{rejected=true;}assert(kind+'RejectsRetiredWrites',rejected);await native.saveDocument?.();await native.save();assert(kind+'LeavesCompanionUnchanged',(await service.read(path)).sections[0].raw===before);

  }
  assert('mainDocumentUnchanged',await app.vault.read(main)===original);assert('settingsUnchanged',JSON.stringify(plugin.settings)===saved.settings);return {checks,count:Object.keys(checks).length,modelCalls:0};
 }finally{
  await p.shutdown().catch(()=>{});if(leaf){await leaf.view.save?.();leaf.detach();}const folder=app.vault.getAbstractFileByPath(root);if(folder)await app.vault.delete(folder,true);Object.assign(p,{path:saved.path,sourcePath:saved.sourcePath,selected:saved.selected,pinned:saved.pinned,followCursor:saved.follow});c.activePath=saved.active;c.selection=saved.selection;v.switchTab(saved.tab);if(saved.leaf)app.workspace.setActiveLeaf(saved.leaf,{focus:false});await plugin.saveSettings();wc.setBackgroundThrottling(saved.background);assert('fixtureCleanup',app.vault.getFiles().length===saved.files);
 }
}
evaluate(`(()=>{window.__emCompanionCheck={done:false};(${check.toString()})().then(report=>window.__emCompanionCheck={done:true,report}).catch(error=>window.__emCompanionCheck={done:true,failure:error.stack});return true;})()`);
let result;for(let i=0;i<1000;i++){result=evaluate('window.__emCompanionCheck');if(result.done)break;await new Promise(resolve=>setTimeout(resolve,100));}if(!result?.done||result.failure)throw Error(JSON.stringify(result));result.report.count=Object.keys(result.report.checks).length;writeFileSync('/tmp/emergence-shutdown-check.json',JSON.stringify(result.report,null,2));console.log(JSON.stringify(result.report,null,2));evaluate('delete window.__emCompanionCheck');
