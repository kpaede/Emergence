import {writeFileSync,mkdirSync} from 'node:fs';
import {command,evaluate} from './obsidian-cli.mjs';
const phase=process.argv.includes('--before')?'before':'after';
mkdirSync('docs/ux',{recursive:true});
const v='app.workspace.getLeavesOfType("emergence-workspace")[0].view';
command('command',['id=Emergence:open-workspace']);
const report={};
for(const tab of ['graph','analysis','inquiry','registry','review']) {
 evaluate(`(()=>{${v}.switchTab('${tab}');return true;})()`);
 const metrics=evaluate(`(()=>{const v=${v},p=v.contentEl.querySelector('[role=tabpanel]:not([hidden])'),r=v.containerEl.getBoundingClientRect();return {width:p.clientWidth,height:p.clientHeight,scrollHeight:p.scrollHeight,scrollWidth:p.scrollWidth,buttons:p.querySelectorAll('button').length,rect:{x:r.x,y:r.y,width:r.width,height:r.height}};})()`);
 report[tab]=metrics;
 const {rect}=metrics;

}
writeFileSync(`docs/ux/${phase}-audit.json`,JSON.stringify(report,null,2));
console.log(JSON.stringify(Object.fromEntries(Object.entries(report).map(([tab,m])=>[tab,{width:m.width,height:m.height,scrollHeight:m.scrollHeight,scrollWidth:m.scrollWidth,buttons:m.buttons,captureError:m.captureError} ])),null,2));
evaluate(`(()=>{${v}.switchTab('graph');return true;})()`);
