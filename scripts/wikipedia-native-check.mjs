import {writeFileSync} from 'node:fs';
import {evaluate} from './obsidian-cli.mjs';

// Real controls and controllers with synthetic local text and a captured public Wikipedia response.
evaluate(`(()=>{window.__emWikiControls={done:false};(async()=>{
 const v=app.workspace.getLeavesOfType('emergence-workspace')[0].view,main=v.controller;
 if(main.abort||main.applyingIdea)throw Error('Eine Benutzeraktion läuft.');
 const wiki=window.__emWikiLive?.value;if(wiki?.status!=='ready')throw Error('Der öffentliche Wikipedia-Zugriff wurde noch nicht bestätigt.');
 const saved={state:v.state,tab:v.tab,settings:JSON.stringify(main.settings()),analysis:JSON.stringify(main.review.analysis)};
 const settings=JSON.parse(saved.settings),fields=main.analysisFields,synthetic='---\\n'+fields.map(f=>f+':').join('\\n')+'\\n---\\nSynthetic ontology concept. No private note text.';
 const bind=(target,key)=>{const value=Reflect.get(target,key,target);return typeof value==='function'?value.bind(target):value;};
 const vault=new Proxy(app.vault,{get:(target,key)=>key==='read'?async()=>synthetic:bind(target,key)});
 const workspace=new Proxy(app.workspace,{get:(target,key)=>key==='activeEditor'?null:bind(target,key)});
 const testApp=new Proxy(app,{get:(target,key)=>key==='vault'?vault:key==='workspace'?workspace:bind(target,key)});
 const probe=new main.constructor(testApp,()=>settings,async()=>{},[],async()=>{});probe.graph.snapshot=JSON.parse(JSON.stringify(main.graph.snapshot));probe.activePath=main.activePath;
 let lookups=0,mode='ready',started,analysisTask,inquiryTask;const queries=[],modelWikipedia=[];
 probe.wikipedia={lookup:async(term,signal)=>{lookups++;queries.push(term);if(mode==='pending'){started?.();return new Promise((_,reject)=>signal.addEventListener('abort',()=>reject(Error('Recherche abgebrochen.')),{once:true}));}return mode==='error'?{...wiki,status:'error',sources:[],message:'Wikipedia konnte nicht geladen werden.'}:JSON.parse(JSON.stringify(wiki));}};
 probe.provider.chat=async options=>{const has=options.messages.some(m=>m.content.includes('"wikipedia":'));modelWikipedia.push(has);if(options.format){const keys=options.format.required;return JSON.stringify(Object.fromEntries(keys.map((key,index)=>[key,index?[]:['Synthetic idea '+crypto.randomUUID()]])));}return 'Eine synthetische Antwort ['+wiki.sources[0].id+'].';};
 const analyze=probe.analyze.bind(probe);probe.analyze=options=>{analysisTask=analyze(options);return analysisTask;};
 const inquire=probe.inquire.bind(probe);probe.inquire=(...args)=>{inquiryTask=inquire(...args);return inquiryTask;};
 let off;const panel=()=>v.panels.get(v.tab),click=text=>[...panel().querySelectorAll('button')].find(b=>b.textContent===text).click();
 const toggle=()=>panel().querySelector('[data-em-focus="wikipedia-enabled"]').click();
 const term=()=>{const input=panel().querySelector('[data-em-focus="Wikipedia-Suchbegriff"]');input.value='Ontologie';input.dispatchEvent(new input.ownerDocument.defaultView.Event('input',{bubbles:true}));};
 try{
  v.controller=probe;v.state=JSON.parse(JSON.stringify(saved.state));v.state.analysis.profileDrafts={};v.state.analysis.wikipedia=false;v.state.inquiry.wikipedia=false;off=probe.subscribe(()=>v.update(true));v.switchTab('analysis');
  const defaultOff=!panel().querySelector('[data-em-focus="wikipedia-enabled"]').checked;
  click('Ideen vorschlagen');await analysisTask;v.update(true);const analysisOffline=lookups===0&&modelWikipedia.at(-1)===false;
  toggle();term();const toggleDoesNotFetch=lookups===0;click('Ideen vorschlagen');await analysisTask;v.update(true);
  const analysisOnline=lookups===1&&modelWikipedia.at(-1)===true&&probe.review.analysis.wikipedia.status==='ready'&&!!panel().querySelector('a.external-link');
  v.state.inquiry.prompt='Erkläre den Begriff.';v.state.inquiry.mode='none';v.switchTab('inquiry');click('Frage senden');await inquiryTask;v.update(true);
  const inquiryOffline=lookups===1&&modelWikipedia.at(-1)===false&&!probe.inquiryHistory.at(-1).wikipedia;
  toggle();term();click('Frage senden');await inquiryTask;v.update(true);
  const inquiryOnline=lookups===2&&modelWikipedia.at(-1)===true&&probe.inquiryHistory.at(-1).wikipedia.status==='ready'&&!!panel().querySelector('a.external-link');
  mode='error';v.switchTab('analysis');click('Ideen vorschlagen');await analysisTask;v.update(true);
  const failureIsVisible=probe.review.analysis.wikipedia.status==='error'&&modelWikipedia.at(-1)===false&&panel().textContent.includes('Wikipedia konnte nicht geladen werden.');
  mode='pending';const before=modelWikipedia.length;const began=new Promise(resolve=>{started=resolve;});const cancelled=probe.analyze({enabled:true,term:'Ontologie'}).catch(error=>String(error));await began;probe.cancel();const cancellationStopsModel=(await cancelled).includes('abgebrochen')&&modelWikipedia.length===before;
  const report={defaultOff,analysisOffline,toggleDoesNotFetch,analysisOnline,inquiryOffline,inquiryOnline,failureIsVisible,cancellationStopsModel,onlyVisibleTermSent:queries.every(query=>query==='Ontologie'),noOverflow:panel().scrollWidth<=panel().clientWidth+1,userSettingsUnchanged:saved.settings===JSON.stringify(main.settings()),userAnalysisUnchanged:saved.analysis===JSON.stringify(main.review.analysis),realModelCalls:0,privateNoteReads:0,notesWritten:0};
  if(Object.values(report).some(value=>value===false))throw Error(JSON.stringify(report));window.__emWikiControls={done:true,report};
 }finally{off?.();probe.dispose();v.controller=main;v.state=saved.state;v.switchTab(saved.tab);v.update(true);}
})().catch(error=>window.__emWikiControls={done:true,error:String(error),stack:error.stack});return true;})()`);
let done=false;for(let i=0;i<90;i++){const state=evaluate('window.__emWikiControls');if(!state.done)continue;if(state.error)throw Error(state.error+'\n'+state.stack);writeFileSync('docs/wikipedia-native-check.json',JSON.stringify(state.report,null,2)+'\n');console.log(JSON.stringify(state.report,null,2));done=true;break;}if(!done)throw Error('Wikipedia UI test did not finish.');
