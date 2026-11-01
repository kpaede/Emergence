import {buildSync} from 'esbuild';
import {mkdirSync,writeFileSync,readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {evaluate,command} from './obsidian-cli.mjs';
const layoutOnly=process.argv.includes('--layout-only');
const out=resolve('docs/relationssynopse');mkdirSync(out,{recursive:true});
buildSync({entryPoints:['tests/synopsis-fixture.ts'],bundle:true,platform:'node',format:'cjs',outfile:'/tmp/emergence-synopsis-fixture.cjs'});
const source=evaluate('app.plugins.plugins.emergence.controller.activePath');
const vaultRoot=command('vault',['info=path']);
const hash=()=>createHash('sha256').update(readFileSync(resolve(vaultRoot,source))).digest('hex'),before=layoutOnly?undefined:hash();
const code=String.raw`(()=>{
 const v=app.workspace.getLeavesOfType('emergence-workspace')[0].view,p=v.graphPanel,w=require('@electron/remote').getCurrentWindow(),wc=w.webContents;
 const previous={body:document.body.className,bg:wc.getBackgroundThrottling(),tab:v.tab,focus:p.focusPath,follow:p.follow,explore:p.explore,synopsis:JSON.stringify(v.controller.settings().synopsis),active:v.controller.activePath,settings:JSON.stringify(v.controller.settings())};
 const state=window.__emSynCheck={done:false,report:{cases:[],screenshots:[],errors:[],unhandledRejections:[]},previous};
 const error=e=>state.report.errors.push(String(e.error??e.message));const rejection=e=>state.report.unhandledRejections.push(String(e.reason?.stack??e.reason));window.addEventListener('error',error);window.addEventListener('unhandledrejection',rejection);wc.setBackgroundThrottling(false);
 const pause=()=>new Promise(r=>window.setTimeout(r,50));
 const waitFor=async(check)=>{for(let i=0;i<100;i++){if(check())return true;await pause();}return false;};
 const assert=(ok,message)=>{if(!ok)throw new Error(message);};
 let panel,wrap;
 const cleanup=()=>{panel?.destroy();wrap?.remove();panel=wrap=undefined;};
 const screenshot=async(name,root)=>{wc.invalidate();await pause();const r=root.getBoundingClientRect();const shot=await w.capturePage({x:Math.round(r.x),y:Math.round(r.y),width:Math.round(r.width),height:Math.min(Math.round(r.height),w.getContentBounds().height-20)});require('fs').writeFileSync(OUT+'/'+name,shot.toPNG());state.report.screenshots.push(name);};
 (async()=>{
  const fixture=require('/tmp/emergence-synopsis-fixture.cjs').synopsisFixture();
  for(const theme of ['light','dark'])for(const width of [280,328])for(const scale of [1,2]){
   cleanup();document.body.removeClass('theme-light','theme-dark');document.body.addClass('theme-'+theme);
   wrap=document.body.createDiv({cls:'em-workspace'});wrap.style.cssText='position:fixed;top:10px;left:10px;width:'+width+'px;height:800px;z-index:99999;background:var(--background-primary)';
   const host=wrap.createDiv(),settings=JSON.parse(JSON.stringify(v.controller.settings()));delete settings.graphStructure;delete settings.synopsis;
   const clicks=[];panel=new p.semantic.constructor(host,()=>settings,(relation,depth)=>{settings.synopsis={...settings.synopsis,depths:{...settings.synopsis?.depths,[relation]:depth}};panel.render(fixture,'Dekonstruktion.md');},{activate:(note,event)=>clicks.push({id:note.id,button:event.button}),inspect:()=>{}},()=>{});
   panel.render(fixture,'Dekonstruktion.md');if(scale===2)host.style.fontSize=(parseFloat(getComputedStyle(host).fontSize)*2)+'px';
   await pause();panel.geometry.draw();
   const notes=[...host.querySelectorAll('a.em-syn-note')],existing=notes.filter(n=>!n.hasClass('is-unresolved')),missing=notes.filter(n=>n.hasClass('is-unresolved'));
   const typography=n=>{const s=getComputedStyle(n);return [s.fontFamily,s.fontSize,s.fontWeight,s.fontStyle,s.lineHeight].join('|');},canonical=typography(existing[0]),color=getComputedStyle(existing[0]).color;
   const rect=host.getBoundingClientRect(),focus=host.querySelector('.em-syn-focus'),f=focus.getBoundingClientRect();
   const groups=[...host.querySelectorAll('[data-syn-relation]')],counts=Object.fromEntries(groups.map(g=>[g.dataset.synRelation,Number(g.querySelector('.em-syn-count').textContent)]));
   const geometries=panel.geometry.last,base=host.querySelector('.em-syn-diagram').getBoundingClientRect();
   let crossings=0;for(const note of notes){const range=document.createRange();range.selectNodeContents(note);for(const r of range.getClientRects())for(const s of geometries.segments){
    const left=r.left-base.left+1,right=r.right-base.left-1,top=r.top-base.top+1,bottom=r.bottom-base.top-1;
    if(s.y1===s.y2&&s.y1>top&&s.y1<bottom&&Math.max(s.x1,s.x2)>left&&Math.min(s.x1,s.x2)<right)crossings++;
    if(s.x1===s.x2&&s.x1>left&&s.x1<right&&Math.max(s.y1,s.y2)>top&&Math.min(s.y1,s.y2)<bottom)crossings++;
   }}
   const endpointConnected=geometries.endpoints.every(pt=>geometries.segments.some(s=>Math.abs(s.y1-s.y2)<0.1?Math.abs(s.y1-pt.y)<=0.6&&pt.x>=Math.min(s.x1,s.x2)-0.6&&pt.x<=Math.max(s.x1,s.x2)+0.6:Math.abs(s.x1-pt.x)<=0.6&&pt.y>=Math.min(s.y1,s.y2)-0.6&&pt.y<=Math.max(s.y1,s.y2)+0.6));
   const svgStyles=[...host.querySelectorAll('.em-syn-edges path')].map(path=>{const s=getComputedStyle(path);return [s.stroke,s.strokeWidth,s.strokeDasharray].join('|');});
   const leftHead=host.querySelector('.em-syn-similar .em-syn-head').getBoundingClientRect(),rightHead=host.querySelector('.em-syn-friction .em-syn-head').getBoundingClientRect(),leftControl=host.querySelector('.em-syn-similar .em-syn-controls').getBoundingClientRect(),rightControl=host.querySelector('.em-syn-friction .em-syn-controls').getBoundingClientRect();
   const result={controlsAligned:Math.abs(leftControl.bottom-rightControl.bottom)<1,headersAligned:Math.abs(leftHead.bottom-rightHead.bottom)<1,theme,width,scale,renderedNotes:notes.length,counts,horizontalOverflow:host.scrollWidth>host.clientWidth+1,allTitlesPresent:notes.every(n=>n.textContent&&!n.textContent.includes('…')),uniformTypography:notes.every(n=>typography(n)===canonical),uniformExistingColor:existing.every(n=>getComputedStyle(n).color===color),onlyMissingFaded:existing.every(n=>getComputedStyle(n).opacity==='1')&&missing.every(n=>getComputedStyle(n).opacity===String(Number(getComputedStyle(host).getPropertyValue('--link-unresolved-opacity')))),focusCentered:Math.abs((f.left+f.width/2)-(rect.left+host.clientWidth/2))<2,oneFocus:host.querySelectorAll('.em-syn-focus').length===1,parentsLeftAligned:host.querySelectorAll('.em-syn-parent-path').length===4,correctSides:host.querySelector('.em-syn-similar').getBoundingClientRect().left<host.querySelector('.em-syn-friction').getBoundingClientRect().left,orthogonal:geometries.segments.every(s=>s.x1===s.x2||s.y1===s.y2),lineStyleUniform:new Set(svgStyles).size===1,endpointConnected,crossings,depths:[...host.querySelectorAll('[data-syn-depth]')].map(el=>el.value),realHrefs:notes.every(n=>n.getAttribute('href')&&n.getAttribute('href')!=='#'),addKinds:[...host.querySelectorAll('[data-syn-add]')].map(b=>b.dataset.synAdd),allGroupsVisible:groups.length===7&&groups.every(g=>getComputedStyle(g).display!=='none')};
   state.report.cases.push(result);
   assert(result.controlsAligned&&result.headersAligned&&!result.horizontalOverflow&&result.allTitlesPresent&&result.uniformTypography&&result.uniformExistingColor&&result.onlyMissingFaded&&result.focusCentered&&result.oneFocus&&result.parentsLeftAligned&&result.correctSides&&result.orthogonal&&result.lineStyleUniform&&result.endpointConnected&&result.crossings===0&&result.realHrefs&&result.allGroupsVisible,'Layout failed '+theme+' '+width+' '+scale+': '+JSON.stringify(result));
   assert(result.addKinds.length===5&&!result.addKinds.includes('literature')&&!result.addKinds.includes('links'),'Plus-Aktionen falsch zugeordnet');
   assert(JSON.stringify(Object.values(counts))===JSON.stringify([4,8,6,12,4,48,74]),'Stress counts incomplete');
   if(scale===1){host.scrollTop=0;await screenshot('synopse-'+theme+'-'+width+'-oben.png',wrap);host.scrollTop=host.querySelector('.em-syn-literature').offsetTop-8;await screenshot('synopse-'+theme+'-'+width+'-literatur.png',wrap);host.scrollTop=host.scrollHeight;await screenshot('synopse-'+theme+'-'+width+'-verweise.png',wrap);}
   notes.find(n=>n.textContent==='Ästhetik').click();assert(clicks.length===1&&clicks[0].id==='Ästhetik.md','Internal link callback failed');
   const reference=host.querySelector('a.em-syn-note');reference.focus({preventScroll:true});assert(document.activeElement===reference,'Link is not keyboard focusable');
   for(const relation of ['broader','narrower','similar','friction','examples','literature','links']){const select=host.querySelector('[data-syn-depth="'+relation+'"]');select.value='2';select.dispatchEvent(new Event('change'));assert(settings.synopsis.depths[relation]===2,'Independent depth failed');}
   assert(Object.values(settings.synopsis.depths).every(n=>n===2),'Depth states leaked');
   panel.geometry.draw();assert(host.querySelector('[data-syn-list="narrower"] .em-syn-nested'),'Depth 2 did not expand');
   if(width===280&&scale===2){
    const deep=JSON.parse(JSON.stringify(fixture));deep.version++;
    let previous='Différance.md';for(let i=0;i<24;i++){const id='sehr/tiefer/Pfad/Stufe '+i+'.md';deep.nodes.push({id,title:'Tiefere Notiz '+i+' – Unicode αλήθεια und langer Begriff',aliases:[],tags:[],type:'md',exists:i%3!==0,mtime:0,size:0});deep.edges.push({id:'deep-'+i,source:previous,target:id,field:'Unterbau',layer:'breadcrumbs',explicit:true,provenance:'synthetic',occurrences:[]});previous=id;}
    deep.edges.push({id:'self',source:'Dekonstruktion.md',target:'Dekonstruktion.md',field:'Überbau',layer:'breadcrumbs',explicit:true,provenance:'synthetic',occurrences:[]},{id:'cycle',source:'Philosophie.md',target:'Dekonstruktion.md',field:'Überbau',layer:'breadcrumbs',explicit:true,provenance:'synthetic',occurrences:[]});
    settings.synopsis.depths=Object.fromEntries(['broader','narrower','similar','friction','examples','literature','links'].map(r=>[r,'all']));
    const started=performance.now();panel.render(deep,'Dekonstruktion.md');await pause();panel.geometry.draw();
    const all=[...host.querySelectorAll('a.em-syn-note')],base=host.querySelector('.em-syn-diagram').getBoundingClientRect();let crossings=0;
    for(const note of all){const range=document.createRange();range.selectNodeContents(note);for(const r of range.getClientRects())for(const seg of panel.geometry.last.segments){const l=r.left-base.left+1,rr=r.right-base.left-1,t=r.top-base.top+1,b=r.bottom-base.top-1;if(seg.y1===seg.y2&&seg.y1>t&&seg.y1<b&&Math.max(seg.x1,seg.x2)>l&&Math.min(seg.x1,seg.x2)<rr)crossings++;if(seg.x1===seg.x2&&seg.x1>l&&seg.x1<rr&&Math.max(seg.y1,seg.y2)>t&&Math.min(seg.y1,seg.y2)<b)crossings++;}}
    const check={theme,deepNotes:all.filter(n=>n.dataset.emNote.startsWith('sehr/tiefer/')).length,horizontalOverflow:host.scrollWidth>host.clientWidth+1,crossings,elapsedMs:Math.round(performance.now()-started)};
    (state.report.deepCases??=[]).push(check);assert(check.deepNotes===24&&!check.horizontalOverflow&&crossings===0,'Deep paths/cycles failed: '+JSON.stringify(check));
   }

  }
  cleanup();document.body.className=previous.body;
  if(LAYOUT_ONLY){assert(!state.report.errors.length,'Runtime JavaScript error');return;}
  // Actual Obsidian editor navigation, followed by restoration of the original editor state.
  v.switchTab('graph');p.follow=true;p.focus(previous.active);p.explore=false;p.exploreBox.checked=false;
  const main=app.workspace.getMostRecentLeaf(app.workspace.rootSplit),originalFile=main.view.file,editorState=main.view.getEphemeralState?.();
  const target=[...p.semantic.model.neighbors(previous.active,'broader')].find(id=>p.semantic.model.notes.get(id).exists)??previous.active;
  state.report.navigationTarget=target===previous.active?'current-note':'direct-parent';
  const link=[...p.semanticHost.querySelectorAll('a.em-syn-note')].find(a=>a.dataset.emNote===target);link.click();await waitFor(()=>main.view.file?.path===target&&p.focusPath===target);
  state.report.navigation={normalClickOpenedMain:main.view.file?.path===target,sidebarPreserved:v.leaf.getRoot()===app.workspace.rightSplit,followsNote:p.focusPath===target};
  assert(Object.values(state.report.navigation).every(Boolean),'Actual note navigation failed');
  await main.openFile(originalFile,{active:true,eState:editorState});await pause();
  p.exploreBox.checked=true;p.exploreBox.dispatchEvent(new Event('change'));const exploreLink=[...p.semanticHost.querySelectorAll('a.em-syn-note')].find(a=>a.dataset.emNote===target);exploreLink.click();await pause();
  state.report.explore={mainUnchanged:main.view.file?.path===originalFile.path,sourceUnchanged:v.controller.activePath===originalFile.path,graphMoved:p.focusPath===target};assert(Object.values(state.report.explore).every(Boolean),'Explore mode changed the editor');
  p.exploreBox.checked=false;p.exploreBox.dispatchEvent(new Event('change'));
  // Save through the actual controls, then inspect the plugin's persisted data.
  const select=p.semanticHost.querySelector('[data-syn-depth="literature"]');select.value='all';select.dispatchEvent(new Event('change'));await p.depthSave;
  const persisted=await app.plugins.plugins.emergence.loadData();state.report.persistence=persisted.settings.synopsis.depths.literature==='all';assert(state.report.persistence,'Depth not persisted');
  assert(!state.report.errors.length,'Runtime JavaScript error');
  state.report.environmentIssue=state.report.unhandledRejections.length?'Bestehende Media-Extended-Meldung; siehe console-comparison.json':null;
  assert(state.report.unhandledRejections.every(message=>message==='provider destroyed'),'Neue unbehandelte Promise-Ablehnung');
 })().then(()=>{state.done=true;}).catch(e=>{state.failure=String(e.stack??e);state.done=true;}).finally(async()=>{
  cleanup();document.body.className=previous.body;window.removeEventListener('error',error);window.removeEventListener('unhandledrejection',rejection);wc.setBackgroundThrottling(previous.bg);
  const c=v.controller;if(!LAYOUT_ONLY){if(previous.synopsis===undefined)delete c.settings().synopsis;else c.settings().synopsis=JSON.parse(previous.synopsis);await c.persist();}
  const original=app.vault.getFileByPath(previous.active),main=app.workspace.getMostRecentLeaf(app.workspace.rootSplit);if(original&&main.view.file?.path!==original.path)await main.openFile(original,{active:true});
  p.explore=previous.explore;p.exploreBox.checked=previous.explore;p.follow=previous.follow;p.focusPath=previous.focus;p.semantic.invalidate();p.renderStructure();v.switchTab(previous.tab);state.report.settingsRestored=JSON.stringify(c.settings())===previous.settings;state.cleaned=true;
 });
 return true;
})()`;
evaluate(code.replaceAll('LAYOUT_ONLY',String(layoutOnly)).replaceAll('OUT',JSON.stringify(out)));
let final;
for(let i=0;i<240;i++){const state=evaluate('({done:window.__emSynCheck.done,cleaned:window.__emSynCheck.cleaned,failure:window.__emSynCheck.failure,report:window.__emSynCheck.report})');if(state.done&&state.cleaned){final=state;break;}await new Promise(r=>setTimeout(r,150));}
if(!final)throw new Error('Native synopsis checks timed out; see window.__emSynCheck.');
final.report.sourceNoteUnchanged=layoutOnly?null:hash()===before;final.report.layoutOnly=layoutOnly;final.report.checkedAt=new Date().toISOString();
writeFileSync(resolve(out,'native-checks.json'),JSON.stringify(final,null,2)+'\n');
console.log(JSON.stringify({done:final.done,error:final.failure,cases:final.report.cases.map(c=>({width:c.width,theme:c.theme,scale:c.scale,notes:c.renderedNotes,crossings:c.crossings,overflow:c.horizontalOverflow})),navigation:final.report.navigation,explore:final.report.explore,persistence:final.report.persistence,sourceNoteUnchanged:final.report.sourceNoteUnchanged,screenshots:final.report.screenshots.length,environmentIssue:final.report.environmentIssue},null,2));
if(final.failure||!layoutOnly&&!final.report.sourceNoteUnchanged)throw new Error(final.failure??'Source note changed');
command('eval',['code=delete window.__emSynCheck']);
