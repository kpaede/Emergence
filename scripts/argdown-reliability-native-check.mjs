import {resolve} from 'node:path';
import {mkdirSync,writeFileSync} from 'node:fs';
import {command,evaluate,reloadPlugin} from './obsidian-cli.mjs';
if(command('vault',['info=path'])!==resolve('../../..'))throw Error('Wrong vault.');
reloadPlugin();
async function check(out){
 const plugin=app.plugins.plugins.emergence,v=app.workspace.getLeavesOfType('emergence-workspace')[0].view,p=v.argdownPanel,w=require('@electron/remote').getCurrentWindow(),wc=w.webContents;
 const saved={source:p.source,binding:p.binding,history:p.history,selected:[...p.selected],tab:v.tab,focus:p.focus,style:v.contentEl.style.cssText,parent:v.contentEl.parentElement,next:v.contentEl.nextSibling,active:app.workspace.activeLeaf,path:v.controller.activePath,bg:wc.getBackgroundThrottling(),files:app.vault.getFiles().length,settings:JSON.stringify(plugin.settings),library:JSON.stringify(plugin.argdownLibrary.snapshot())};
 const checks=window.__emArgReliabilityProgress={},wait=ms=>new Promise(r=>setTimeout(r,ms)),assert=(name,value)=>{checks[name]=!!value;if(!value)throw Error(name+' | '+p.error.textContent);};
 const render=async()=>{await wait(0);await p.render();await wait(70);},draft=async text=>{await p.newDraft(text);await wait(70);};
 const movePoint=async(x,y)=>{wc.sendInputEvent({type:'mouseMove',x:Math.round(x),y:Math.round(y)});await wait(70);};
 const rect=key=>{const el=p.diagram.element(key);return el.querySelector(':scope > text')?.getBoundingClientRect()??el.querySelector('text')?.getBoundingClientRect()??el.getBoundingClientRect();};
 const hover=async key=>{const r=rect(key);await movePoint(r.x+r.width/2,r.y+r.height/2);};
 const statement=index=>[...p.model.response.emergenceDerivation.statements].find(([,roles])=>roles.some(role=>role.argument==='A'&&role.index===index))[0];
 const edge=(from,to,kind)=>p.model.edges.some(e=>(e.from.type==='argument-map-node'?'a:':'s:')+e.from.title===from&&(e.to.type==='argument-map-node'?'a:':'s:')+e.to.title===to&&e.relationType===kind);
 const pointer=(el,type,x,y)=>el.dispatchEvent(new PointerEvent(type,{bubbles:true,cancelable:true,button:0,buttons:type==='pointerup'?0:1,clientX:x,clientY:y}));
 const drag=async(from,to,kind)=>{await wait(270);await hover(from);const handle=p.overlay.querySelector('[data-argdown-connect="'+from+'"][data-argdown-relation="'+kind+'"]'),r=handle.getBoundingClientRect(),q=rect(to),x=q.x+q.width/2,y=q.y+q.height/2;pointer(handle,'pointerdown',r.x+r.width/2,r.y+r.height/2);pointer(document,'pointermove',x,y);pointer(document,'pointerup',x,y);await render();};
 try{
  wc.setBackgroundThrottling(false);document.body.append(v.contentEl);v.contentEl.style.cssText=`position:fixed;left:0;top:0;width:${Math.min(1080,innerWidth-24)}px;height:${Math.min(850,innerHeight-24)}px;z-index:30;background:var(--background-primary)`;v.switchTab('argdown');await p.activate();
  const base='<A>: Reasoning.\n\n(1) First premise. {custom: 42}\n(2) [Named]: Second premise.\n----\n(3) Result.';await draft(base);p.reconstruct('a:A');await render();
  for(const width of [1000,328]){
   v.contentEl.style.width=Math.min(width,innerWidth-24)+'px';await wait(100);p.diagram.fit();p.interactions.paint();await wait(70);
   for(const side of ['first','last']){
    await hover('a:A');const node=rect('a:A'),toolbar=p.toolbar.getBoundingClientRect(),buttons=p.toolbar.querySelectorAll('button'),button=side==='first'?buttons[0]:buttons[buttons.length-1],target=button.getBoundingClientRect(),sx=node.x+node.width/2,sy=node.y+node.height/2,tx=target.x+target.width/2,ty=target.y+target.height/2;
    const below=toolbar.top>=node.bottom,near=below?toolbar.top:toolbar.bottom,origin=below?node.bottom:node.top,my=(near+origin)/2,f=(my-sy)/(ty-sy),mx=sx+(tx-sx)*f;
    assert('realGapExists-'+width+'-'+side,Math.abs(near-origin)>2);await movePoint(mx,my);await wait(1100);assert('pauseInGapKeepsOriginalToolbar-'+width+'-'+side,!p.toolbar.hidden&&button.isConnected&&p.hovered==='a:A');
    for(let step=1;step<=12;step++){wc.sendInputEvent({type:'mouseMove',x:Math.round(mx+(tx-mx)*step/12),y:Math.round(my+(ty-my)*step/12)});await wait(70);assert('slowDiagonalKeepsOwner-'+width+'-'+side+'-'+step,!p.toolbar.hidden&&button.isConnected&&p.hovered==='a:A');}
    await wait(350);assert('controlsRemainUsable-'+width+'-'+side,!p.toolbar.hidden&&button.isConnected);
   }
   await hover('a:A');const edit=p.toolbar.querySelector('[aria-label="Schlussregel bearbeiten"]'),r=edit.getBoundingClientRect();await movePoint(r.x+r.width/2,r.y+r.height/2);wc.sendInputEvent({type:'mouseDown',x:Math.round(r.x+r.width/2),y:Math.round(r.y+r.height/2),button:'left',clickCount:1});wc.sendInputEvent({type:'mouseUp',x:Math.round(r.x+r.width/2),y:Math.round(r.y+r.height/2),button:'left',clickCount:1});await wait(70);const dialog=[...p.dialogs][0];assert('actualToolbarClickEditsCorrectInference-'+width,dialog?.titleEl.textContent==='Schlussregel bearbeiten');dialog.close();
   const empty=p.preview.getBoundingClientRect();await movePoint(empty.right-10,empty.bottom-10);assert('leavingProtectedRegionHidesToolbar-'+width,p.toolbar.hidden);
  }
  v.contentEl.style.width=Math.min(1080,innerWidth-24)+'px';await wait(100);p.diagram.fit();p.interactions.paint();
  await drag(statement(0),'s:Named','attack');assert('namedInternalStatementConnectsWithoutWarning',!p.error.textContent&&edge('s:Named',statement(0),'attack'));assert('namedStatementIsNotRenamed',p.source.includes('(2) [Named]: Second premise.')&&!p.source.includes('[Aussage 1]:'));p.undo();await render();assert('namedConnectionUndoIsAtomic',p.source===base);
  await drag('s:Named',statement(0),'attack');assert('anonymousStatementIsNamedAutomatically',p.source.includes('(1) [Aussage 1]: First premise. {custom: 42}'));assert('automaticReferenceAppearsAsRealAttack',edge('s:Aussage 1','s:Named','attack')&&!p.error.textContent);const connected=p.source;await drag('s:Named','s:Aussage 1','attack');assert('repeatedDropDoesNotDuplicateConnection',p.source===connected);p.undo();await render();assert('oneUndoRemovesBothNameAndArrow',p.source===base);
  await drag('a:A',statement(0),'undercut');assert('anonymousStatementCanUndercutInference',edge('s:Aussage 1','a:A','undercut')&&!p.error.textContent);p.undo();await render();assert('undercutUndoRestoresExactSource',p.source===base);
  await drag('s:Named','a:A','attack');assert('inferenceReferenceUsesItsConclusion',p.source.includes('(3) [Aussage 1]: Result.')&&edge('s:Aussage 1','s:Named','attack')&&!p.error.textContent);p.undo();await render();assert('inferenceReferenceUndoIsAtomic',p.source===base);
  assert('noFilesCreated',app.vault.getFiles().length===saved.files);assert('settingsUnchanged',JSON.stringify(plugin.settings)===saved.settings);assert('libraryUnchanged',JSON.stringify(plugin.argdownLibrary.snapshot())===saved.library);assert('noPopupLeftOpen',!p.menu?.presenter?.isShown);return {checks,count:Object.keys(checks).length};
 }finally{
  p.menu?.hide();p.connectionMenu.hide();for(const dialog of p.dialogs)dialog.close();await p.flush().catch(()=>{});p.binding?.dispose();p.binding=undefined;if(saved.binding)await p.openBlock(saved.binding.file,saved.binding.index);else await p.newDraft(saved.source);if(saved.focus){p.reconstruct('a:'+saved.focus);await render();}if(p.source===saved.source)p.history=saved.history;p.select(saved.selected);saved.parent.insertBefore(v.contentEl,saved.next?.parentNode===saved.parent?saved.next:null);v.contentEl.style.cssText=saved.style;v.switchTab(saved.tab);v.controller.activePath=saved.path;if(saved.active)app.workspace.setActiveLeaf(saved.active,{focus:false});wc.setBackgroundThrottling(saved.bg);
 }
}
const out=resolve('docs/argdown');mkdirSync(out,{recursive:true});evaluate(`(()=>{window.__emArgdownReliability={done:false};(${check.toString()})(${JSON.stringify(out)}).then(report=>window.__emArgdownReliability={done:true,report}).catch(e=>window.__emArgdownReliability={done:true,failure:e.stack,checks:window.__emArgReliabilityProgress});return true})()`);
let result;for(let i=0;i<300;i++){result=evaluate('window.__emArgdownReliability');if(result.done)break;await new Promise(r=>setTimeout(r,100));}if(!result?.done||result.failure)throw Error(JSON.stringify(result));writeFileSync(out+'/reliability-check.json',JSON.stringify(result.report,null,2)+'\n');console.log(JSON.stringify(result.report,null,2));evaluate('(()=>{delete window.__emArgdownReliability;delete window.__emArgReliabilityProgress;return true})()');
