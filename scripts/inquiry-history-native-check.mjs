import {writeFileSync} from 'node:fs';
import {evaluate} from './obsidian-cli.mjs';

evaluate(`(()=>{window.__emHistoryCheck={done:false};(async()=>{
 const v=app.workspace.getLeavesOfType('emergence-workspace')[0].view,main=v.controller;if(main.abort||main.applyingIdea)throw Error('Eine Benutzeraktion läuft.');
 const saved={state:v.state,tab:v.tab,settings:JSON.stringify(main.settings()),history:JSON.stringify(main.inquiryHistory)};
 const probe=new main.constructor(app,()=>JSON.parse(saved.settings),async()=>{},[],async()=>{});probe.graph.snapshot=JSON.parse(JSON.stringify(main.graph.snapshot));probe.activePath=main.activePath;
 probe.inquiryHistory=Array.from({length:4},(_,i)=>({prompt:'OLD question '+i,answer:'OLD answer '+i,context:'none'}));
 const requests=[],queries=[];let task;probe.provider.chat=async options=>{requests.push(options.messages);return 'Synthetic current answer.';};
 probe.wikipedia={lookup:async query=>{queries.push(query);return {query,status:'empty',sources:[],fetchedAt:new Date().toISOString()};}};
 const inquire=probe.inquire.bind(probe);probe.inquire=(...args)=>{task=inquire(...args);return task;};
 let off;const panel=()=>v.contentEl.querySelector('.em-panel-inquiry'),box=()=>panel().querySelector('[data-em-focus="inquiry-include-history"]');
 const ask=async question=>{const input=panel().querySelector('[data-em-focus="Deine Frage"]');input.value=question;input.dispatchEvent(new input.ownerDocument.defaultView.Event('input',{bubbles:true}));[...panel().querySelectorAll('button')].find(b=>b.textContent==='Frage senden').click();await task;v.update(true);};
 try{
  v.controller=probe;v.state=JSON.parse(JSON.stringify(saved.state));Object.assign(v.state.inquiry,{mode:'none',prompt:'Current independent question',includeHistory:false,wikipedia:false});off=probe.subscribe(()=>v.update(true));v.switchTab('inquiry');
  const defaultOff=!!box()&&!box().checked;await ask('Current independent question');
  const independentByDefault=requests[0].length===2&&!requests[0].some(m=>m.content.includes('OLD question'))&&probe.inquiryHistory.at(-1).historyIncluded===0;
  const expected=probe.inquiryHistory.slice(-3).flatMap(h=>[h.prompt,h.answer]);box().click();await ask('Current follow-up question');
  const followUpOptIn=JSON.stringify(requests[1].slice(1,-1).map(m=>m.content))===JSON.stringify(expected)&&probe.inquiryHistory.at(-1).historyIncluded===3;
  box().click();Object.assign(v.state.inquiry,{wikipedia:true,wikipediaTerm:'Ontologie',wikipediaSource:probe.activePath});v.update(true);await ask('Current new topic');
  const optOutAgain=requests[2].length===2&&probe.inquiryHistory.at(-1).historyIncluded===0;
  await probe.inquire('Current fourth question','none',[],{enabled:true,term:'Ontologie'},true);
  const report={defaultOff,independentByDefault,followUpOptIn,optOutAgain,wikipediaGetsOnlyTerm:queries.length===2&&queries.every(q=>q==='Ontologie'),historyStillVisible:probe.inquiryHistory.length===8,userSettingsUnchanged:saved.settings===JSON.stringify(main.settings()),userHistoryUnchanged:saved.history===JSON.stringify(main.inquiryHistory),realModelCalls:0,notesRead:0,notesWritten:0};
  if(Object.values(report).some(value=>value===false))throw Error(JSON.stringify(report));window.__emHistoryCheck={done:true,report};
 }finally{off?.();probe.dispose();v.controller=main;v.state=saved.state;v.switchTab(saved.tab);v.update(true);}
})().catch(error=>window.__emHistoryCheck={done:true,error:String(error),stack:error.stack});return true;})()`);
let done=false;for(let i=0;i<60;i++){const state=evaluate('window.__emHistoryCheck');if(!state.done)continue;if(state.error)throw Error(state.error+'\n'+state.stack);writeFileSync('docs/inquiry-history-native-check.json',JSON.stringify(state.report,null,2)+'\n');console.log(JSON.stringify(state.report,null,2));done=true;break;}if(!done)throw Error('Inquiry history test did not finish.');
