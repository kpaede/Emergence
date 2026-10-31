import {execFileSync} from 'node:child_process';
import {command,evaluate} from './obsidian-cli.mjs';
const view='app.workspace.getLeavesOfType("emergence-workspace")[0].view';
const capture=(name,settings=false)=>execFileSync(process.execPath,['scripts/ux-screenshot.mjs',...(settings?['--settings']:[]),`docs/ux/after-${name}.png`],{stdio:'pipe',timeout:30000});
command('command',['id=Emergence:open-workspace']);
try {
 for(const tab of ['graph','analysis','inquiry','registry','review']) {
  evaluate(`(()=>{app.setting.close();${view}.switchTab('${tab}');return true;})()`);capture(tab);
 }
 evaluate(`(()=>{window.__emUXCapturePrevious=${view}.controller.review.analysis;const c=${view}.controller;c.review.set({id:'ui-capture',source:'UI-Demonstration.md',sourceVersion:'ui-only',suggestions:[0,1,2].map(i=>({id:'ui-capture-'+i,analysisId:'ui-capture',source:'UI-Demonstration.md',sourceVersion:'ui-only',operation:'add',target:['Ontologie.md','Wahrnehmung.md','Kunst und Erkenntnis.md'][i],targetKind:'unresolved',field:c.graph.snapshot.fields[0],property:c.graph.snapshot.fields[0],value:'[[Ontologie]]',reason:'Beispiel für einen begründeten Vorschlag. Keine echte Analyse oder freigabefähige Änderung.',evidence:'Synthetischer UI-Testbeleg',confidence:'medium',status:'pending',outputId:'relations'})),candidates:[],artifacts:[],completed:1,total:1,status:'complete',errors:[]});${view}.switchTab('review');return true;})()`);capture('review-populated');
 evaluate(`(()=>{if(window.__emUXCapturePrevious)${view}.controller.review.set(window.__emUXCapturePrevious);else ${view}.controller.review.clear();app.setting.open();app.setting.openTabById('Emergence');return true;})()`);
 for(const section of ['model','relations','profiles','data']) {
  evaluate(`(()=>{const t=app.setting.pluginTabs.find(t=>t.id==='Emergence');t.section='${section}';t.renderBody();return true;})()`);capture(`settings-${section}`,true);
 }
 evaluate(`(()=>{const t=app.setting.pluginTabs.find(t=>t.id==='Emergence');t.section='profiles';t.profileEditor.section='prompts';t.renderBody();return true;})()`);capture('settings-prompts',true);
 console.log('Alle Ansichten und Einstellungsbereiche lokal aufgenommen.');
}finally {
 evaluate(`(()=>{if('__emUXCapturePrevious' in window){if(window.__emUXCapturePrevious)${view}.controller.review.set(window.__emUXCapturePrevious);else ${view}.controller.review.clear();}delete window.__emUXCapturePrevious;app.setting.close();${view}.switchTab('graph');return true;})()`);
}
