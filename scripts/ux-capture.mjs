import {execFileSync} from 'node:child_process';
import {command,evaluate} from './obsidian-cli.mjs';
const view='app.workspace.getLeavesOfType("emergence-workspace")[0].view';
const capture=(name,settings=false)=>execFileSync(process.execPath,['scripts/ux-screenshot.mjs',...(settings?['--settings']:[]),`docs/ux/after-${name}.png`],{stdio:'pipe',timeout:30000});
command('command',['id=emergence:open-workspace']);
try {
 for(const tab of ['graph','analysis','search']) {
  evaluate(`(()=>{app.setting.close();${view}.switchTab('${tab}');return true;})()`);capture(tab);
 }
 console.log('Aktuelle Hauptansichten lokal aufgenommen; Settingsprüfung siehe test:ux.');
}finally {
 evaluate(`(()=>{if('__emUXCapturePrevious' in window){if(window.__emUXCapturePrevious)${view}.controller.review.set(window.__emUXCapturePrevious);else ${view}.controller.review.clear();}delete window.__emUXCapturePrevious;app.setting.close();${view}.switchTab('graph');return true;})()`);
}
