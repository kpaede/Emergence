import {writeFileSync} from 'node:fs';
import {evaluate} from './obsidian-cli.mjs';
// Render 4 ideas per current field with an isolated controller. All write actions are mocks.
const report=evaluate(`(()=>{const v=app.workspace.getLeavesOfType('emergence-workspace')[0].view,original=v.controller;
 if(original.abort||original.applyingIdea)throw Error('Eine Benutzeraktion läuft');
 const previous={state:v.state,tab:v.tab},settings=JSON.parse(JSON.stringify(original.settings())),test=new original.constructor(app,()=>settings,async()=>{},[],async()=>{});
 test.graph.snapshot=JSON.parse(JSON.stringify(original.graph.snapshot));test.activePath=original.activePath;
 let applies=0,undos=0;test.applyIdea=async()=>{applies++;};test.undoIdea=async()=>{undos++;};
 const fields=test.analysisFields,title=test.graph.snapshot.nodes.find(n=>n.id===test.activePath).title,id=crypto.randomUUID();
 const suggestions=fields.flatMap((field,i)=>Array.from({length:4},(_,j)=>({id:'ui-'+i+'-'+j,analysisId:id,source:test.activePath,sourceVersion:'ui-only',operation:'add',target:'UI-Idee '+i+' '+j+'.md',targetKind:'unresolved',field,property:field,value:'[[UI-Idee '+i+' '+j+']]',reason:'',evidence:title,evidenceSource:'title',confidence:'medium',status:'pending',outputId:test.profile.outputs.find(o=>o.kind==='relations').id,contract:'breadcrumbs-v2'})));
 test.review.set({id,source:test.activePath,sourceVersion:'ui-only',fields,perField:4,suggestions,candidates:[],artifacts:[],completed:1,total:1,status:'complete',errors:[]});
 let off;
 try{
  v.controller=test;v.state=JSON.parse(JSON.stringify(previous.state));off=test.subscribe(()=>v.update(true));v.switchTab('analysis');v.update(true);
  let panel=v.contentEl.querySelector('.em-panel-analysis');const rows=panel.querySelectorAll('.em-idea-row').length,groups=panel.querySelectorAll('.em-idea-group').length;
  const accept=panel.querySelector('.em-idea-accept');if(!accept||accept.disabled)throw Error('Übernehmen nicht erreichbar');accept.click();
  const reject=[...panel.querySelectorAll('.em-idea-row button')].find(b=>b.getAttribute('aria-label')?.startsWith('Ablehnen:'));reject.click();
  panel=v.contentEl.querySelector('.em-panel-analysis');const remaining=panel.querySelectorAll('.em-idea-row').length;
  test.writer.journal.push({id:'ui-journal',path:test.activePath,time:Date.now(),beforeHash:'',afterHash:'',beforeFrontmatter:'',afterFrontmatter:'',status:'applied',changes:[{property:fields[0],target:'UI-Idee.md'}]});v.update(true);
  panel=v.contentEl.querySelector('.em-panel-analysis');[...panel.querySelectorAll('button')].find(b=>b.textContent==='Rückgängig').click();
  const result={fields:fields.length,ideas:rows,fourPerField:rows===fields.length*4,groupsMatchFields:groups===fields.length,acceptReached:applies===1,rejectRemovedOne:remaining===rows-1,undoReached:undos===1,width:panel.clientWidth,scrollWidth:panel.scrollWidth,userSettingsUnchanged:JSON.stringify(original.settings())===JSON.stringify(settings),notesWritten:0};
  if(!result.fourPerField||!result.groupsMatchFields||!result.acceptReached||!result.rejectRemovedOne||!result.undoReached||result.scrollWidth>result.width+1)throw Error(JSON.stringify(result));return result;
 }finally{off?.();test.dispose();v.controller=original;v.state=previous.state;v.switchTab(previous.tab);v.update(true);}
})()`);
writeFileSync('docs/compact-ideas-ui-check.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
