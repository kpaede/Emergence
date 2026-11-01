import {writeFileSync} from 'node:fs';
import {evaluate} from './obsidian-cli.mjs';
async function check(){
 const c=app.plugins.plugins.emergence.controller;if(c.abort||c.applyingIdea)throw Error('Eine Benutzeraktion läuft.');
 const before=JSON.stringify(c.settings()),review=JSON.stringify(c.review.analysis),probe=new c.constructor(app,()=>JSON.parse(before),async()=>{},[],async()=>{}),started=performance.now();
 try{
  const fields=['Überbau'],rule={label:'Überbau',description:'Das übergeordnete Fachgebiet, dessen Teildisziplin der Ausgangsbegriff ist.',class:'unknown',hierarchical:false,acyclic:false,transitive:false,symmetric:false,inverse:'',direction:'forward',allowSelf:false,writable:true,targetProperty:'Überbau',eligibleNodeTypes:[],provenance:'user'};
  const graph={version:1,builtAt:Date.now(),nodes:['Ontologie','Philosophie'].map(title=>({id:title+'.md',title,aliases:[],tags:[],type:'md',exists:true,mtime:1,size:1})),edges:[],fields,groups:[],rules:{'Überbau':rule},partial:false,diagnostics:[],unresolved:[],breadcrumbsVersion:'synthetic-fixture'};
  const profile=JSON.parse(JSON.stringify(c.profile));profile.maxTokens=512;profile.temperature=0;profile.instructions='Nenne fachlich passende übergeordnete Disziplinen für den Quellbegriff.';profile.templates.relations='Überbau bedeutet übergeordnetes Fachgebiet.';profile.outputs.find(o=>o.kind==='relations').allowedEdgeTypes=[];
  const info=await probe.provider.health();
  const wikipedia=await probe.wikipedia.lookup('Ontologie',new AbortController().signal);
  const result=await probe.analyzer.analyze('Ontologie.md','---\nÜberbau:\n---\n# Ontologie\nOntologie ist eine Teildisziplin der Philosophie. Sie untersucht das Sein, die Existenz und Kategorien des Seienden.',graph,profile,probe.settings(),new AbortController().signal,()=>{},{fields,folders:[],allowNew:true,maxSuggestions:4,perField:4,outputId:profile.outputs.find(o=>o.kind==='relations').id});
  const report={model:probe.settings().model,nativeTransport:true,health:info.models.includes(probe.settings().model),complete:result.status==='complete',philosophySuggested:result.suggestions.some(s=>s.target==='Philosophie.md'&&s.value==='[[Philosophie]]'),pendingOnly:result.suggestions.every(s=>s.status==='pending'),suggestionCount:result.suggestions.length,wikipediaStatus:wikipedia.status,wikipediaSourceCount:wikipedia.sources.length,userSettingsUnchanged:before===JSON.stringify(c.settings()),userAnalysisUnchanged:review===JSON.stringify(c.review.analysis),notesRead:0,notesWritten:0,seconds:Number(((performance.now()-started)/1000).toFixed(2))};
  if(!report.complete||!report.philosophySuggested||!report.pendingOnly||!report.userSettingsUnchanged||!report.userAnalysisUnchanged)throw Error(JSON.stringify({report,errors:result.errors}));return report;
 }finally{probe.dispose();}
}
evaluate(`(()=>{window.__emNativeFieldIdeas={done:false};(${check.toString()})().then(report=>window.__emNativeFieldIdeas={done:true,report}).catch(e=>window.__emNativeFieldIdeas={done:true,failure:e.stack});return true;})()`);
let result;for(let i=0;i<600;i++){result=evaluate('window.__emNativeFieldIdeas');if(result.done)break;await new Promise(r=>setTimeout(r,250));}if(!result?.done||result.failure)throw Error(JSON.stringify(result));writeFileSync('docs/field-ideas-native-check.json',JSON.stringify(result.report,null,2)+'\n');console.log(JSON.stringify(result.report,null,2));evaluate('delete window.__emNativeFieldIdeas');
