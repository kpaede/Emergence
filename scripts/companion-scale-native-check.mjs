import {writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {command,evaluate,reloadPlugin} from './obsidian-cli.mjs';
if(command('vault',['info=path'])!==resolve('../../..'))throw Error('Wrong vault.');
reloadPlugin();
async function check(){
 const plugin=app.plugins.plugins.emergence,v=app.workspace.getLeavesOfType('emergence-workspace')[0].view,p=v.companionPanel,c=v.controller,service=plugin.companionService,wc=require('electron').remote.getCurrentWindow().webContents;
 const saved={tab:v.tab,active:c.activePath,leaf:app.workspace.activeLeaf,path:p.path,sourcePath:p.sourcePath,selected:p.selected,pinned:p.pinned,followCursor:p.followCursor,settings:JSON.stringify(plugin.settings),files:app.vault.getFiles().length,background:wc.getBackgroundThrottling()};
 const root='Emergence scale audit '+Date.now(),checks={},metrics={},wait=ms=>new Promise(resolve=>setTimeout(resolve,ms)),assert=(name,value)=>{checks[name]=!!value;if(!value)throw Error(name);};
 const until=async fn=>{for(let i=0;i<800;i++){if(fn())return;await wait(25);}throw Error('Scale audit timeout');};let leaf,timer;
 try{
  wc.setBackgroundThrottling(false);await app.vault.createFolder(root);const original='# Chapter with 300 thoughts\n\nThis source remains unchanged.\n',main=await app.vault.create(root+'/Source.md',original);leaf=app.workspace.getLeaf('tab');await leaf.openFile(main);await wait(100);c.activePath=main.path;
  const path=await service.create(main.path,{mode:'document',location:'folder',folder:root}),doc=await service.read(path),section=doc.sections[0].id,stack=[],operations=[];
  for(let i=0;i<300;i++){
   const depth=i%6,id='scale-'+i,target=depth?stack[depth-1]:undefined;stack[depth]=id;stack.length=depth+1;
   const text='Thought '+i+': '+(i%5===0?'A long philosophical excerpt with a distinction requiring careful attention. '.repeat(40):'A nested supporting reason requiring further investigation.')+'\n\nA separate paragraph.\n\n- An internal list item\n- Another internal list item\n\n> A quoted passage.';
   operations.push({kind:'add',section,id,target,text,placement:'last'});
  }
  let started=performance.now();await service.executeMany(path,operations);metrics.populateMs=Math.round(performance.now()-started);const before=(await service.read(path)).sections[0].raw;metrics.sectionCharacters=before.length;
  let last=performance.now(),worst=0;timer=setInterval(()=>{const now=performance.now();worst=Math.max(worst,now-last-20);last=now;},20);
  for(const kind of ['eome','lineage']){
   await p.native.close();service.setViewMode(path,kind);Object.assign(p,{path,sourcePath:main.path,selected:section,pinned:true,followCursor:false});started=performance.now();worst=0;last=started;v.switchTab('companion');await p.refresh(true);
   await until(()=>kind==='eome'?p.native.view?.cy?.nodes().length===300:Object.keys(p.native.view?.documentStore?.getValue()?.document?.content??{}).length>=300);await wait(300);
   metrics[kind]={openMs:Math.round(performance.now()-started),maxHeartbeatDelayMs:Math.round(worst),renderedCards:p.nativeHost.querySelectorAll('.lineage-card,.mindmap-node-content').length};
   assert(kind+'PreservesAllThoughtText',(await service.read(path)).sections[0].raw===before);await p.native.flush();assert(kind+'FlushPreservesAllThoughtText',(await service.read(path)).sections[0].raw===before);
  }
  assert('mainDocumentUnchanged',await app.vault.read(main)===original);assert('userSettingsUnchanged',JSON.stringify(plugin.settings)===saved.settings);return {checks,metrics,thoughts:300,nestingLevels:6,modelCalls:0};
 }finally{
  if(timer)clearInterval(timer);await p.native.close();if(leaf){await leaf.view.save?.();leaf.detach();}const folder=app.vault.getAbstractFileByPath(root);if(folder)await app.vault.delete(folder,true);Object.assign(p,{path:saved.path,sourcePath:saved.sourcePath,selected:saved.selected,pinned:saved.pinned,followCursor:saved.followCursor});c.activePath=saved.active;v.switchTab(saved.tab);if(saved.leaf)app.workspace.setActiveLeaf(saved.leaf,{focus:false});await plugin.saveSettings();wc.setBackgroundThrottling(saved.background);assert('fixtureCleanup',app.vault.getFiles().length===saved.files);
 }
}
evaluate(`(()=>{window.__emCompanionScaleCheck={done:false};(${check.toString()})().then(report=>window.__emCompanionScaleCheck={done:true,report}).catch(error=>window.__emCompanionScaleCheck={done:true,failure:error.stack});return true;})()`);
let result;for(let i=0;i<1800;i++){result=evaluate('window.__emCompanionScaleCheck');if(result.done)break;await new Promise(resolve=>setTimeout(resolve,100));}if(!result?.done||result.failure)throw Error(JSON.stringify(result));writeFileSync('/tmp/emergence-companion-scale-audit.json',JSON.stringify(result.report,null,2));console.log(JSON.stringify(result.report,null,2));evaluate('delete window.__emCompanionScaleCheck');
