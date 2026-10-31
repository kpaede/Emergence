import {writeFileSync} from 'node:fs';
import {evaluate} from './obsidian-cli.mjs';
evaluate(`(()=>{const v=app.workspace.getLeavesOfType('emergence-workspace')[0].view,c=v.controller;if(c.abort||c.applyingIdea)throw Error('Eine Benutzeraktion läuft.');window.__emExamplesCheck={done:false};(async()=>{
 const saved={tab:v.tab,state:v.state,history:JSON.stringify(c.inquiryHistory),settings:JSON.stringify(c.settings()),review:JSON.stringify(c.review.analysis),files:app.vault.getFiles().length};
 const probe=new c.constructor(app,()=>JSON.parse(saved.settings),async()=>{},[],async()=>{});probe.activePath='Fixture/Ontologie.md';probe.captureActive=()=>{probe.activePath='Fixture/Ontologie.md';probe.selection='';};probe.graph.snapshot=c.graph.snapshot;
 let off;const started=performance.now();
 try{
  await probe.inquire('Nenne konkrete Kunstwerke, die beim Nachdenken über Ontologie helfen.','none',[],{},false,{kind:'artworks',field:'Beispiel',webSearch:{enabled:true,term:'Ontologie',goal:'artworks'}});
  const entry=probe.inquiryHistory[0];if(!entry.examples?.length)throw Error('Keine konkreten Beispiele.');
  const calls=[];probe.addSynopsisLink=async(...args)=>{calls.push(args);};
  v.controller=probe;v.state=JSON.parse(JSON.stringify(saved.state));Object.assign(v.state.inquiry,{kind:'artworks',field:'Beispiel',webSearch:true,webTerm:'Ontologie',webSource:c.activePath,webGoal:'artworks'});off=probe.subscribe(()=>v.update(true));v.switchTab('inquiry');
  const panel=v.panels.get('inquiry'),before=panel.querySelectorAll('[data-research-idea]').length,accept=panel.querySelector('[data-research-idea] button[aria-label="Beispiel übernehmen"]');
  if(!accept||accept.disabled)throw Error('Beispiel nicht übernehmbar.');accept.click();for(let i=0;i<40&&calls.length===0;i++)await new Promise(r=>setTimeout(r,20));await new Promise(r=>setTimeout(r,50));
  const after=v.panels.get('inquiry').querySelectorAll('[data-research-idea]').length;
  const report={searchStatus:entry.webSearch?.status,searchPages:entry.webSearch?.pages,searchResults:entry.webSearch?.sources.length,examples:entry.examples.map(i=>({title:i.title,sourceIds:i.sourceIds,creator:i.creator,artForm:i.artForm})),compactRows:before===entry.examples.length,noEssay:!panel.querySelector('.em-answer'),oneClickTransfer:calls.length===1&&calls[0][1]==='Beispiel'&&after===before-1,analysisUnchanged:JSON.stringify(c.review.analysis)===saved.review,userHistoryUnchanged:JSON.stringify(c.inquiryHistory)===saved.history,userSettingsUnchanged:JSON.stringify(c.settings())===saved.settings,noFilesCreated:app.vault.getFiles().length===saved.files,notesWritten:0,elapsedMs:Math.round(performance.now()-started)};
  for(const key of ['compactRows','noEssay','oneClickTransfer','analysisUnchanged','userHistoryUnchanged','userSettingsUnchanged','noFilesCreated'])if(!report[key])throw Error(JSON.stringify(report));
  window.__emExamplesCheck={done:true,report};
 }finally{off?.();probe.dispose();v.controller=c;v.state=saved.state;v.switchTab(saved.tab);c.notify();}
})().catch(e=>window.__emExamplesCheck={done:true,failure:String(e),stack:e.stack});return true;})()`);
let result;for(let i=0;i<500;i++){result=evaluate('window.__emExamplesCheck');if(result.done)break;await new Promise(r=>setTimeout(r,100));}
if(!result?.done||result.failure)throw Error(JSON.stringify(result));writeFileSync('docs/research-examples-native-check.json',JSON.stringify(result.report,null,2)+'\n');console.log(JSON.stringify(result.report,null,2));evaluate('delete window.__emExamplesCheck');
