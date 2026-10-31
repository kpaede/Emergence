import {writeFileSync} from 'node:fs';
import {evaluate} from './obsidian-cli.mjs';

// UI-only check. No file/metadata inventory, note reads, model calls or saves.
const report = evaluate(`(()=>{const v=app.workspace.getLeavesOfType('emergence-workspace')[0].view,c=v.controller;
 const saved=JSON.stringify(c.settings()),oldState=JSON.parse(JSON.stringify(v.state.analysis));
 try {
  v.switchTab('analysis');v.state.analysis.scopeOpen=true;v.update(true);
  let panel=v.contentEl.querySelector('.em-panel-analysis');
  const fields=panel.querySelectorAll('[data-em-field]').length;
  const select=panel.querySelector('[data-em-focus="Frontmatter"]');select.value='custom';select.dispatchEvent(new select.ownerDocument.defaultView.Event('change',{bubbles:true}));
  panel=v.contentEl.querySelector('.em-panel-analysis');const property=panel.querySelector('[data-em-focus="Frontmatter-Schlüssel (kommagetrennt)"]');
  if(!property)throw new Error('Frontmatter filter editor did not appear');
  property.value='UI-Test-Schlüssel';property.dispatchEvent(new property.ownerDocument.defaultView.Event('input',{bubbles:true}));
  v.state.analysis.descriptionsOpen=true;v.update(true);panel=v.contentEl.querySelector('.em-panel-analysis');
  const editor=[...panel.querySelectorAll('textarea')].find(e=>e.dataset.emFocus==='Bedeutung');
  if(!editor)throw new Error('Field description editor missing');editor.value='UI-Testbeschreibung als Entwurf';editor.dispatchEvent(new editor.ownerDocument.defaultView.Event('input',{bubbles:true}));
  v.switchTab('graph');v.switchTab('analysis');panel=v.contentEl.querySelector('.em-panel-analysis');
  const restored=[...panel.querySelectorAll('textarea')].find(e=>e.dataset.emFocus==='Bedeutung');
  const result={frontmatterFieldsVisible:fields>0,frontmatterFilter:true,descriptionDraftPreserved:restored?.value==='UI-Testbeschreibung als Entwurf',settingsUnchanged:saved===JSON.stringify(c.settings()),width:panel.clientWidth,scrollWidth:panel.scrollWidth,modelRunning:!!c.abort,notesWritten:0};
  if(!result.descriptionDraftPreserved||!result.settingsUnchanged||result.scrollWidth>result.width+1||result.modelRunning)throw new Error('Assignment UI check failed');return result;
 }finally{v.state.analysis=oldState;v.switchTab('analysis');}})()`);
writeFileSync('docs/assignment-ui.json', JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
