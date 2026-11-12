import {mkdirSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {command,evaluate,reloadPlugin} from './obsidian-cli.mjs';
if(command('vault',['info=path'])!==resolve('../../..'))throw Error('Wrong vault.');
reloadPlugin();
async function check(out){
 const plugin=app.plugins.plugins.emergence,v=app.workspace.getLeavesOfType('emergence-workspace')[0].view,p=v.argdownPanel,w=require('@electron/remote').getCurrentWindow(),wc=w.webContents;
 const saved={tab:v.tab,source:p.source,binding:p.binding,history:p.history,selected:[...p.selected],focus:p.focus,editor:p.editor.view.state,settings:JSON.stringify(plugin.settings),files:app.vault.getFiles().length,bg:wc.getBackgroundThrottling()};
 const checks={},assert=(name,value)=>{checks[name]=!!value;if(!value)throw Error(name+' | '+p.error.textContent);},wait=ms=>new Promise(r=>setTimeout(r,ms));
 const body='[Thesis]: Main claim.\n  + <Reason>: Supporting reason.',button=()=>p.stage.querySelector('[aria-label="Pfeilrichtung der Argumentkarte"],[aria-label="Argument map arrow direction"]');
 const open=()=>{const b=button(),r=b.getBoundingClientRect();b.dispatchEvent(new MouseEvent('click',{bubbles:true,clientX:r.x+r.width/2,clientY:r.y+r.height/2}));return p.menu.items.filter(item=>/\((TB|BT|LR|RL)\)$/u.test(item.titleEl?.textContent??''));};
 const marked=item=>item.checked===true||item.dom?.classList.contains('is-checked')||item.titleEl?.closest('.menu-item')?.classList.contains('is-checked');
 const current=()=>open().filter(marked).map(item=>/\((TB|BT|LR|RL)\)$/u.exec(item.titleEl.textContent)[1]);
 const point=key=>{const rect=p.diagram.element(key).getBoundingClientRect();return {x:rect.x+rect.width/2,y:rect.y+rect.height/2};};
 try{
  wc.setBackgroundThrottling(false);v.switchTab('argdown');await p.newDraft(body);await p.render();await wait(70);
  assert('nativeDefaultBTIsChecked',JSON.stringify(current())===JSON.stringify(['BT']));const original=p.source,history=p.history;const initial=open().find(item=>item.titleEl.textContent.endsWith('(BT)'));p.menu.hide();initial.callback(new MouseEvent('click'));await wait(30);assert('choosingCheckedDefaultDoesNotRewriteSource',p.source===original&&p.history===history&&!p.history.canUndo);
  for(const direction of ['TB','BT','LR','RL']){
   const item=open().find(item=>item.titleEl.textContent.endsWith('('+direction+')'));p.menu.hide();item.callback(new MouseEvent('click'));await wait(40);await p.render();await wait(40);
   const reason=point('a:Reason'),claim=point('s:Thesis');assert('actualArrowDirection-'+direction,direction==='TB'?reason.y<claim.y:direction==='BT'?reason.y>claim.y:direction==='LR'?reason.x<claim.x:reason.x>claim.x);assert('onlyCurrentDirectionChecked-'+direction,JSON.stringify(current())===JSON.stringify([direction]));p.menu.hide();assert('relationUnchanged-'+direction,p.model.edges.some(edge=>edge.from.title==='Reason'&&edge.to.title==='Thesis'&&edge.relationType==='support'));
  }
  p.undo();await p.render();assert('undoRestoresPreviousDirectionAndCheck',JSON.stringify(current())===JSON.stringify(['LR']));p.menu.hide();p.redo();await p.render();assert('redoRestoresDirectionAndCheck',JSON.stringify(current())===JSON.stringify(['RL']));p.menu.hide();
  await p.newDraft('===\ndot:\n  graphVizSettings:\n    rankdir: TB\n===\n\n'+body);await p.render();assert('sourceConfigurationDeterminesCheck',JSON.stringify(current())===JSON.stringify(['TB']));p.menu.hide();
  assert('settingsUnchanged',JSON.stringify(plugin.settings)===saved.settings);assert('noFilesCreated',app.vault.getFiles().length===saved.files);
  const r=button().getBoundingClientRect();button().dispatchEvent(new MouseEvent('click',{bubbles:true,clientX:r.x,clientY:r.bottom}));await wait(60);wc.invalidate();await wait(40);const bounds=p.root.getBoundingClientRect();require('fs').writeFileSync(out+'/direction-menu.png',(await w.capturePage({x:Math.round(bounds.x),y:Math.round(bounds.y),width:Math.round(bounds.width),height:Math.min(Math.round(bounds.height),w.getContentBounds().height-Math.round(bounds.y))})).toPNG());p.menu.hide();
  return {checks,count:Object.keys(checks).length};
 }finally{
  p.menu?.hide();await p.flush();p.binding?.dispose();p.binding=undefined;if(saved.binding)await p.openBlock(saved.binding.file,saved.binding.index);else await p.newDraft(saved.source);if(saved.focus){p.reconstruct('a:'+saved.focus);await p.render();}if(p.source===saved.source){p.history=saved.history;p.editor.view.setState(saved.editor);}p.select(saved.selected);p.hover();v.switchTab(saved.tab);wc.setBackgroundThrottling(saved.bg);
 }
}
const out=resolve('docs/argdown');mkdirSync(out,{recursive:true});evaluate(`(()=>{window.__emArgdownDirection={done:false};(${check.toString()})(${JSON.stringify(out)}).then(report=>window.__emArgdownDirection={done:true,report}).catch(error=>window.__emArgdownDirection={done:true,failure:error.stack});return true})()`);
let result;for(let i=0;i<300;i++){result=evaluate('window.__emArgdownDirection');if(result.done)break;await new Promise(r=>setTimeout(r,100));}if(!result?.done||result.failure)throw Error(JSON.stringify(result));writeFileSync(out+'/direction-check.json',JSON.stringify(result.report,null,2)+'\n');console.log(JSON.stringify(result.report,null,2));evaluate('delete window.__emArgdownDirection');
