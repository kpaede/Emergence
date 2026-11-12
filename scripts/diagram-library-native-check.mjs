import {resolve} from 'node:path';
import {mkdirSync, writeFileSync} from 'node:fs';
import {command, evaluate, reloadPlugin} from './obsidian-cli.mjs';
if (command('vault', ['info=path']) !== resolve('../../..')) throw Error('Wrong vault.');
reloadPlugin();
async function check(out) {
 const plugin=app.plugins.plugins.emergence,v=app.workspace.getLeavesOfType('emergence-workspace')[0].view,w=require('@electron/remote').getCurrentWindow(),wc=w.webContents;
 const wait=ms=>new Promise(r=>setTimeout(r,ms)),checks=window.__emDiagramLibraryProgress={},assert=(name,value)=>{checks[name]=!!value;if(!value)throw Error(name);};
 const panels=[['mermaid',v.mermaidPanel],['argdown',v.argdownPanel]],saved={tab:v.tab,parent:v.contentEl.parentElement,next:v.contentEl.nextSibling,style:v.contentEl.style.cssText,bg:wc.getBackgroundThrottling(),active:app.workspace.activeLeaf,path:v.controller.activePath,files:app.vault.getFiles().length,settings:JSON.stringify(plugin.settings),libraries:panels.map(([,p])=>({library:p.libraryMenu.library,data:p.libraryMenu.library.snapshot(),previous:p.libraryMenu.library.previous,source:p.source,history:p.history,selection:[...p.selected]}))};
 const shot=async(name,el)=>{wc.invalidate();await wait(100);const r=el.getBoundingClientRect();require('fs').writeFileSync(out+'/'+name,(await w.capturePage({x:Math.round(r.x),y:Math.round(r.y),width:Math.round(r.width),height:Math.round(r.height)})).toPNG());};
 try {
  wc.setBackgroundThrottling(false);document.body.append(v.contentEl);v.contentEl.style.cssText=`position:fixed;left:0;top:0;width:${Math.min(950,innerWidth-24)}px;height:${Math.min(850,innerHeight-24)}px;z-index:30;background:var(--background-primary)`;
  const triggers=panels.map(([,p])=>p.root.querySelector('.em-mm-new'));
  assert('identicalTextOnlyNewButtons',triggers[0].outerHTML===triggers[1].outerHTML&&triggers[0].textContent==='Neu'&&!triggers[0].querySelector('svg'));
  const fresh=new plugin.mermaidLibrary.constructor(undefined,async()=>{});assert('flowchartAndMindmapAreDefaultFavoriteTemplates',fresh.snapshot().favorites.join(',')==='starter-flowchart,starter-mindmap'&&fresh.list().length===60);
  for(const [name,p] of panels) {
   v.switchTab(name);await p.activate();const menu=p.libraryMenu,library=menu.library;menu.toggle();
   assert(name+'SingleListNoSpecialButtons',!menu.root.querySelector('.em-mm-library-fresh')&&menu.root.querySelectorAll('[data-template-open]').length===library.list().length);
   let first=menu.root.querySelector('[data-template-open]'),item=library.list().find(item=>item.id===first.dataset.templateOpen);
   first.focus();first.closest('[data-template-id]').dispatchEvent(new PointerEvent('pointerenter'));for(let i=0;i<40&&!menu.preview.root.querySelector('svg');i++)await wait(50);assert(name+'NativeHoverPreview',!!menu.root.querySelector('.em-mm-library-preview svg'));
   assert(name+'PreviewNamesTemplate',menu.root.querySelector('.em-mm-library-preview').getAttribute('aria-label')==='Vorschau: '+item.name);
   const originalPreview=menu.actions.preview;let finish;
   try {
    menu.actions.preview=()=>new Promise(resolve=>finish=resolve);menu.preview.clear();menu.preview.cache.clear();menu.preview.show({id:'delayed',name:'Delayed',source:item.source});await wait(150);
    menu.actions.preview=async()=>'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 50 20"><text>Current</text></svg>';menu.preview.show({id:'current',name:'Current',source:'different source'});await wait(160);finish('<svg xmlns="http://www.w3.org/2000/svg"><text>Late</text></svg>');await wait(0);
    assert(name+'LatePreviewCannotReplaceHoveredItem',menu.preview.root.textContent==='Current');
   } finally {menu.actions.preview=originalPreview;menu.preview.clear();menu.preview.cache.clear();}
   const before=library.isFavorite(item.id);await library.favorite(item.id);assert(name+'FavoritePersists',library.isFavorite(item.id)!==before&&(await plugin.loadData())[name+'Library'].favorites.includes(item.id)!==before);await library.favorite(item.id);
   await library.add('Bibliothekstest '+name,item.source);const own=library.list().find(t=>t.name==='Bibliothekstest '+name);await library.favorite(own.id);
   assert(name+'FavoriteSortedAtTop',menu.root.querySelector('[data-template-open]').dataset.templateOpen===own.id);
   await library.remove(own.id);await library.undo();assert(name+'DeleteUndoRestoresFavorite',library.isFavorite(own.id)&&library.list().some(t=>t.id===own.id));
   const ownButton=menu.root.querySelector('[data-template-open="'+own.id+'"]');ownButton.focus();ownButton.dispatchEvent(new FocusEvent('focus'));await wait(400);await shot(name+'-favorites-preview.png',menu.root);
   menu.hide();assert(name+'DismissClearsPreview',menu.preview.root.hidden);
   const snapshot=saved.libraries.find(value=>value.library===library);assert(name+'PreviewNeverChangesDocument',p.source===snapshot.source&&p.history===snapshot.history);
  }
  assert('noFilesCreated',app.vault.getFiles().length===saved.files);assert('settingsUnchanged',JSON.stringify(plugin.settings)===saved.settings);
  return {checks,count:Object.keys(checks).length};
 } finally {
  for(const [,p] of panels)p.libraryMenu.hide();for(const value of saved.libraries){await value.library.flush();value.library.data=value.data;value.library.previous=value.previous;value.library.notify();}await plugin.saveSettings();
  saved.parent.insertBefore(v.contentEl,saved.next?.parentNode===saved.parent?saved.next:null);v.contentEl.style.cssText=saved.style;v.switchTab(saved.tab);v.controller.activePath=saved.path;if(saved.active)app.workspace.setActiveLeaf(saved.active,{focus:false});wc.setBackgroundThrottling(saved.bg);
 }
}
const out=resolve('docs/diagrams');mkdirSync(out,{recursive:true});evaluate(`(()=>{window.__emDiagramLibrary={done:false};(${check.toString()})(${JSON.stringify(out)}).then(report=>window.__emDiagramLibrary={done:true,report}).catch(e=>window.__emDiagramLibrary={done:true,failure:e.stack,checks:window.__emDiagramLibraryProgress});return true})()`);
let result;for(let i=0;i<300;i++){result=evaluate('window.__emDiagramLibrary');if(result.done)break;await new Promise(r=>setTimeout(r,100));}if(!result?.done||result.failure)throw Error(JSON.stringify(result));writeFileSync(out+'/library-check.json',JSON.stringify(result.report,null,2)+'\n');console.log(JSON.stringify(result.report,null,2));evaluate('(()=>{delete window.__emDiagramLibrary;delete window.__emDiagramLibraryProgress;return true})()');
