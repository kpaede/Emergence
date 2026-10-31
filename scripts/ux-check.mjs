import {writeFileSync,readFileSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {command,evaluate} from './obsidian-cli.mjs';
const view='app.workspace.getLeavesOfType("emergence-workspace")[0].view';
const settings='app.setting.pluginTabs.find(t=>t.id==="Emergence")';
const assert=(condition,message)=>{if(!condition)throw new Error(message);};
const before= evaluate('JSON.stringify(app.plugins.plugins.Emergence.settings)');
const bcPath=resolve('../breadcrumbs/data.json'), hash=()=>createHash('sha256').update(readFileSync(bcPath)).digest('hex'), bcBefore=hash();
const report={};
evaluate(`(()=>{const v=${view};if(window.__emUXOldInquiry)v.state.inquiry=window.__emUXOldInquiry;if(window.__emUXOldStatus!==undefined)v.controller.status=window.__emUXOldStatus;return true;})()`);
try {
command('command',['id=Emergence:open-workspace']);
report.navigation=evaluate(`(()=>{const v=${view};v.switchTab('graph');const nav=v.contentEl.querySelector('[role=tablist]'),buttons=[...nav.querySelectorAll('[role=tab]')];buttons[0].focus();buttons[0].dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true}));return {arrowNavigation:v.tab==='analysis',oneTabStop:buttons.filter(b=>b.tabIndex===0).length===1,linked:buttons.every(b=>!!document.getElementById(b.getAttribute('aria-controls'))),selected:buttons.filter(b=>b.getAttribute('aria-selected')==='true').length};})()`);
assert(report.navigation.arrowNavigation&&report.navigation.oneTabStop&&report.navigation.linked&&report.navigation.selected===1,'Accessible tab navigation failed');
report.mainNote=evaluate(`(()=>{const c=${view}.controller;c.captureActive();const note=app.workspace.getMostRecentLeaf(app.workspace.rootSplit)?.view;return {available:!!note?.file,matches:!!note?.file&&c.activePath===note.file.path};})()`);
assert(!report.mainNote.available||report.mainNote.matches,'Sidebar lost the current main note');
report.draft=evaluate(`(()=>{const v=${view};window.__emUXOldInquiry=JSON.parse(JSON.stringify(v.state.inquiry));window.__emUXOldStatus=v.controller.status;v.switchTab('inquiry');let editor=v.contentEl.querySelector('textarea');editor.value='UX-Prüfung: Dieser Entwurf bleibt erhalten.';editor.dispatchEvent(new Event('input',{bubbles:true}));editor.focus();editor.setSelectionRange(10,10);v.controller.status='UX-Prüfung';v.controller.notify();editor=v.contentEl.querySelector('textarea');const caret=editor===document.activeElement&&editor.selectionStart===10;v.switchTab('registry');v.switchTab('inquiry');return {preserved:v.contentEl.querySelector('textarea').value==='UX-Prüfung: Dieser Entwurf bleibt erhalten.',caret};})()`);
assert(report.draft.preserved&&report.draft.caret,'Draft or caret lost across a notification/tab switch');
report.context=evaluate(`(()=>{const v=${view},find=()=>[...v.contentEl.querySelectorAll('select')].find(e=>e.dataset.emFocus==='Kontext für diese Anfrage');let select=find();select.value='notes';select.dispatchEvent(new Event('change',{bubbles:true}));const withPaths=v.contentEl.querySelectorAll('textarea').length;select=find();select.value='none';select.dispatchEvent(new Event('change',{bubbles:true}));return {selectedNotesInputs:withPaths,withoutNotesInputs:v.contentEl.querySelectorAll('textarea').length};})()`);
assert(report.context.selectedNotesInputs===2&&report.context.withoutNotesInputs===1,'Context form is not conditional');
report.responsive=[];
for(const tab of ['graph','analysis','inquiry','registry','review']) {
 evaluate(`(()=>{${view}.switchTab('${tab}');return true;})()`);
 for(const width of [280,360,760]) {
  const metrics=evaluate(`(()=>{const v=${view},clone=v.contentEl.cloneNode(true);clone.removeAttribute('id');clone.style.cssText='position:fixed;left:-10000px;top:0;width:${width}px;height:760px;';document.body.appendChild(clone);clone.querySelector('.em-graph')?.replaceChildren();const p=clone.querySelector('[role=tabpanel]:not([hidden])');const out={tab:'${tab}',width:${width},panelWidth:p.clientWidth,scrollWidth:p.scrollWidth,visibleTextareas:[...p.querySelectorAll('textarea')].filter(e=>!!e.offsetParent).length};clone.remove();return out;})()`);
  assert(metrics.scrollWidth<=metrics.panelWidth+1,`Horizontal overflow: ${tab} at ${width}px: ${JSON.stringify(metrics)}`); report.responsive.push(metrics);
 }
}
evaluate(`(()=>{const v=${view};window.__emUXPreviousAnalysis=v.controller.review.analysis;const g=v.controller.graph.snapshot,source=v.controller.activePath||g.nodes.find(n=>n.exists&&n.id.endsWith('.md')).id;v.controller.review.set({id:'ux-fixture',source,sourceVersion:'ui-only-not-writable',suggestions:[0,1,2].map(i=>({id:'ux-'+i,analysisId:'ux-fixture',source,sourceVersion:'ui-only-not-writable',operation:'add',target:g.nodes.find(n=>n.exists&&n.id!==source&&n.id.endsWith('.md')).id,targetKind:'existing',field:g.fields[0],property:g.fields[0],value:'[[UI-Test]]',reason:'UI-Test: nachvollziehbare Zuordnung zur Prüfung.',evidence:'UI-Testbeleg; keine echte Analyse.',confidence:'medium',status:'pending',outputId:'relations'})),candidates:[],artifacts:[],completed:1,total:1,status:'complete',errors:[]});v.switchTab('review');return true;})()`);
report.review=evaluate(`(()=>{const v=${view},p=v.contentEl.querySelector('[role=tabpanel]:not([hidden])');return {cards:p.querySelectorAll('.em-suggestion').length,allPending:v.controller.review.analysis.suggestions.every(s=>s.status==='pending'),noFinalApply:[...p.querySelectorAll('button')].every(b=>b.textContent!=='Bestätigen und übernehmen'),nextAction:[...p.querySelectorAll('button')].some(b=>b.textContent.includes('Nächsten ungeprüften'))};})()`);
assert(report.review.cards===3&&report.review.allPending&&report.review.noFinalApply&&report.review.nextAction,'Review pending gate or layout failed');
evaluate(`(()=>{const v=${view};if(window.__emUXPreviousAnalysis)v.controller.review.set(window.__emUXPreviousAnalysis);else v.controller.review.clear();v.state.inquiry=window.__emUXOldInquiry;v.controller.status=window.__emUXOldStatus;v.switchTab('graph');return true;})()`);
evaluate(`(()=>{app.setting.open();app.setting.openTabById('Emergence');return true;})()`);
report.settings=[];
for(const section of ['model','relations','profiles','data']) {
 const metrics=evaluate(`(()=>{const t=${settings};t.section='${section}';t.renderBody();return {section:'${section}',width:t.body.clientWidth,scrollWidth:t.body.scrollWidth,headings:t.body.querySelectorAll('.setting-item-heading').length,rawJSONEditors:[...t.body.querySelectorAll('textarea')].filter(e=>e.value.trim().startsWith('[{')).length,bodyBottom:t.body.getBoundingClientRect().bottom,footerTop:t.saveButton.closest('.em-settings-footer').getBoundingClientRect().top};})()`);
 assert(metrics.scrollWidth<=metrics.width+1,`Settings overflow: ${section}`);assert(metrics.bodyBottom<=metrics.footerTop+1,`Settings footer covers fields: ${section}`); report.settings.push(metrics);
}
report.settingsDraft=evaluate(`(()=>{const t=${settings};t.section='profiles';t.profileEditor.section='general';t.renderBody();const editor=t.body.querySelector('textarea');editor.value='UI-Testentwurf';editor.dispatchEvent(new editor.ownerDocument.defaultView.Event('input',{bubbles:true}));t.section='model';t.renderBody();t.section='profiles';t.renderBody();const result={retained:t.body.querySelector('textarea').value==='UI-Testentwurf',dirty:!t.saveButton.disabled};t.display();return result;})()`);
assert(report.settingsDraft.retained&&report.settingsDraft.dirty,'Settings draft was lost');
report.profileEditors=[];
for(const section of ['prompts','outputs','inquiry']) {
 const metrics=evaluate(`(()=>{const t=${settings};t.section='profiles';t.profileEditor.section='${section}';t.renderBody();return {section:'${section}',width:t.body.clientWidth,scrollWidth:t.body.scrollWidth,textareas:t.body.querySelectorAll('textarea').length};})()`);
 assert(metrics.scrollWidth<=metrics.width+1,`Profile editor overflow: ${section}`);report.profileEditors.push(metrics);
}
evaluate(`(()=>{const t=${settings};t.display();window.__emUXHealth={done:false};app.plugins.plugins.Emergence.controller.provider.health().then(r=>window.__emUXHealth={done:true,models:r.models}).catch(e=>window.__emUXHealth={done:true,error:String(e)});return true;})()`);
for(let i=0;i<40;i++){const state=evaluate('window.__emUXHealth');if(state?.done){report.rendererOllama=state;break;}}
assert(report.rendererOllama?.models?.includes('qwen3.5:9b'),'Renderer Ollama request failed: '+JSON.stringify(report.rendererOllama));
evaluate(`(()=>{app.setting.close();const v=${view},c=v.controller;window.__emUXRealPreview=c.writer.preview;window.__emUXRealApply=c.writer.apply;window.__emUXConfirmCalls=0;c.writer.preview=async()=>({token:'ui-only',source:'UI-Test.md',changes:[{}],beforeFrontmatter:'---\\nBeziehung: []\\n---',afterFrontmatter:'---\\nBeziehung: ["[[Neuer Begriff]]"]\\n---'});c.writer.apply=async()=>{window.__emUXConfirmCalls++;};c.review.set({id:'ui-modal',source:'UI-Test.md',sourceVersion:'not-writable',suggestions:[{id:'ui-modal-suggestion',analysisId:'ui-modal',source:'UI-Test.md',sourceVersion:'not-writable',operation:'add',target:'Begriff.md',targetKind:'unresolved',field:c.graph.snapshot.fields[0],property:c.graph.snapshot.fields[0],value:'[[Begriff]]',reason:'UI-Test',evidence:'UI-Test',confidence:'medium',status:'pending',outputId:'relations'}],candidates:[],artifacts:[],completed:1,total:1,status:'complete',errors:[]});c.review.result.suggestions[0].status='accepted';v.switchTab('review');const b=[...v.contentEl.querySelectorAll('button')].find(b=>b.textContent.startsWith('Änderungen ansehen'));if(!b||b.disabled)throw new Error('Missing preview action');b.click();return true;})()`);
report.confirmation=evaluate(`(()=>{const modal=activeDocument.querySelector('.em-confirm-modal');if(!modal)throw new Error('Confirmation modal did not open');const result={comparisons:modal.querySelectorAll('.em-diff pre').length,callsBeforeClick:window.__emUXConfirmCalls,cancel:[...modal.querySelectorAll('button')].some(b=>b.textContent==='Abbrechen')};[...modal.querySelectorAll('button')].find(b=>b.textContent==='Abbrechen').click();return {...result,callsAfterClose:window.__emUXConfirmCalls};})()`);
assert(report.confirmation.comparisons===2&&report.confirmation.cancel&&report.confirmation.callsBeforeClick===0&&report.confirmation.callsAfterClose===0,'Confirmation modal permits writes without an explicit click');

report.theme=evaluate(`(()=>{const v=${view},p=v.contentEl.createSpan();p.style.color='var(--text-normal)';p.style.backgroundColor='var(--background-primary)';const out={normal:getComputedStyle(p).color,background:getComputedStyle(p).backgroundColor};p.style.color='var(--text-muted)';out.muted=getComputedStyle(p).color;p.remove();return out;})()`);
const luminance=color=>{const values=color.match(/[\d.]+/g).slice(0,3).map(n=>{const v=Number(n)/255;return v<=0.04045?v/12.92:((v+0.055)/1.055)**2.4;});return values[0]*0.2126+values[1]*0.7152+values[2]*0.0722;};
const ratio=(a,b)=>{const x=luminance(a),y=luminance(b);return Number(((Math.max(x,y)+0.05)/(Math.min(x,y)+0.05)).toFixed(2));};
report.theme.normalContrast=ratio(report.theme.normal,report.theme.background);report.theme.mutedContrast=ratio(report.theme.muted,report.theme.background);
report.configurationUnchanged=before===evaluate('JSON.stringify(app.plugins.plugins.Emergence.settings)');report.breadcrumbsUnchanged=bcBefore===hash();report.notesWritten=0;
assert(report.configurationUnchanged&&report.breadcrumbsUnchanged,'UX checks changed stored settings');
mkdirSync('docs/ux',{recursive:true});writeFileSync('docs/ux/checks.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));

} finally {
 evaluate(`(()=>{const v=${view};if(window.__emUXOldInquiry)v.state.inquiry=window.__emUXOldInquiry;if(window.__emUXOldStatus!==undefined)v.controller.status=window.__emUXOldStatus;if('__emUXPreviousAnalysis' in window){if(window.__emUXPreviousAnalysis)v.controller.review.set(window.__emUXPreviousAnalysis);else v.controller.review.clear();}if(window.__emUXRealPreview)v.controller.writer.preview=window.__emUXRealPreview;if(window.__emUXRealApply)v.controller.writer.apply=window.__emUXRealApply;const modal=activeDocument.querySelector('.em-confirm-modal');if(modal)[...modal.querySelectorAll('button')].find(b=>b.textContent==='Abbrechen')?.click();const t=${settings};if(t?.draft)t.display();app.setting.close();v.switchTab('graph');for(const key of Object.keys(window).filter(k=>k.startsWith('__emUX')))delete window[key];return true;})()`);
}
