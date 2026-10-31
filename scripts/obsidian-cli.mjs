import {execFileSync} from 'node:child_process';
export const cli = process.env.OBSIDIAN_CLI ?? '/Applications/Obsidian.app/Contents/MacOS/Obsidian';
export const command = (name, args = []) => execFileSync(cli, [...(process.env.OBSIDIAN_VAULT ? ['vault=' + process.env.OBSIDIAN_VAULT] : []), name, ...args], {encoding: 'utf8', timeout: 30000}).trim();
export function evaluate(code) {
 command('eval', ['code=window.__emergenceUX=null']);
 let text = command('eval', [`code=window.__emergenceUX=JSON.stringify((()=>{try{return (${code});}catch(e){return {error:String(e)};}})())`]);
 for (let i=0;i<30&&(!text.includes('=> ')||text.endsWith('=> null'));i++) text=command('eval',['code=window.__emergenceUX']);
 if(!text.includes('=> ')) throw new Error('No CLI result: '+code.slice(0,70));
 const value=JSON.parse(text.slice(text.lastIndexOf('=> ')+3)); if(value?.error) throw new Error(value.error); return value;
}
/** Preserve the user's form, expanded sections and field choices across a development reload. */
export function reloadPlugin() {
 evaluate(`(()=>{const c=app.plugins.plugins.emergence?.controller;if(c?.abort)throw new Error('Eine Modellanfrage läuft noch.');window.__emReloadWait={done:false};Promise.all([c?.fieldSelectionSave,c?.profilePromptSave,app.workspace.getLeavesOfType('emergence-workspace')[0]?.view?.graphPanel?.depthSave]).then(()=>window.__emReloadWait={done:true}).catch(e=>window.__emReloadWait={done:true,error:String(e)});return true;})()`);
 let idle=false;
 for(let attempt=0;attempt<60;attempt++){const state=evaluate('window.__emReloadWait');if(state.done){if(state.error)throw new Error(state.error);idle=true;break;}}
 if(!idle)throw new Error('Field selection save is still pending; reload cancelled.');
 evaluate(`(()=>{const c=app.plugins.plugins.emergence?.controller,v=app.workspace.getLeavesOfType('emergence-workspace')[0]?.view,opened={};
 if(v)for(const d of v.contentEl.querySelectorAll('.em-panel-analysis details')){const label=d.querySelector('summary')?.textContent??'';const key=d.dataset.emDisclosure||(label.startsWith('Breadcrumbs-Felder')?'analysis-fields':label.startsWith('Feldbedeutungen')?'analysis-descriptions':label.startsWith('Zielnotizen')?'analysis-scope':label==='Verbindung und Anfrage prüfen'?'analysis-diagnostics':'');if(key)opened[key]=d.open;}
 const ui=v?.state?JSON.parse(JSON.stringify(v.state)):null;if(ui?.analysis?.connection==='checking'){delete ui.analysis.connection;delete ui.analysis.connectionMessage;}
 window.__emReloadState={analysis:c?.review.analysis?JSON.parse(JSON.stringify(c.review.analysis)):null,status:c?.status,inquiryHistory:c?.inquiryHistory?JSON.parse(JSON.stringify(c.inquiryHistory)):[],research:c?.research??'',ui,tab:v?.tab,opened,scroll:v?.panels.get(v.tab)?.scrollTop??0,
 selections:c?.fieldSelections instanceof Map?Object.fromEntries(c.fieldSelections):c?.settings().assignment?.fieldsByNote??{}};return true;})()`);
 command('plugin:reload', ['id=emergence']);
 let ready = false;
 for(let attempt=0;attempt<60;attempt++) if(evaluate('!!app.plugins.plugins.emergence?.controller')) {ready=true;break;}
 if(!ready) throw new Error('Emergence did not finish loading; the prior state remains in window.__emReloadState.');
 command('command', ['id=emergence:open-workspace']);
 evaluate(`(()=>{const c=app.plugins.plugins.emergence.controller,s=window.__emReloadState,v=app.workspace.getLeavesOfType('emergence-workspace')[0].view;
 if(s?.analysis){c.review.set(s.analysis);for(const idea of s.analysis.suggestions)if(idea.status==='rejected')c.review.decide(idea.id,'rejected',c.graph.snapshot,'',c.profile);}if(s?.status)c.status=s.status;
 if(s?.inquiryHistory)c.inquiryHistory=s.inquiryHistory;if(s?.research)c.research=s.research;
 if(s?.selections)c.settings().assignment.fieldsByNote={...c.settings().assignment.fieldsByNote,...s.selections};
 if(s?.ui)v.state={...v.state,...s.ui,search:s.ui.search??{query:'',mode:'open'}};v.switchTab(s?.tab??'graph');
 for(const [key,open]of Object.entries(s?.opened??{})){const box=[...v.contentEl.querySelectorAll('details[data-em-disclosure]')].find(d=>d.dataset.emDisclosure===key);if(box)box.open=open;}
 const panel=v.panels.get(v.tab);if(panel)panel.scrollTop=s?.scroll??0;c.notify();delete window.__emReloadState;delete window.__emReloadWait;return true;})()`);
}
