import {writeFileSync} from 'node:fs';
import {evaluate} from './obsidian-cli.mjs';

// Synthetic targets in an isolated controller; no files, models or settings are changed.
const report=evaluate(`(()=>{
 const v=app.workspace.getLeavesOfType('emergence-workspace')[0].view,main=v.controller;
 if(main.abort||main.applyingIdea)throw Error('Eine Benutzeraktion läuft.');
 const saved={state:v.state,tab:v.tab,settings:JSON.stringify(main.settings()),analysis:JSON.stringify(main.review.analysis)};
 const probe=new main.constructor(app,()=>JSON.parse(saved.settings),async()=>{},[],async()=>{});
 probe.graph.snapshot=JSON.parse(JSON.stringify(main.graph.snapshot));probe.activePath=main.activePath;
 const token=crypto.randomUUID(),source=probe.activePath,node=probe.graph.snapshot.nodes.find(n=>n.id===source),field=probe.analysisFields[0]??probe.graph.snapshot.fields[0];
 const unique='Existing '+token,duplicate='Shared '+token,fresh='New '+token;
 for(const [folder,title]of [['Existing',unique],['A',duplicate],['B',duplicate]])probe.graph.snapshot.nodes.push({...node,id:folder+'/'+title+'.md',title,aliases:[]});
 const analysisId=crypto.randomUUID();let applies=0;probe.applyIdea=async()=>{applies++;};
 const idea=(id,title)=>({id,analysisId,source,sourceVersion:'ui-only',operation:'add',target:'Proposed/'+title+'.md',targetKind:'unresolved',field,property:field,value:'[['+title+']]',reason:'',evidence:node.title,evidenceSource:'title',confidence:'medium',status:'pending',outputId:probe.profile.outputs.find(o=>o.kind==='relations').id,contract:'breadcrumbs-v2'});
 probe.review.set({id:analysisId,source,sourceVersion:'ui-only',fields:[field],perField:4,status:'complete',completed:1,total:1,errors:[],candidates:[],artifacts:[],suggestions:[idea('existing',unique),idea('new',fresh),idea('duplicates',duplicate)]});
 let off;const panel=()=>v.contentEl.querySelector('.em-panel-analysis'),row=id=>panel().querySelector('[data-idea-id="'+id+'"]');
 try{
  v.controller=probe;v.state=JSON.parse(JSON.stringify(saved.state));v.state.analysis.ideaEdit=undefined;v.state.analysis.targetChoice=undefined;off=probe.subscribe(()=>v.update(true));v.switchTab('analysis');
  probe.review.set({...probe.review.analysis,associative:true});v.update(true);
  const regular=row('new'),ambiguous=row('duplicates');if(!regular||!ambiguous)throw Error('Missing synthetic field idea rows');const explicitPoolColumns=!regular.classList.contains('has-accept')&&!regular.querySelector('.em-idea-accept')&&ambiguous.classList.contains('has-accept')&&!!ambiguous.querySelector('.em-idea-accept')&&getComputedStyle(regular).gridTemplateColumns.trim().split(' ').filter(Boolean).length===4&&getComputedStyle(ambiguous).gridTemplateColumns.trim().split(' ').filter(Boolean).length===5;
  probe.review.set({...probe.review.analysis,associative:false});v.update(true);
  const existing=row('existing'),newRow=row('new'),multiple=row('duplicates');
  const statusLabels=existing.textContent.includes('Vorhanden')&&newRow.textContent.includes('Neu')&&multiple.textContent.includes('2 Notizen');
  const colorsDiffer=getComputedStyle(existing.querySelector('.em-idea-target-title')).color!==getComputedStyle(newRow.querySelector('.em-idea-target-title')).color;
  multiple.querySelector('.em-idea-accept').click();const offered=[...row('duplicates').querySelectorAll('.em-target-option')];
  const opensChoiceWithoutApply=offered.length===2&&applies===0&&!panel().querySelector('.em-error');
  offered[1].click();v.update(true);const selected=probe.review.analysis.suggestions.find(s=>s.id==='duplicates');
  const choiceSelectsExisting=selected.target==='B/'+duplicate+'.md'&&selected.targetKind==='existing'&&selected.targetSelected===true;
  row('duplicates').querySelector('.em-idea-accept').click();const applyAfterChoice=applies===1;
  row('new').querySelector('[data-em-focus="idea-edit-new"]').click();let editor=panel().querySelector('.em-idea-editor');editor.value=duplicate;editor.dispatchEvent(new editor.ownerDocument.defaultView.Event('input',{bubbles:true}));editor.dispatchEvent(new editor.ownerDocument.defaultView.KeyboardEvent('keydown',{key:'Enter',bubbles:true,cancelable:true}));
  const edited=probe.review.analysis.suggestions.find(s=>s.id==='new');const editedDuplicateIsChoice=edited.targetKind==='existing'&&edited.targetCandidates.length===2&&!edited.targetSelected&&!panel().querySelector('.em-idea-edit-error')&&row('new').querySelectorAll('.em-target-option').length===2;
  const result={explicitPoolColumns,statusLabels,colorsDiffer,opensChoiceWithoutApply,choiceSelectsExisting,applyAfterChoice,editedDuplicateIsChoice,noThirdTarget:probe.review.analysis.suggestions.every(s=>s.id==='existing'||s.targetKind==='existing'),noOverflow:panel().scrollWidth<=panel().clientWidth+1,userSettingsUnchanged:saved.settings===JSON.stringify(main.settings()),userAnalysisUnchanged:saved.analysis===JSON.stringify(main.review.analysis),modelCalls:0,notesWritten:0};
  if(Object.values(result).some(value=>value===false))throw Error(JSON.stringify(result));return result;
 }finally{off?.();probe.dispose();v.controller=main;v.state=saved.state;v.switchTab(saved.tab);v.update(true);}
})()`);
writeFileSync('docs/target-matches-native-check.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
