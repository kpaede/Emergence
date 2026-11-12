import {resolve} from 'node:path';
import {mkdirSync,writeFileSync} from 'node:fs';
import {command,evaluate,reloadPlugin} from './obsidian-cli.mjs';
if(command('vault',['info=path'])!==resolve('../../..'))throw Error('Wrong vault.');
reloadPlugin();
async function check(out){
 const plugin=app.plugins.plugins.emergence,v=app.workspace.getLeavesOfType('emergence-workspace')[0].view,p=v.mermaidPanel,menu=p.libraryMenu,library=menu.library,w=require('@electron/remote').getCurrentWindow(),wc=w.webContents;
 const saved={tab:v.tab,source:p.source,binding:p.binding,history:p.history,selected:[...p.selected],style:v.contentEl.style.cssText,bg:wc.getBackgroundThrottling(),files:app.vault.getFiles().length,leaf:app.workspace.activeLeaf,active:v.controller.activePath,library:library.snapshot(),previous:library.previous,settings:JSON.stringify(plugin.settings)};
 const file=saved.binding?.file,editor=file&&app.workspace.getLeavesOfType('markdown').map(l=>l.view).find(view=>view.file===file)?.editor,noteText=file?(editor?.getValue()??await app.vault.read(file)):null;
 let fixture,leaf;
 const checks=window.__emLibraryProgress={},wait=ms=>new Promise(r=>setTimeout(r,ms)),assert=(name,condition)=>{checks[name]=!!condition;if(!condition)throw Error(name+' | '+p.error.textContent+' | '+p.source);};
 const draft=async source=>{await p.newDraft(source);p.render();await wait(120);};
 const shot=async(name,el)=>{wc.invalidate();await wait(100);const r=el.getBoundingClientRect(),b=w.getContentBounds();require('fs').writeFileSync(out+'/'+name,(await w.capturePage({x:Math.round(r.x),y:Math.round(r.y),width:Math.round(r.width),height:Math.min(Math.round(r.height),b.height-Math.round(r.y))})).toPNG());};
 const title=id=>p.preview.querySelector('.pele-cluster[data-id="'+id+'"] .pele-cluster-label');
 const node=id=>p.preview.querySelector('.pele-node[data-id="'+id+'"]');
 const drag=async(origin,target)=>{p.select([origin]);const h=p.overlay.querySelector('[data-connect="'+origin+'"]'),r=h.getBoundingClientRect(),q=target.getBoundingClientRect(),x=q.x+q.width/2,y=q.y+q.height/2;h.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,cancelable:true,button:0,buttons:1,clientX:r.x+r.width/2,clientY:r.y+r.height/2}));document.dispatchEvent(new PointerEvent('pointermove',{bubbles:true,buttons:1,clientX:x,clientY:y}));const hint=p.overlay.querySelector('.em-mm-drop-label')?.textContent;document.dispatchEvent(new PointerEvent('pointerup',{bubbles:true,button:0,clientX:x,clientY:y}));p.render();await wait(100);return hint;};
 const settled=async()=>{await library.flush();for(let i=0;i<60&&menu.busy;i++)await wait(10);};
 const saveDialog=(text,render=true)=>{const modal=[...p.dialogs][0];modal.setValue(text);modal.contentEl.querySelector('.mod-cta').click();if(render)p.render();};
 try{
  wc.setBackgroundThrottling(false);v.switchTab('mermaid');await p.activate();v.contentEl.style.cssText=`position:fixed;left:0;top:0;width:${Math.min(700,innerWidth-24)}px;height:${Math.min(850,innerHeight-24)}px;z-index:99999;background:var(--background-primary)`;
  await draft('flowchart LR\n subgraph G[Quelle]\n direction TB\n A[Alpha] --> B[Beta]\n end\n subgraph H[Ziel]\n direction TB\n C[Gamma] --> D[Delta]\n end\n X[Einzelknoten]');
  p.select(['g:G']);assert('subgraphHasConnectionHandle',!!p.overlay.querySelector('[data-connect="g:G"]'));
  let hint=await drag('g:G',title('H'));assert('dragConnectsSubgraphs',p.model.edges.some(e=>e.start==='G'&&e.end==='H'));assert('dropHintNamesSubgraph',hint.includes('Subgraph')&&hint.includes('Ziel'));
  await drag('g:H',node('X'));assert('dragConnectsSubgraphToNode',p.model.edges.some(e=>e.start==='H'&&e.end==='X'));
  await drag('n:X',title('G'));assert('dragConnectsNodeToSubgraph',p.model.edges.some(e=>e.start==='X'&&e.end==='G'));
  assert('groupEdgesKeepChildMembership',p.model.subgraphs.find(g=>g.id==='G').nodes.includes('A')&&p.model.subgraphs.find(g=>g.id==='H').nodes.includes('C'));
  assert('groupEdgesKeepExplicitDirections',p.model.subgraphs.every(g=>g.dir==='TB'));await shot('subgraph-connections.png',p.root);
  const edgeCount=p.model.edges.length;p.undo();p.render();assert('subgraphConnectionUndo',p.model.edges.length===edgeCount-1);p.redo();p.render();assert('subgraphConnectionRedo',p.model.edges.length===edgeCount);
  await draft('flowchart LR\n A["`[[Notiz]]`"]\n B["`[Link](https://example.com)`"]\n C["`==Markiert==`"]\n D["![[Bild.png]]"]');assert('nativeWikiSyntaxIsLiteral',node('A').textContent==='[[Notiz]]'&&!node('A').querySelector('a'));assert('nativeMarkdownLinkIsLiteral',node('B').textContent==='[Link](https://example.com)'&&!node('B').querySelector('a'));assert('extendedObsidianSyntaxIsLiteral',node('C').textContent==='==Markiert=='&&node('D').textContent==='![[Bild.png]]');
  await draft('flowchart LR\n A["Original"]:::special --> B[Beta]\n style A fill:gold\n linkStyle 0 stroke:red');p.select(['n:A']);assert('nativeLinkActionAvailable',!!p.toolbar.querySelector('[aria-label="Knoten verlinken"]'));
  p.perform('link-note');saveDialog('[[Ordner/Notiz#Abschnitt|Alias]]');assert('noteLinkUsesNativeClass',node('A').querySelector('a.internal-link')?.getAttribute('data-href')==='Ordner/Notiz#Abschnitt');assert('noteLinkKeepsShapeClassesAndStyles',p.model.nodes.get('A').classes.includes('special')&&p.model.nodes.get('A').styles.includes('fill:gold')&&p.model.edges[0].style.includes('stroke:red'));
  const oldOpen=p.openLink,opened=[];p.openLink=target=>opened.push(target);try{node('A').querySelector('a').dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true,ctrlKey:true}));assert('modifierClickFollowsNativeNoteLink',opened[0]==='Ordner/Notiz#Abschnitt');}finally{p.openLink=oldOpen;}
  p.perform('link-url');saveDialog('https://example.com/page');assert('webLinkUsesNativeAnchor',node('A').querySelector('a')?.getAttribute('href')==='https://example.com/page'&&!p.model.nodes.get('A').classes.includes('internal-link'));
  p.perform('link-remove');p.render();assert('nativeLinkCanBeRemoved',!node('A').querySelector('a')&&p.model.nodes.get('A').classes.includes('special')&&p.model.nodes.get('A').styles.includes('fill:gold'));
  await wait(40);const safe=p.source;p.perform('link-url');saveDialog('javascript:alert(1)',false);await wait(0);assert('unsupportedLinkRejected',p.source===safe&&p.error.textContent.includes('HTTPS'));
  await draft('flowchart LR\n A[Vorlage] --> B[Ergebnis]');const templateSource=p.source;menu.toggle();assert('libraryIsDirectList',!menu.root.hidden&&menu.root.querySelectorAll('[data-template-open]').length===library.list().length&&!document.querySelector('.em-mm-gallery'));
  const save=[...menu.root.querySelectorAll('button')].find(b=>b.textContent==='Aktuelles Diagramm als Vorlage speichern');save.click();const form=menu.root.querySelector('form'),input=form.querySelector('input');input.value='Native Bibliotheksprüfung';form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));await settled();let item=library.list().find(t=>t.name==='Native Bibliotheksprüfung'&&t.source===templateSource);assert('saveCurrentDiagramAsTemplate',!!item);
  let data=await plugin.loadData();assert('templatePersistedLocally',data.mermaidLibrary.custom.some(t=>t.id===item.id&&t.source===templateSource));
  const search=menu.root.querySelector('input[type=search]');search.value='Native Bibliotheksprüfung';search.dispatchEvent(new Event('input'));assert('librarySearchFiltersRows',menu.root.querySelectorAll('[data-template-open]').length===1);await shot('personal-template-library.png',menu.root);
  menu.root.querySelector('[aria-label="Vorlage umbenennen"]').click();await wait(0);let rename=menu.root.querySelector('input[aria-label="Vorlage umbenennen"]');rename.value='Eigene Vorlage';rename.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true,cancelable:true}));await settled();assert('customTemplateCanBeRenamed',library.list().find(t=>t.id===item.id).name==='Eigene Vorlage');
  search.value='';search.dispatchEvent(new Event('input'));menu.root.querySelector('[data-template-id="'+item.id+'"] [aria-label="Vorlage löschen"]').click();await settled();assert('customTemplateCanBeDeleted',!library.list().some(t=>t.id===item.id));menu.root.querySelector('[aria-label="Letzte Vorlagenänderung rückgängig"]').click();await settled();assert('templateDeleteUndo',library.list().some(t=>t.id===item.id));
  const preset=library.list().find(t=>t.id.startsWith('pele-'));menu.root.querySelector('[data-template-id="'+preset.id+'"] [aria-label="Vorlage löschen"]').click();await settled();assert('shippedTemplateCanBeDeleted',!library.list().some(t=>t.id===preset.id));data=await plugin.loadData();assert('deletedPresetStaysDeletedAfterReload',!new library.constructor(data.mermaidLibrary,async()=>{}).list().some(t=>t.id===preset.id));
  const row=menu.root.querySelector('[data-template-open="'+item.id+'"]');row.click();await wait(160);assert('oneClickOpensTemplateWithoutModal',p.source===templateSource&&menu.root.hidden&&p.dialogs.size===0);
  const targetNote=(file??p.currentFile()).path.replace(/\.md$/,'');
  fixture=await app.vault.create('__Emergence Mermaid link check '+crypto.randomUUID()+'.md','# Native link test\n\n```mermaid\nflowchart LR\n A["'+targetNote.replace(/"/g,'#quot;')+'"]:::internal-link\n```\n\n');
  leaf=app.workspace.getLeaf('tab');await leaf.openFile(fixture);await leaf.setViewState({type:'markdown',state:{file:fixture.path,mode:'source',source:false}});v.controller.activePath=fixture.path;leaf.view.editor.setCursor({line:leaf.view.editor.lastLine(),ch:0});
  menu.toggle();menu.root.querySelector('[data-template-id="'+item.id+'"] [aria-label="Vorlage in aktuelle Notiz einfügen"]').click();
  for(let i=0;i<60&&p.binding?.file!==fixture;i++)await wait(30);
  assert('templateInsertsWithOneClick',p.binding?.file===fixture&&p.binding.index===1&&leaf.view.editor.getValue().includes(templateSource.trim()));assert('templateInsertClosesList',menu.root.hidden);
  await p.flush();await leaf.view.save();await leaf.setViewState({type:'markdown',state:{file:fixture.path,mode:'preview'}});await wait(350);
  const nativeLink=leaf.view.containerEl.querySelector('.mermaid a.internal-link');assert('nativeNoteRendererShowsNoteLink',nativeLink?.getAttribute('data-href')===targetNote);
  const originalOpen=app.workspace.openLinkText,followed=[];app.workspace.openLinkText=(target,source)=>{followed.push({target,source});return Promise.resolve();};
  try{nativeLink.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true,button:0}));await wait(20);assert('nativeNoteRendererFollowsNoteLink',followed.some(link=>link.target===targetNote));}finally{app.workspace.openLinkText=originalOpen;}
  v.contentEl.style.cssText=saved.style;await wait(100);const controls=[...document.querySelectorAll('.em-mm-open')];for(const b of controls)b.parentElement.dispatchEvent(new PointerEvent('pointerover',{bubbles:true}));await wait(100);
  const overlap=(a,b)=>a.width&&a.height&&b.width&&b.height&&a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top;
  assert('noteEditControlsExist',controls.length>0);assert('pencilAvoidsEveryCodeblockAndZoomButton',controls.every(button=>[...button.parentElement.querySelectorAll('button,[role="button"],.embed-action')].filter(other=>other!==button).every(other=>!overlap(button.getBoundingClientRect(),other.getBoundingClientRect()))));
  assert('settingsUnchanged',JSON.stringify(plugin.settings)===saved.settings);assert('onlyTemporaryNoteCreated',app.vault.getFiles().length===saved.files+1);return {checks,count:Object.keys(checks).length};
 }finally{
  for(const d of p.dialogs)d.close();menu.hide();await library.flush().catch(()=>{});library.data=saved.library;library.previous=saved.previous;library.notify();await plugin.saveSettings();
  await p.flush();p.binding?.dispose();p.binding=undefined;if(saved.binding)await p.openBlock(saved.binding.file,saved.binding.index);else await p.newDraft(saved.source);if(p.source===saved.source)p.history=saved.history;p.select(saved.selected);v.contentEl.style.cssText=saved.style;v.switchTab(saved.tab);if(leaf){await leaf.view.save?.();leaf.detach();}if(fixture)await app.vault.delete(fixture,true);v.controller.activePath=saved.active;if(saved.leaf)app.workspace.setActiveLeaf(saved.leaf,{focus:false});wc.setBackgroundThrottling(saved.bg);if(app.vault.getFiles().length!==saved.files)throw Error('Fixture cleanup failed.');
  if(file&&(editor?.getValue()??await app.vault.read(file))!==noteText)throw Error('Original note was changed.');
 }
}
const out=resolve('docs/mermaid');mkdirSync(out,{recursive:true});
evaluate(`(()=>{window.__emMermaidLibrary={done:false};(${check.toString()})(${JSON.stringify(out)}).then(report=>window.__emMermaidLibrary={done:true,report}).catch(e=>window.__emMermaidLibrary={done:true,failure:e.stack,checks:window.__emLibraryProgress});return true;})()`);
let result;for(let i=0;i<240;i++){result=evaluate('window.__emMermaidLibrary');if(result.done)break;await new Promise(r=>setTimeout(r,100));}
if(!result?.done||result.failure)throw Error(JSON.stringify(result));writeFileSync(out+'/library-check.json',JSON.stringify(result.report,null,2)+'\n');console.log(JSON.stringify(result.report,null,2));evaluate('(()=>{delete window.__emMermaidLibrary;delete window.__emLibraryProgress;return true})()');
