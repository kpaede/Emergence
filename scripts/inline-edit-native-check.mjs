import {writeFileSync} from 'node:fs';
import {evaluate} from './obsidian-cli.mjs';

// Real inline controls, isolated controller, cached metadata only. No model or note writes.
const report = evaluate(`(()=>{
 const v=app.workspace.getLeavesOfType('emergence-workspace')[0].view,main=v.controller;
 if(main.abort||main.applyingIdea)throw Error('Eine Benutzeraktion läuft.');
 const saved={state:v.state,tab:v.tab,settings:JSON.stringify(main.settings()),analysis:JSON.stringify(main.review.analysis)};
 const probe=new main.constructor(app,()=>JSON.parse(saved.settings),async()=>{},[],async()=>{});
 probe.graph.snapshot=JSON.parse(JSON.stringify(main.graph.snapshot));probe.activePath=main.activePath;
 const token=crypto.randomUUID(),field=probe.analysisFields[0],source=probe.activePath,existing='Inline existing '+token,alias='Inline alias '+token;
 const sourceNode=probe.graph.snapshot.nodes.find(n=>n.id===source);
 probe.graph.snapshot.nodes.push({...sourceNode,id:'Inline fixtures/'+existing+'.md',title:existing,aliases:[alias]});
 const id='inline-idea',analysisId=crypto.randomUUID();let applied=0;probe.applyIdea=async()=>{applied++;};
 probe.review.set({id:analysisId,source,sourceVersion:'ui-only',fields:[field],perField:4,status:'complete',completed:1,total:1,errors:[],artifacts:[],candidates:[],suggestions:[{id,analysisId,source,sourceVersion:'ui-only',operation:'add',target:'Inline fixtures/Initial concept.md',targetKind:'unresolved',field,property:field,value:'[[Initial concept]]',reason:'',evidence:sourceNode.title,evidenceSource:'title',confidence:'medium',status:'pending',outputId:probe.profile.outputs.find(o=>o.kind==='relations').id,contract:'breadcrumbs-v2'}]});
 let off;
 const panel=()=>v.contentEl.querySelector('.em-panel-analysis'),editor=()=>panel().querySelector('.em-idea-editor');
 const type=value=>{const e=editor();e.value=value;e.dispatchEvent(new e.ownerDocument.defaultView.Event('input',{bubbles:true}));};
 const key=value=>{const e=editor();e.dispatchEvent(new e.ownerDocument.defaultView.KeyboardEvent('keydown',{key:value,bubbles:true,cancelable:true}));e.dispatchEvent(new e.ownerDocument.defaultView.KeyboardEvent('keyup',{key:value,bubbles:true}));};
 const begin=()=>panel().querySelector('[data-em-focus="idea-edit-'+id+'"]').click();
 try{
  v.controller=probe;v.state=JSON.parse(JSON.stringify(saved.state));v.state.analysis.ideaEdit=undefined;off=probe.subscribe(()=>v.update(true));v.switchTab('analysis');
  const modals=document.querySelectorAll('.em-edit-modal').length;begin();
  const inlineWithoutModal=!!editor()&&document.querySelectorAll('.em-edit-modal').length===modals;
  const revised='Revised concept '+token;type(revised);editor().setSelectionRange(3,7);probe.status='Status update';probe.notify();
  const draftSurvives=editor().value===revised&&editor().selectionStart===3&&editor().selectionEnd===7;
  key('Enter');let s=probe.review.analysis.suggestions[0];const enterSaved=!editor()&&s.target.endsWith('/'+revised+'.md')&&s.value==='[['+revised+']]'&&s.targetKind==='unresolved'&&s.field===field&&applied===0;
  begin();type('');key('Enter');const invalidStaysInline=editor()?.getAttribute('aria-invalid')==='true'&&!!panel().querySelector('.em-idea-edit-error');key('Escape');
  const escapeCancels=!editor()&&probe.review.analysis.suggestions[0].target===s.target;
  begin();type(alias);key('Enter');s=probe.review.analysis.suggestions[0];
  const existingResolved=s.target==='Inline fixtures/'+existing+'.md'&&s.targetKind==='existing'&&s.value==='[['+existing+']]';
  const actual=main.graph.snapshot.nodes.find(n=>n.exists&&n.id.endsWith('.md')&&n.id!==source);
  probe.review.edit(id,{target:actual.id,targetKind:'unresolved',field,property:field,value:'[['+actual.title+']]'});v.update(true);begin();key('Enter');
  const current=probe.review.analysis.suggestions[0],unchangedNameRefreshesStatus=current.target===actual.id&&current.targetKind==='existing';
  const result={inlineWithoutModal,draftSurvives,enterSaved,invalidStaysInline,escapeCancels,existingResolved,unchangedNameRefreshesStatus,noApplyOnEnter:applied===0,noOverflow:panel().scrollWidth<=panel().clientWidth+1,userSettingsUnchanged:saved.settings===JSON.stringify(main.settings()),userAnalysisUnchanged:saved.analysis===JSON.stringify(main.review.analysis),modelCalls:0,notesWritten:0};
  if(Object.values(result).some(value=>value===false))throw Error(JSON.stringify(result));return result;
 }finally{off?.();probe.dispose();v.controller=main;v.state=saved.state;v.switchTab(saved.tab);v.update(true);}
})()`);
writeFileSync('docs/inline-edit-native-check.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
