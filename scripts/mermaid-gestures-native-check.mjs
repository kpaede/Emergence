import {resolve} from 'node:path';
import {mkdirSync,writeFileSync} from 'node:fs';
import {command,evaluate,reloadPlugin} from './obsidian-cli.mjs';
if(command('vault',['info=path'])!==resolve('../../..'))throw Error('Wrong vault.');
reloadPlugin();
async function check(out){
 const v=app.workspace.getLeavesOfType('emergence-workspace')[0].view,p=v.mermaidPanel,w=require('@electron/remote').getCurrentWindow(),wc=w.webContents;
 const saved={tab:v.tab,source:p.source,binding:p.binding,history:p.history,selected:[...p.selected],style:v.contentEl.style.cssText,bg:wc.getBackgroundThrottling(),files:app.vault.getFiles().length};
 const file=saved.binding?.file,editor=file&&app.workspace.getLeavesOfType('markdown').map(l=>l.view).find(view=>view.file===file)?.editor,noteText=file?(editor?.getValue()??await app.vault.read(file)):null;
 const checks={},wait=ms=>new Promise(r=>setTimeout(r,ms)),assert=(name,condition)=>{checks[name]=!!condition;if(!condition)throw Error(name+' | '+p.error.textContent);};
 const draft=async source=>{await p.newDraft(source);p.render();await wait(100);};
 const shot=async(name,el)=>{wc.invalidate();await wait(100);const r=el.getBoundingClientRect(),b=w.getContentBounds();require('fs').writeFileSync(out+'/'+name,(await w.capturePage({x:Math.round(r.x),y:Math.round(r.y),width:Math.round(r.width),height:Math.min(Math.round(r.height),b.height-Math.round(r.y))})).toPNG());};
 const node=id=>[...p.preview.querySelectorAll('.pele-node')].find(el=>el.getAttribute('data-id')===id);
 const close=()=>{for(const d of p.dialogs)d.close();};
 const remove=()=>p.preview.dispatchEvent(new KeyboardEvent('keydown',{key:'Delete',code:'Delete',bubbles:true,cancelable:true}));
 const drag=async(origin,x,y)=>{p.select(['n:'+origin]);const h=p.overlay.querySelector('[data-connect="n:'+origin+'"]'),r=h.getBoundingClientRect();h.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,cancelable:true,button:0,buttons:1,clientX:r.x+r.width/2,clientY:r.y+r.height/2}));document.dispatchEvent(new PointerEvent('pointermove',{bubbles:true,buttons:1,clientX:x,clientY:y}));document.dispatchEvent(new PointerEvent('pointerup',{bubbles:true,button:0,clientX:x,clientY:y}));p.render();await wait(100);};
 try{
  wc.setBackgroundThrottling(false);v.switchTab('mermaid');await p.activate();
  v.contentEl.style.cssText=`position:fixed;left:0;top:0;width:${Math.min(700,innerWidth-24)}px;height:${Math.min(850,innerHeight-24)}px;z-index:99999;background:var(--background-primary)`;
  await draft('flowchart LR\n A[A] --> B[B]');
  p.select(['n:A']);const nr=node('A').getBoundingClientRect(),hr=p.overlay.querySelector('[data-connect="n:A"]').getBoundingClientRect();assert('connectionHandleCenteredBelowNode',Math.abs(nr.x+nr.width/2-hr.x-hr.width/2)<=2&&hr.top>=nr.bottom);
  const target=node('B').getBoundingClientRect();node('A').dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,cancelable:true,button:0,buttons:1,clientX:nr.x+nr.width/2,clientY:nr.y+nr.height/2}));document.dispatchEvent(new PointerEvent('pointermove',{bubbles:true,buttons:1,clientX:target.x+target.width/2,clientY:target.y+target.height/2}));assert('movingNodeDoesNotDrawConnectionLine',!p.overlay.querySelector('.em-mm-drag-line'));document.dispatchEvent(new PointerEvent('pointerup',{bubbles:true,button:0,clientX:target.x+target.width/2,clientY:target.y+target.height/2}));p.render();assert('movingNodeDoesNotCreateConnection',p.model.edges.length===1);
  assert('rootDirectionInDiagram',!!p.stage.querySelector('[aria-label="Richtung des Hauptgraphen"]')&&!p.root.querySelector('.em-mm-tools [aria-label="Richtung des Hauptgraphen"]'));
  p.select(['e:'+p.model.edges[0].id]);p.perform('edge-picker');let modal=[...p.dialogs][0];
  assert('previewsHaveNoVisibleCaptions',[...modal.contentEl.querySelectorAll('.em-mm-choice')].every(b=>!b.textContent.trim()&&b.getAttribute('aria-label')&&b.title));
  assert('edgePreviewsHaveNoEndpointBoxes',[...modal.contentEl.querySelectorAll('.pele-node > rect')].every(r=>r.getAttribute('fill')==='none'&&r.getAttribute('stroke')==='none'));
  assert('allConnectionShapesVisible',modal.contentEl.querySelectorAll('.pele-edge').length===7&&modal.contentEl.querySelectorAll('.pele-marker').length>=6);
  assert('compactPreviewCards',[...modal.contentEl.querySelectorAll('.em-mm-choice')].every(el=>el.getBoundingClientRect().height<=44&&el.getBoundingClientRect().width<=70));
  await shot('connection-choices.png',modal.modalEl);close();
  p.select(['n:A']);p.perform('shape-picker');modal=[...p.dialogs][0];assert('shapePreviewsHaveNoCaptions',[...modal.contentEl.querySelectorAll('.em-mm-choice')].every(b=>!b.querySelector(':scope > span')));close();
  await draft('flowchart LR\n subgraph G[Outer]\n subgraph H[Inner]\n A[A] --> B[B]\n end\n C[C]\n end\n B --> C\n X[X]');
  p.select(['g:H']);remove();p.render();assert('deleteDissolvesInnerGroup',!p.model.subgraphs.some(g=>g.id==='H')&&p.model.subgraphs.find(g=>g.id==='G').nodes.includes('A')&&p.model.nodes.size===4&&p.model.edges.length===2);
  p.undo();p.render();assert('dissolveUndoRestoresNesting',p.model.subgraphs.some(g=>g.id==='H')&&p.model.subgraphs.find(g=>g.id==='G').nodes.includes('H'));
  p.redo();p.render();p.select(['g:G']);remove();p.render();assert('deleteDissolvesOuterGroup',p.model.subgraphs.length===0&&p.model.nodes.size===4&&p.model.edges.length===2);
  await draft('flowchart LR\n subgraph G[G]\n A --> B\n end\n G --> X');p.select(['g:G']);const protectedSource=p.source;remove();await wait(0);assert('groupEndpointProtection',p.source===protectedSource&&p.error.textContent.includes('Verbindungen'));
  const subSource=(dir,cross)=>'flowchart LR\n subgraph G[G]\n direction '+dir+'\n A[A] --> B[B]\n end\n X[X]'+(cross?'\n B --> X':'');
  const positions=source=>{const doc=new DOMParser().parseFromString(p.pele.render(source).svg,'image/svg+xml');return ['A','B'].map(id=>doc.querySelector('.pele-node[data-id="'+id+'"]').getAttribute('transform').match(/-?\d+(?:\.\d+)?/g).map(Number));};
  const td=positions(subSource('TD',false)),bt=positions(subSource('BT',false)),outside=positions(subSource('TD',true));
  assert('nativeSubgraphTDWorks',td[0][0]===td[1][0]&&td[0][1]<td[1][1]);assert('nativeSubgraphBTWorks',bt[0][0]===bt[1][0]&&bt[0][1]>bt[1][1]);assert('nativeOutsideEdgeUsesParent',outside[0][0]<outside[1][0]&&outside[0][1]===outside[1][1]);
  await draft(subSource('TD',true));p.select(['g:G']);assert('subgraphDirectionExplained',p.hint.textContent.includes('Außenverbindungen'));
  await draft('mindmap\nroot[Root]\n A[A]\n  a[a]\n B[B]\n');p.select(['n:A']);assert('mindToolbarChildAndSiblingActions',['Kind hinzufügen (am Ende)','Geschwister davor hinzufügen','Geschwister danach hinzufügen'].every(label=>p.toolbar.querySelector('[aria-label="'+label+'"]')));
  p.toolbar.querySelector('[aria-label="Kind hinzufügen (am Ende)"]').click();p.render();assert('toolbarAddsChildNotSibling',p.model.nodes.find(n=>n.nodeId==='A').children.map(n=>n.nodeId).join(',')==='a,n1'&&p.model.nodes[0].children.map(n=>n.nodeId).join(',')==='A,B');
  for(const corner of ['top-left','top-right','bottom-left','bottom-right']){
   await draft('mindmap\nroot[Root]\n A[A]\n  a[a]\n B[B]\n');const r=p.stage.getBoundingClientRect();await drag('A',corner.endsWith('left')?r.left+8:r.right-8,corner.startsWith('top')?r.top+8:r.bottom-8);
   assert('plusDragAddsLastChild_'+corner,p.model.nodes.find(n=>n.nodeId==='A').children.map(n=>n.nodeId).join(',')==='a,n1'&&p.model.nodes[0].children.map(n=>n.nodeId).join(',')==='A,B');
  }
  await draft('mindmap\nroot[Root]\n A[A]\n B[B]\n');p.select(['n:A']);await wait(300);p.overlay.querySelector('[data-connect="n:A"]').click();p.render();assert('plusClickAddsChildToLeaf',p.model.nodes.find(n=>n.nodeId==='A').children[0].nodeId==='n1'&&p.model.nodes[0].children.length===2);
  await draft('flowchart LR\n A[A] --> B[B]');p.selected.clear();p.interactions.paint();let hit=p.overlay.querySelector('[data-mm-key^="e:"]');const point=hit.getPointAtLength(hit.getTotalLength()/2).matrixTransform(hit.getScreenCTM());
  assert('edgeIsAtHitTestPosition',document.elementFromPoint(point.x,point.y)===hit);
  for(const clickCount of [1,2]){wc.sendInputEvent({type:'mouseDown',x:Math.round(point.x),y:Math.round(point.y),button:'left',clickCount});wc.sendInputEvent({type:'mouseUp',x:Math.round(point.x),y:Math.round(point.y),button:'left',clickCount});await wait(70);}
  assert('realConnectionDoubleClickOpensEditor',[...p.dialogs].some(d=>d.titleEl.textContent==='Verbindung beschriften'));assert('edgeHitElementStable',hit.isConnected);modal=[...p.dialogs][0];modal.setValue('Weiter');modal.contentEl.querySelector('.mod-cta').click();p.render();assert('connectionLabelSaved',p.model.edges[0].text==='Weiter');
  const activeBefore=app.workspace.activeEditor,linkFile=file??app.vault.getMarkdownFiles()[0],link=linkFile.basename;
  await draft('flowchart LR\n A["`**Fett** [['+link+']]\n\nEnde`"] --> B[B]');p.select(['n:A']);p.perform('rename');modal=[...p.dialogs][0];await wait(200);const md=modal.markdown;md?.focus();
  assert('realNativeMarkdownEditor',!!md?.native.cm&&md.native.sourceMode===false&&!modal.contentEl.querySelector('textarea'));
  assert('nativeMarkdownFormatting',!!md.native.cm.dom.querySelector('.cm-strong'));assert('nativeWikiLinkPreview',!!md.native.cm.dom.querySelector('.cm-hmd-internal-link'));
  assert('markdownHasNoteLinkContext',md.owner.file===(p.currentFile()??null));assert('nativeEditorActive',app.workspace.activeEditor?.editor===md.native.editor);
  await shot('markdown-live-preview.png',modal.modalEl);
  // The CLI window is in the background; simulate focus only on this isolated
  // caption view, then exercise Obsidian's own suggestion pipeline.
  Object.defineProperty(md.native.cm,'hasFocus',{get:()=>true,configurable:true});
  md.native.cm.dispatch({changes:{from:0,to:md.native.cm.state.doc.length,insert:'[['},selection:{anchor:2}});md.native.editorSuggest.trigger(md.native.editor,md.owner.file,true);await wait(200);
  assert('nativeWikiLinkCompletion',md.native.editorSuggest.isShowingSuggestion()&&!!document.querySelector('.suggestion-container'));delete md.native.cm.hasFocus;
  modal.setValue('**Fett** [['+link+']]\n\nEnde');
  const native=md.native,select=modal.contentEl.querySelector('[aria-label="Beschriftungsformat"]');select.value='text';select.dispatchEvent(new Event('change'));assert('switchToTextPreservesContent',modal.getValue().includes('[['+link+']]')&&!!modal.contentEl.querySelector('textarea'));assert('nativeEditorCleanedOnModeSwitch',!native.cm.dom.isConnected&&native.cm.destroyed&&native.cleanupFns.length===0&&native._events.length===0&&app.workspace.activeEditor?.editor!==native.editor);
  select.value='markdown';select.dispatchEvent(new Event('change'));assert('switchBackHasLivePreview',!!modal.markdown?.native.cm&&!modal.markdown.native.sourceMode);close();assert('activeEditorRestoredAfterClose',app.workspace.activeEditor===activeBefore);
  p.editor.view.dispatch({selection:{anchor:15}});p.editor.view.focus();await wait(200);assert('codeEditorDrawsCursor',!!p.editor.view.dom.querySelector('.cm-cursorLayer .cm-cursor'));
  await shot('graph-direction-and-code.png',p.root);
  assert('noFilesCreated',app.vault.getFiles().length===saved.files);return {checks,count:Object.keys(checks).length};
 }finally{
  close();await p.flush();p.binding?.dispose();p.binding=undefined;if(saved.binding)await p.openBlock(saved.binding.file,saved.binding.index);else await p.newDraft(saved.source);if(p.source===saved.source)p.history=saved.history;p.select(saved.selected);v.contentEl.style.cssText=saved.style;v.switchTab(saved.tab);wc.setBackgroundThrottling(saved.bg);
  if(file&&(editor?.getValue()??await app.vault.read(file))!==noteText)throw Error('Original note was changed.');
 }
}
const out=resolve('docs/mermaid');mkdirSync(out,{recursive:true});
evaluate(`(()=>{window.__emMermaidGestures={done:false};(${check.toString()})(${JSON.stringify(out)}).then(report=>window.__emMermaidGestures={done:true,report}).catch(e=>window.__emMermaidGestures={done:true,failure:e.stack});return true;})()`);
let result;for(let i=0;i<240;i++){result=evaluate('window.__emMermaidGestures');if(result.done)break;await new Promise(r=>setTimeout(r,100));}
if(!result?.done||result.failure)throw Error(JSON.stringify(result));writeFileSync(out+'/gestures-check.json',JSON.stringify(result.report,null,2)+'\n');console.log(JSON.stringify(result.report,null,2));evaluate('delete window.__emMermaidGestures');
