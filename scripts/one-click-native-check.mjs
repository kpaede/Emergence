import {writeFileSync} from 'node:fs';
import {evaluate} from './obsidian-cli.mjs';

// Actual append/undo in one disposable source note, with an independent controller and in-memory journal.
const code=`(()=>{window.__emOneClickTest={done:false};(async()=>{
 const main=app.plugins.plugins.emergence.controller, savedSettings=JSON.stringify(main.settings());
 const root=app.workspace.getMostRecentLeaf(app.workspace.rootSplit), originalPath=root?.view?.file?.path;
 const id=crypto.randomUUID(), path='Emergence test '+id+'.md', targetA='Emergence absent folder '+id+'/Emergence target '+id+' A.md', targetB='Emergence absent folder '+id+'/Emergence target '+id+' B.md';
 const field=main.graph.snapshot.fields.find(f=>main.graph.snapshot.rules[f]?.writable&&main.graph.snapshot.rules[f]?.description);if(!field)throw Error('Kein beschreibbares Feld');
 let file,leaf,probe;
 try {
  file=await app.vault.create(path,'---\\n'+field+':\\nmarker: stable\\n---\\nEMERGENCE-ONE-CLICK-TEST\\n');
  leaf=app.workspace.getLeaf('tab');await leaf.openFile(file,{active:false,state:{mode:'source'}});
  if(app.workspace.getMostRecentLeaf(app.workspace.rootSplit)===leaf&&root)app.workspace.setActiveLeaf(root,{focus:false});
  const view=leaf.view;view.editor.replaceRange('Eigener noch ungespeicherter Absatz.\\n',view.editor.offsetToPos(view.editor.getValue().length));
  probe=new main.constructor(app,()=>JSON.parse(savedSettings),async()=>{},[],async()=>{});probe.activePath=path;await probe.graph.refreshBreadcrumbs(path);
  const title=file.basename,analysisId=crypto.randomUUID(),base={analysisId,source:path,sourceVersion:'initial',operation:'add',field,property:field,reason:'',evidence:title,evidenceSource:'title',confidence:'medium',status:'pending',outputId:probe.profile.outputs.find(o=>o.kind==='relations').id,contract:'breadcrumbs-v2',targetKind:'unresolved'};
  probe.review.set({id:analysisId,source:path,sourceVersion:'initial',fields:[field],perField:4,status:'complete',completed:1,total:1,errors:[],candidates:[],artifacts:[],suggestions:[{...base,id:'A',target:targetA,value:'[['+targetA.split('/').at(-1).replace(/\\.md$/,'')+']]'}, {...base,id:'B',target:targetB,value:'[['+targetB.split('/').at(-1).replace(/\\.md$/,'')+']]'}]});
  await probe.applyIdea('A');const first=probe.lastIdeaEntry;
  const afterFirst=await app.vault.read(file);if(afterFirst.includes('[[Emergence absent folder')||!afterFirst.includes('[['+targetA.split('/').at(-1).replace(/\\.md$/,'')+']]'))throw Error('Link wurde nicht auf den kurzen Titel reduziert');if(!afterFirst.includes('Eigener noch ungespeicherter Absatz.')||probe.review.analysis.suggestions.length!==1)throw Error('Erste Übernahme verlor Editorinhalt oder weitere Idee');
  await probe.applyIdea('B');
  const afterSecond=await app.vault.read(file);if(!afterSecond.includes(targetA.split('/').at(-1).replace(/\\.md$/,''))||!afterSecond.includes(targetB.split('/').at(-1).replace(/\\.md$/,'')))throw Error('Zweite Übernahme verlor den ersten Link');
  view.editor.setValue(view.editor.getValue().replace('marker: stable','marker: edited')+'Späterer eigener Absatz.\\n');
  await probe.undoIdea(first);
  const afterUndo=await app.vault.read(file);if(afterUndo.includes(targetA.split('/').at(-1).replace(/\\.md$/,''))||!afterUndo.includes(targetB.split('/').at(-1).replace(/\\.md$/,''))||!afterUndo.includes('marker: edited')||!afterUndo.includes('Späterer eigener Absatz.'))throw Error('Rücknahme veränderte fremde Inhalte');
  if(app.vault.getFileByPath(targetA)||app.vault.getFileByPath(targetB))throw Error('Zieldatei wurde angelegt');
  window.__emOneClickTest={done:false,report:{temporarySource:true,shortLinksForNestedTargets:true,firstApplyPreservedUnsavedBody:true,secondApplyKeptFirstLink:true,undoRemovedOnlyItsLink:true,laterBodyAndPropertyEditsPreserved:true,targetFilesCreated:0,userNotesWritten:0,settingsUnchanged:savedSettings===JSON.stringify(main.settings()),mainNoteUnchanged:root?.view?.file?.path===originalPath}};
 }finally{
  probe?.dispose();leaf?.detach();
  if(file&&app.vault.getFileByPath(path)){const text=await app.vault.read(file);if(text.includes('EMERGENCE-ONE-CLICK-TEST'))await app.vault.delete(file);}
  await main.graph.refreshBreadcrumbs();
  if(window.__emOneClickTest.report)window.__emOneClickTest.done=true;
 }
})().catch(e=>window.__emOneClickTest={done:true,error:String(e),stack:e.stack});return true;})()`;
evaluate(code);
let finished=false;
for(let i=0;i<180;i++){
 const state=evaluate('window.__emOneClickTest');if(!state.done)continue;
 if(state.error)throw Error(state.error+'\n'+state.stack);
 writeFileSync('docs/one-click-native-check.json',JSON.stringify(state.report,null,2)+'\n');console.log(JSON.stringify(state.report,null,2));finished=true;break;
}
if(!finished)throw Error('Native one-click check did not finish');
