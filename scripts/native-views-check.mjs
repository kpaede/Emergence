import {mkdirSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {evaluate,reloadPlugin} from './obsidian-cli.mjs';
const out=resolve('docs/native-views');mkdirSync(out,{recursive:true});reloadPlugin();
async function check(OUT){
 const v=app.workspace.getLeavesOfType('emergence-workspace')[0].view,c=v.controller,p=v.graphPanel,manager=p.nativeViews;
 if(c.abort||c.applyingIdea)throw Error('Eine Benutzeraktion läuft.');
 const wait=ms=>new Promise(r=>window.setTimeout(r,ms)),until=async predicate=>{for(let i=0;i<160;i++){if(predicate())return;await wait(50);}throw Error('Native view timeout');};
 const leaves=()=>{const all=[];app.workspace.iterateAllLeaves(l=>all.push(l));return all;};
 const main=app.workspace.getMostRecentLeaf(app.workspace.rootSplit),file=main.view.file,editorState=main.view.getEphemeralState?.();
 const w=require('@electron/remote').getCurrentWindow(),wc=w.webContents;
 const before={tab:v.tab,style:v.contentEl.style.cssText,body:document.body.className,bg:wc.getBackgroundThrottling(),source:c.activePath,sourceOpen:p.synopsisControls.querySelector('details').open,settings:JSON.stringify(c.settings()),files:app.vault.getFiles().length,leaves:leaves().length,focus:p.focusPath,follow:p.follow,explore:p.explore,scroll:p.host.scrollTop};
 const clipboard=Object.getOwnPropertyDescriptor(navigator.clipboard,'writeText'),report={checks:{},layouts:[],native:[],screenshots:[],errors:[],rejections:[]};
 const assert=(name,ok)=>{report.checks[name]=!!ok;if(!ok)throw Error(name+' '+JSON.stringify(report));};
 const err=e=>report.errors.push(String(e.error??e.message)),rej=e=>report.rejections.push(String(e.reason));window.addEventListener('error',err);window.addEventListener('unhandledrejection',rej);wc.setBackgroundThrottling(false);
 const choose=async type=>{p.viewSelect.value=type;p.viewSelect.dispatchEvent(new Event('change',{bubbles:true}));if(type==='synopsis')await until(()=>!manager.slots.size);else{await until(()=>manager.slots.has(type));await manager.slots.get(type).ready;}await wait(120);p.resize();};
 const screenshot=async name=>{wc.invalidate();await wait(70);const r=v.contentEl.getBoundingClientRect();const shot=await w.capturePage({x:Math.round(r.x),y:Math.round(r.y),width:Math.round(r.width),height:Math.min(Math.round(r.height),w.getContentBounds().height-Math.round(r.y))});require('fs').writeFileSync(OUT+'/'+name,shot.toPNG());report.screenshots.push(name);};
 let isolated,isolatedHost;
 try{
  v.switchTab('graph');assert('synopsisPreselected',p.viewSelect.value==='synopsis'&&manager.slots.size===0);p.follow=true;p.focus(c.activePath);
  const tabs=[...v.contentEl.querySelectorAll('.em-tabs > [role=tab]')],types=[...p.viewSelect.options].map(o=>o.value);
  assert('tabs',JSON.stringify(tabs.map(t=>t.textContent))===JSON.stringify(['Graph','Feldideen','Mermaid','Argdown','Suche'])&&tabs.every((t,i)=>t.querySelector('.lucide-'+['network','text-search','workflow','git-fork','search'][i])));
  assert('onlySynopsisAndNativeChoices',JSON.stringify(types)===JSON.stringify(['synopsis','bc-matrix-view','bc-tree-view','zotlit-references',...(app.internalPlugins.plugins.graph.enabled?['localgraph']:[])]));
  const controls=p.synopsisControls.querySelector('details'),wasOpen=controls.open;controls.open=true;await wait(50);
  assert('singleSourceDisclosure',!controls.querySelector('details')&&!controls.querySelector('select[multiple]')&&controls.querySelectorAll('.em-syn-source-choice').length===5);
  controls.querySelector('.em-syn-source-choice').click();await wait(50);const nativeChoices=[...document.querySelectorAll('.menu .menu-item-title')].map(n=>n.textContent);assert('nativeFieldDropdown',c.graph.snapshot.fields.every(field=>nativeChoices.includes(field)));p.refreshSources.closeMenu();controls.open=wasOpen;
  const initialRow=p.semanticHost.querySelector('.em-syn-citation .em-literature-reference');assert('bibliographicEntryAndSeparateCopy',!!initialRow?.querySelector('.em-citekey .lucide-copy'));
  await until(()=>!!initialRow.querySelector('[data-zotlit-formatted]'));
  const indexedKey=initialRow.querySelector('[data-zotlit-item]').dataset.zotlitItem,key=c.graph.snapshot.edges.find(e=>e.source===c.activePath&&e.layer==='zotlit'&&e.reference?.indexedKey===indexedKey)?.reference?.citekey,ourText=initialRow.querySelector('.em-literature-title').textContent.trim(),ourEmphasis=initialRow.querySelector('em')?.textContent;
  const copied=[],format=c.settings().citekeyFormat;Object.defineProperty(navigator.clipboard,'writeText',{configurable:true,value:async text=>{copied.push(text);}});
  for(const value of ['brackets','at','plain']){c.settings().citekeyFormat=value;initialRow.querySelector('.em-citekey').click();await wait(10);}c.settings().citekeyFormat=format;
  assert('copyFormatsWithoutNavigation',JSON.stringify(copied)===JSON.stringify(['[@'+key+']','@'+key,key])&&leaves().length===before.leaves&&main.view.file===file);
  const views=[];
  for(const type of types.slice(1)){
   await choose(type);const slot=manager.slots.get(type);views.push(slot.view);
   assert('singleView_'+type,manager.slots.size===1&&p.canvas.hidden&&!p.nativeHost.hidden&&slot.view.getViewType()===type&&slot.view._loaded&&slot.view.contentEl.children.length>0);
   assert('isolated_'+type,slot.view.leaf!==v.leaf&&slot.view.leaf.containerEl===slot.host&&v.leaf.view===v);
   report.native.push({type,controls:slot.view.contentEl.querySelectorAll('button,input,select,.clickable-icon').length});
   if(type==='zotlit-references'){
    const services=app.plugins.plugins.zotlit.services;await until(()=>services.viewRegistry.get(slot.view.model.state).entries.some(e=>e.kind==='rendered'));
    const entries=services.viewRegistry.get(slot.view.model.state).entries,index=entries.findIndex(e=>e.id===indexedKey),nativeRow=[...slot.view.contentEl.querySelectorAll('li')][index],body=nativeRow?.querySelector('[class~="zt:font-content"]');
    report.bibliographyComparison={sameText:body?.textContent.trim()===ourText,sameEmphasis:body?.querySelector('em')?.textContent===ourEmphasis};assert('exactZotlitBibliography',Object.values(report.bibliographyComparison).every(Boolean));
   }
   if(type==='localgraph'){
    await until(()=>slot.view.renderer.scale>=.99&&slot.view.file?.path===c.activePath);await wait(600);const r=slot.view.renderer,n=r.nodes.find(n=>n.id===c.activePath),ratio=devicePixelRatio;
    report.localZoom={scale:r.scale,targetScale:r.targetScale,centerDistance:n?Math.hypot(n.x*r.scale+r.panX-r.width*ratio/2,n.y*r.scale+r.panY-r.height*ratio/2):null};assert('localGraphReadable',r.scale>=.99&&report.localZoom.centerDistance<r.width/2);
    // Manual zoom survives later ordinary panel updates.
    r.targetScale=.8;r.setScale(.8);p.update();await wait(600);assert('manualZoomPreserved',Math.abs(r.targetScale-.8)<.01);
    const target=p.semantic.model.neighbors(c.activePath,'broader').find(id=>p.semantic.model.notes.get(id)?.exists);
    if(target){await main.openFile(app.vault.getFileByPath(target),{active:true});await until(()=>slot.view.file?.path===target&&slot.view.renderer.scale>=.99);assert('localGraphFollowsAndReframes',true);await main.openFile(file,{active:true,eState:editorState});await until(()=>c.activePath===before.source&&slot.view.file?.path===before.source);}
   }
  }
  await choose('synopsis');await until(()=>views.every(view=>!view._loaded));assert('unselectedNativeComponentsReleased',true);
  assert('noExtraWorkspaceLeaves',leaves().length===before.leaves);
  // The unavailable core plugin is filtered before any factory lookup, without touching its preferences.
  const requested=[],fake=new Proxy(app,{get(target,key){if(key==='internalPlugins')return {plugins:{graph:{enabled:false,instance:{}}}};if(key==='plugins')return {plugins:{}};if(key==='viewRegistry')return {getViewCreatorByType(type){requested.push(type);return app.viewRegistry.getViewCreatorByType(type);}};return Reflect.get(target,key,target);}});
  isolatedHost=v.contentEl.createDiv();isolated=new manager.constructor(fake,v.leaf,isolatedHost);isolated.sync(c.activePath,'localgraph');assert('disabledGraphExcluded',!isolated.choices(c.activePath).length&&!isolated.slots.size&&!requested.includes('localgraph'));await isolated.destroy();isolated=undefined;isolatedHost.remove();isolatedHost=undefined;
  for(const theme of ['light','dark'])for(const width of [280,328]){
   document.body.removeClass('theme-light','theme-dark');document.body.addClass('theme-'+theme);v.contentEl.style.cssText='position:fixed;top:10px;left:10px;width:'+width+'px;height:780px;z-index:99999;background:var(--background-primary)';
   await choose('synopsis');p.host.scrollTop=0;await screenshot('graph-'+theme+'-'+width+'.png');const disclosure=p.synopsisControls.querySelector('details');disclosure.open=true;await wait(80);await screenshot('fields-'+theme+'-'+width+'.png');disclosure.open=false;await wait(50);const scroll=p.semanticHost.scrollTop;p.semanticHost.scrollTop=p.semanticHost.querySelector('.em-syn-literature').offsetTop-8;await until(()=>!!p.semanticHost.querySelector('[data-zotlit-formatted]'));await screenshot('synopsis-literature-'+theme+'-'+width+'.png');p.semanticHost.scrollTop=scroll;
   for(const type of types.slice(1)){await choose(type);await wait(type==='localgraph'?600:100);await screenshot(type+'-'+theme+'-'+width+'.png');const slot=manager.slots.get(type);const fit=p.host.scrollWidth<=p.host.clientWidth+1&&slot.view.contentEl.scrollWidth<=slot.view.contentEl.clientWidth+1;report.layouts.push({theme,width,type,overflow:!fit});assert('layout_'+theme+'_'+width+'_'+type,fit);const bounds=slot.host.getBoundingClientRect(),panelBounds=p.host.getBoundingClientRect();assert('height_'+theme+'_'+width+'_'+type,Math.abs(bounds.bottom-panelBounds.bottom)<2&&Math.abs(bounds.width-panelBounds.width)<2&&getComputedStyle(slot.host).borderTopWidth==='0px');}
   assert('tabFit_'+theme+'_'+width,tabs.every(t=>t.scrollWidth<=t.clientWidth+1));
  }
  assert('settingsUnchanged',JSON.stringify(c.settings())===before.settings);assert('filesUnchanged',app.vault.getFiles().length===before.files);assert('treeAttributesHidden',window.BCAPI.plugin.settings.views.side.tree.show_attributes.length===0);
  report.environmentIssue=report.rejections.length?'Known Media Extended provider destroyed':null;assert('noNewErrors',!report.errors.length&&report.rejections.every(r=>r==='provider destroyed'));
  return report;
 }finally{
  if(clipboard)Object.defineProperty(navigator.clipboard,'writeText',clipboard);else delete navigator.clipboard.writeText;
  await isolated?.destroy();isolatedHost?.remove();if(main.view.file!==file)await main.openFile(file,{active:true,eState:editorState});
  p.refreshSources.closeMenu();p.synopsisControls.querySelector('details').open=before.sourceOpen;await choose('synopsis');document.body.className=before.body;v.contentEl.style.cssText=before.style;p.focusPath=before.focus;p.follow=before.follow;p.explore=before.explore;p.exploreBox.checked=before.explore;p.semantic.invalidate();p.renderStructure();v.switchTab(before.tab);p.host.scrollTop=before.scroll;p.resize();wc.setBackgroundThrottling(before.bg);window.removeEventListener('error',err);window.removeEventListener('unhandledrejection',rej);
 }
}
evaluate(`(()=>{window.__emNativeCheck={done:false};(${check.toString()})(${JSON.stringify(out)}).then(report=>window.__emNativeCheck={done:true,report}).catch(e=>window.__emNativeCheck={done:true,failure:e.stack});return true;})()`);
let result;for(let i=0;i<240;i++){result=evaluate('window.__emNativeCheck');if(result.done)break;await new Promise(r=>setTimeout(r,100));}writeFileSync(out+'/checks.json',JSON.stringify(result,null,2)+'\n');if(!result?.done||result.failure)throw Error(JSON.stringify(result));console.log(JSON.stringify(result.report,null,2));evaluate('delete window.__emNativeCheck');
