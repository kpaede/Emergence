import {writeFileSync} from 'node:fs';
import {evaluate} from './obsidian-cli.mjs';
async function check(){
 const v=app.workspace.getLeavesOfType('emergence-workspace')[0].view,main=v.controller;
 if(main.abort||main.applyingIdea)throw Error('Eine Benutzeraktion läuft.');
 const saved={state:v.state,tab:v.tab,settings:JSON.stringify(main.settings()),history:JSON.stringify(main.inquiryHistory)};
 const probe=new main.constructor(app,()=>JSON.parse(saved.settings),async()=>{},[],async()=>{});
 probe.graph.snapshot=JSON.parse(JSON.stringify(main.graph.snapshot));probe.activePath='Release A.md';probe.captureActive=()=>{};
 probe.inquiryHistory=[{source:'Release A.md',prompt:'OLD A',answer:'OLD A answer',context:'none'},{source:'Release B.md',prompt:'OLD B',answer:'OLD B answer',context:'none'}];
 const requests=[],queries=[],report={};let task,finish;
 probe.provider.chat=async options=>{requests.push(options.messages);return finish==='wait'?new Promise(resolve=>{finish=resolve;}):'Current answer '+requests.length;};
 probe.wikipedia={lookup:async query=>{queries.push(query);return {query,status:'empty',sources:[],fetchedAt:new Date().toISOString()};}};
 const inquire=probe.inquire.bind(probe);probe.inquire=(...args)=>{task=inquire(...args);return task;};
 const panel=()=>v.contentEl.querySelector('.em-panel-inquiry'),question=()=>panel().querySelector('[data-em-focus="Deine Frage"]');
 const ask=async text=>{const input=question();input.value=text;input.dispatchEvent(new input.ownerDocument.defaultView.Event('input',{bubbles:true}));[...panel().querySelectorAll('button')].find(b=>b.textContent==='Frage senden').click();await task;v.update(true);};
 let off;
 try{
  v.controller=probe;v.state=JSON.parse(JSON.stringify(saved.state));v.state.inquiries={};v.state.inquirySource=probe.activePath;Object.assign(v.state.inquiry,{kind:'free',mode:'none',prompt:'',wikipedia:false,webSearch:false});
  off=probe.subscribe(()=>v.update(true));v.switchTab('inquiry');
  report.noGlobalHistoryControls=!panel().querySelector('[data-em-focus="inquiry-include-history"]')&&!panel().textContent.includes('OLD B');
  await ask('Current A question');report.replacesCurrentNote=probe.inquiryHistory.length===2&&probe.currentResearch.prompt==='Current A question'&&!panel().textContent.includes('OLD A');
  probe.activePath='Release B.md';v.update(true);report.separateNoteDraft=question().value==='';report.onlyCurrentResult=panel().textContent.includes('OLD B answer')&&!panel().textContent.includes('Current A question');
  v.state.inquiry.kind='free';v.update(true);await ask('Current B question');
  probe.activePath='Release A.md';v.update(true);report.restoresCurrentNote=question().value==='Current A question'&&panel().textContent.includes('Current answer 1')&&!panel().textContent.includes('Current B question');
  Object.assign(v.state.inquiry,{wikipedia:true,wikipediaTerm:'Ontologie',wikipediaSource:probe.activePath});
  await probe.inquire('New A question','none',[],{enabled:true,term:'Ontologie'},true);v.update(true);
  report.independentRequests=requests.slice(0,3).every(messages=>messages.length===2&&!messages.some(m=>/OLD [AB]|Current answer/u.test(m.content)));
  report.wikipediaGetsOnlyTerm=queries.length===1&&queries[0]==='Ontologie';
  finish='wait';const pending=probe.inquire('Pending A question','none',[]);report.oldResultRemovedImmediately=probe.currentResearch===undefined&&!panel().textContent.includes('Current answer 3');
  for(let i=0;i<30&&typeof finish!=='function';i++)await Promise.resolve();
  if(typeof finish!=='function')throw Error('Request did not reach mock model.');probe.activePath='Release B.md';finish('Late A answer');await pending;v.update(true);
  report.lateResultStaysWithSource=probe.currentResearch.prompt==='Current B question'&&!panel().textContent.includes('Late A answer');probe.activePath='Release A.md';v.update(true);report.latestAVisible=panel().textContent.includes('Late A answer')&&probe.inquiryHistory.length===2;
  report.userSettingsUnchanged=saved.settings===JSON.stringify(main.settings());report.userHistoryUnchanged=saved.history===JSON.stringify(main.inquiryHistory);
  if(Object.values(report).some(value=>value===false))throw Error(JSON.stringify(report));return {...report,realModelCalls:0,notesRead:0,notesWritten:0};
 }finally{off?.();probe.dispose();v.controller=main;v.state=saved.state;v.switchTab(saved.tab);v.update(true);}
}
evaluate(`(()=>{window.__emHistoryCheck={done:false};(${check.toString()})().then(report=>window.__emHistoryCheck={done:true,report}).catch(e=>window.__emHistoryCheck={done:true,failure:e.stack});return true;})()`);
let result;for(let i=0;i<60;i++){result=evaluate('window.__emHistoryCheck');if(result.done)break;await new Promise(r=>setTimeout(r,100));}
if(!result?.done||result.failure)throw Error(JSON.stringify(result));
writeFileSync('docs/inquiry-history-native-check.json',JSON.stringify(result.report,null,2)+'\n');console.log(JSON.stringify(result.report,null,2));evaluate('delete window.__emHistoryCheck');
