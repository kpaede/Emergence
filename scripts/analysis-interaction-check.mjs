import {writeFileSync} from 'node:fs';
import {evaluate} from './obsidian-cli.mjs';

// Exercise real controls. No note reads/writes or model generations; health check is metadata only.
const view = 'app.workspace.getLeavesOfType("emergence-workspace")[0].view';
const assert = (ok, message) => {if (!ok) throw new Error(message);};
const report = {};
try {
 report.refresh = evaluate(`(()=>{const v=${view},c=v.controller;if(c.abort)throw new Error('Eine Modellanfrage läuft bereits.');
  window.__emInteractions={ui:JSON.parse(JSON.stringify(v.state)),status:c.status,settings:JSON.stringify(c.settings()),blockers:c.assignmentBlockers,analyze:c.analyze,
   opened:Object.fromEntries([...v.contentEl.querySelectorAll('details[data-em-disclosure]')].map(d=>[d.dataset.emDisclosure,d.open]))};
  v.state.analysis.profileDrafts={};v.switchTab('analysis');const panel=v.contentEl.querySelector('.em-panel-analysis');for(const d of panel.querySelectorAll('details[data-em-disclosure]'))d.open=true;
  const selected=panel.querySelectorAll('[data-em-field]').length;v.update(true);const fresh=v.contentEl.querySelector('.em-panel-analysis');
  return {allExpanded:[...fresh.querySelectorAll('details[data-em-disclosure]')].every(d=>d.open),selectedBefore:selected,selectedAfter:fresh.querySelectorAll('[data-em-field]').length};})()`);
 assert(report.refresh.allExpanded && report.refresh.selectedBefore === report.refresh.selectedAfter, 'Refresh lost disclosure or field state');
 report.pointer = evaluate(`(()=>{const v=${view},c=v.controller,b=[...v.contentEl.querySelectorAll('button')].find(b=>b.textContent==='Ollama-Verbindung prüfen');
  if(!b||b.disabled)throw new Error('Connection action disabled');b.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true}));c.status='UI-Teststatus';c.notify();
  const survived=b.isConnected;b.dispatchEvent(new PointerEvent('pointerup',{bubbles:true}));b.click();return {pressedControlSurvived:survived};})()`);
 assert(report.pointer.pressedControlSurvived, 'Notification removed a pressed button');
 for(let attempt=0;attempt<80;attempt++) {
  const state = evaluate(`(()=>{const v=${view},r=v.contentEl.querySelector('.em-connection-result');return {status:r?.dataset.status,open:v.contentEl.querySelector('[data-em-disclosure="analysis-diagnostics"]')?.open};})()`);
  if(state.status==='success'||state.status==='error'){report.connection=state;break;}
 }
 assert(report.connection?.status==='success'&&report.connection.open, 'Connection test did not show a visible successful result');
 report.preview = evaluate(`(()=>{const v=${view},c=v.controller,previous=c.assignmentBlockers;
  try {c.assignmentBlockers=()=>[{kind:'fields',message:'Für den UI-Test fehlt die Einrichtung.'}];v.update(true);const p=v.contentEl.querySelector('.em-panel-analysis'),b=[...p.querySelectorAll('button')].find(b=>b.textContent==='Anfragevorschau öffnen');
   const enabled=!!b&&!b.disabled;b?.click();const modal=v.contentEl.ownerDocument.querySelector('.em-inspect-modal');
   const result={enabled,opened:!!modal,explainsMissingSetup:!!modal?.textContent.includes('Noch nicht sendebereit')};
   const close=[...modal?.querySelectorAll('button')??[]].find(b=>b.textContent==='Schließen');close?.click();return result;
  }finally{c.assignmentBlockers=previous;v.update(true);}})()`);
 assert(Object.values(report.preview).every(Boolean), 'Preview does not explain incomplete setup');
 report.start = evaluate(`(()=>{const v=${view},c=v.controller;let calls=0;c.assignmentBlockers=()=>[];c.analyze=async()=>{calls++;};
  try {v.update(true);const b=[...v.contentEl.querySelectorAll('button')].find(b=>b.textContent==='Ideen vorschlagen');
   if(!b||b.disabled)throw new Error('Start action disabled');b.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}));c.status='Noch ein UI-Teststatus';c.notify();
   const survived=b.isConnected;b.dispatchEvent(new KeyboardEvent('keyup',{key:'Enter',bubbles:true}));b.click();return {pressedControlSurvived:survived,actionReached:calls===1};
  }finally{c.assignmentBlockers=window.__emInteractions.blockers;c.analyze=window.__emInteractions.analyze;v.update(true);}})()`);
 assert(report.start.pressedControlSurvived && report.start.actionReached, 'Start click was lost');
 report.final = evaluate(`(()=>{const v=${view},p=v.contentEl.querySelector('.em-panel-analysis');return {selected:p.querySelectorAll('[data-em-field]').length,settingsUnchanged:window.__emInteractions.settings===JSON.stringify(v.controller.settings()),width:p.clientWidth,scrollWidth:p.scrollWidth,modelRunning:!!v.controller.abort,notesWritten:0};})()`);
 assert(report.final.settingsUnchanged&&!report.final.modelRunning&&report.final.width>=report.final.scrollWidth-1,'UI test changed settings or overflowed');
 writeFileSync('docs/analysis-interaction-check.json',JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify(report,null,2));
} finally {
 evaluate(`(()=>{const v=${view},c=v.controller,s=window.__emInteractions;if(!s)return true;
  c.assignmentBlockers=s.blockers;c.analyze=s.analyze;const result={connection:v.state.analysis.connection,connectionMessage:v.state.analysis.connectionMessage};
  v.state=s.ui;Object.assign(v.state.analysis,result);c.status=s.status;v.switchTab('analysis');for(const d of v.contentEl.querySelectorAll('details[data-em-disclosure]'))if(d.dataset.emDisclosure in s.opened)d.open=s.opened[d.dataset.emDisclosure];const options=v.contentEl.querySelector('[data-em-disclosure="analysis-diagnostics"]');if(options)options.open=true;
  delete window.__emInteractions;return true;})()`);
}
