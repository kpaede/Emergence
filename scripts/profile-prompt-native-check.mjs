import {writeFileSync} from 'node:fs';
import {evaluate} from './obsidian-cli.mjs';

evaluate(`(()=>{window.__emProfilePromptCheck={done:false};(async()=>{
 const v=app.workspace.getLeavesOfType('emergence-workspace')[0].view,main=v.controller;
 if(main.abort||main.applyingIdea)throw Error('Eine Benutzeraktion läuft.');
 const saved={state:v.state,tab:v.tab,settings:JSON.stringify(main.settings()),analysis:JSON.stringify(main.review.analysis)};
 const settings=JSON.parse(saved.settings),token=crypto.randomUUID(),originalId=settings.activeProfile;
 const other=JSON.parse(JSON.stringify(main.profile));other.id='ui-profile-'+token;other.name='UI other';settings.profiles.push(other);
 const fields=main.analysisFields,synthetic='---\\n'+fields.map(f=>f+':').join('\\n')+'\\n---\\nSynthetic profile preview.';
 let fail=false,pause=false,release,persists=0,analyses=0,usedPrompt='',reads=0;
 const bind=(target,key)=>{const value=Reflect.get(target,key,target);return typeof value==='function'?value.bind(target):value;};
 const vault=new Proxy(app.vault,{get:(target,key)=>key==='read'?async()=>{reads++;return synthetic;}:bind(target,key)});
 const workspace=new Proxy(app.workspace,{get:(target,key)=>key==='activeEditor'?null:bind(target,key)});
 const testApp=new Proxy(app,{get:(target,key)=>key==='vault'?vault:key==='workspace'?workspace:bind(target,key)});
 const probe=new main.constructor(testApp,()=>settings,async()=>{},[],async()=>{if(fail)throw Error('Test storage failure');if(pause){pause=false;await new Promise(resolve=>{release=resolve;});}persists++;});
 probe.graph.snapshot=JSON.parse(JSON.stringify(main.graph.snapshot));probe.activePath=main.activePath;
 probe.analyze=async()=>{analyses++;usedPrompt=probe.profile.instructions;};
 let off;const panel=()=>v.contentEl.querySelector('.em-panel-analysis'),byLabel=label=>[...panel().querySelectorAll('[data-em-focus]')].find(e=>e.dataset.emFocus===label),tick=async()=>{for(let i=0;i<20;i++)await Promise.resolve();};
 const type=(label,value)=>{const e=byLabel(label);e.value=value;e.dispatchEvent(new e.ownerDocument.defaultView.Event('input',{bubbles:true}));};
 const click=text=>[...panel().querySelectorAll('button')].find(b=>b.textContent===text).click();
 const switchProfile=id=>{const e=byLabel('Profil');e.value=id;e.dispatchEvent(new e.ownerDocument.defaultView.Event('change',{bubbles:true}));};
 try{
  v.controller=probe;v.state=JSON.parse(JSON.stringify(saved.state));v.state.analysis.profileDrafts={};off=probe.subscribe(()=>v.update(true));v.switchTab('analysis');
  for(const key of ['analysis-settings','analysis-profile-prompt','analysis-scope'])panel().querySelector('[data-em-disclosure="'+key+'"]').open=true;
  const scope=panel().querySelector('[data-em-disclosure="analysis-scope"]'),scopeExplained=scope.textContent.includes('Vorhandene Notizen für Vorschläge')&&scope.textContent.includes('Links werden in')&&!!byLabel('Ordner für die Suche');
  const initial=probe.profile.instructions,marker='UI instruction '+token;type('Anweisungen an die KI',marker);byLabel('Anweisungen an die KI').focus();byLabel('Anweisungen an die KI').setSelectionRange(2,6);probe.status='UI refresh';probe.notify();
  const draftSurvives=byLabel('Anweisungen an die KI').value===marker&&byLabel('Anweisungen an die KI').selectionStart===2;
  const notSavedByTyping=probe.profile.instructions===initial;
  switchProfile(other.id);await tick();switchProfile(originalId);await tick();const draftSurvivesProfileSwitch=byLabel('Anweisungen an die KI').value===marker;
  click('Anfragevorschau öffnen');await tick();const modal=[...document.querySelectorAll('.em-inspect-modal')].find(m=>m.textContent.includes(marker));
  const previewUsesDraft=!!modal&&modal.textContent.includes('ungespeichertem Promptentwurf');[...modal?.querySelectorAll('button')??[]].find(b=>b.textContent==='Schließen')?.click();
  type('Zusätzliche Anweisungen','{{unknown}}');const beforeInvalid=persists;click('Prompt speichern');await tick();
  const invalidDraftRetained=probe.profile.instructions===initial&&byLabel('Zusätzliche Anweisungen').value==='{{unknown}}'&&panel().querySelector('.em-profile-prompt .em-error')?.textContent.includes('Platzhalter')&&persists===beforeInvalid;
  type('Zusätzliche Anweisungen','UI additional '+token);click('Prompt speichern');await tick();
  const explicitSave=probe.profile.instructions===marker&&probe.profile.templates.relations==='UI additional '+token&&probe.profile.version===main.profile.version+1;
  const next='UI next '+token,intermediate='UI saving '+token;pause=true;type('Anweisungen an die KI',intermediate);click('Prompt speichern');await tick();
  type('Anweisungen an die KI',next);release();await tick();const draftSurvivesSaving=probe.profile.instructions===intermediate&&byLabel('Anweisungen an die KI').value===next;
  click('Prompt speichern und starten');await tick();
  const saveBeforeStart=analyses===1&&usedPrompt===next&&probe.profile.instructions===next;
  fail=true;type('Anweisungen an die KI','UI failed '+token);click('Prompt speichern');await tick();
  const failureRollsBack=probe.profile.instructions===next&&byLabel('Anweisungen an die KI').value==='UI failed '+token&&panel().querySelector('.em-profile-prompt .em-error')?.textContent.includes('storage failure');
  fail=false;click('Entwurf verwerfen');const discardRestoresSaved=byLabel('Anweisungen an die KI').value===next;
  const report={scopeExplained,draftSurvives,notSavedByTyping,draftSurvivesProfileSwitch,previewUsesDraft,invalidDraftRetained:!!invalidDraftRetained,explicitSave,draftSurvivesSaving,saveBeforeStart,failureRollsBack:!!failureRollsBack,discardRestoresSaved,noOverflow:panel().scrollWidth<=panel().clientWidth+1,syntheticPreviewReads:reads,modelCalls:0,notesWritten:0,userSettingsUnchanged:saved.settings===JSON.stringify(main.settings()),userAnalysisUnchanged:saved.analysis===JSON.stringify(main.review.analysis)};
  if(Object.values(report).some(value=>value===false))throw Error(JSON.stringify(report));window.__emProfilePromptCheck={done:true,report};
 }finally{release?.();off?.();probe.dispose();v.controller=main;v.state=saved.state;v.switchTab(saved.tab);v.update(true);}
})().catch(error=>window.__emProfilePromptCheck={done:true,error:String(error),stack:error.stack});return true;})()`);
let done=false;
for(let i=0;i<60;i++){const state=evaluate('window.__emProfilePromptCheck');if(!state.done)continue;if(state.error)throw Error(state.error+'\n'+state.stack);writeFileSync('docs/profile-prompt-native-check.json',JSON.stringify(state.report,null,2)+'\n');console.log(JSON.stringify(state.report,null,2));done=true;break;}
if(!done)throw Error('Profile prompt test did not finish.');
