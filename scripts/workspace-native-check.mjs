import {writeFileSync} from 'node:fs';
import {evaluate, reloadPlugin} from './obsidian-cli.mjs';

reloadPlugin();
async function check() {
 const v=app.workspace.getLeavesOfType('emergence-workspace')[0].view,c=v.controller,p=v.graphPanel;
 if(c.abort||c.applyingIdea)throw Error('Eine Benutzeraktion läuft.');
 const wait=ms=>new Promise(resolve=>window.setTimeout(resolve,ms));
 const until=async predicate=>{for(let i=0;i<160;i++){if(predicate())return;await wait(50);}throw Error('UI timeout');};
 const original={tab:v.tab,state:JSON.parse(JSON.stringify(v.state)),focus:p.focusPath,mode:p.mode,follow:p.follow,explore:p.explore,searchItem:p.searchItem,active:c.activePath,
  leaves:new Set(app.workspace.getLeavesOfType('markdown')),files:app.vault.getFiles().length,settings:JSON.stringify(c.settings()),history:JSON.stringify(c.inquiryHistory)};
 const report={};const assert=(name,condition)=>{report[name]=!!condition;if(!condition)throw Error(name);};
 let probe,off;
 try {
  assert('fourTabs',JSON.stringify([...v.contentEl.querySelectorAll('[role=tab]')].map(b=>b.textContent))===JSON.stringify(['Suche','Graph','Analyse','Recherche']));
  assert('searchIconFirst',!!v.contentEl.querySelector('[role=tab]:first-child .svg-icon'));
  assert('searchRemovedFromGraph',!v.panels.get('graph').querySelector('input[type=search]'));
  v.switchTab('graph');p.mode='structure';p.modeSelect.value='structure';p.explore=false;p.exploreBox.checked=false;p.follow=true;p.focus(c.activePath);p.renderContext();
  p.explore=true;p.exploreBox.checked=true;const focusLink=v.contentEl.querySelector('.em-syn-focus a');assert('activeNoteLinkPresent',!!focusLink);
  focusLink.dispatchEvent(new MouseEvent('auxclick',{button:1,bubbles:true,cancelable:true}));
  await until(()=>app.workspace.getLeavesOfType('markdown').some(l=>!original.leaves.has(l)&&!!l.view.file));
  const added=app.workspace.getLeavesOfType('markdown').filter(l=>!original.leaves.has(l));
  assert('middleClickOpensNewTabWhileExploring',added.length===1&&added[0].view.file?.path===original.active);for(const leaf of added)leaf.detach();
  p.explore=false;p.exploreBox.checked=false;
  const file=app.vault.getFileByPath(original.active),fm=app.metadataCache.getFileCache(file)?.frontmatterLinks??[];
  const model=p.semantic.model;let checked=0;
  for(const relation of ['broader','narrower','similar','friction','examples'])for(const field of model.fields[relation]){
   const expected=fm.filter(l=>l.key===field||l.key.startsWith(field+'.')).map(l=>app.metadataCache.getFirstLinkpathDest(l.link,original.active)?.path??c.graph.snapshot.edges.find(e=>e.explicit&&e.source===original.active&&e.field===field&&e.target.replace(/\.md$/u,'').endsWith('/'+l.link))?.target??l.link.replace(/\.md$/u,'')+'.md');
   const actual=model.neighbors(original.active,relation).filter(id=>expected.includes(id));
   if(expected.length>1){assert('frontmatterOrder_'+relation,JSON.stringify(actual)===JSON.stringify([...new Set(expected)]));checked++;}
  }
  report.frontmatterListsChecked=checked;
  v.switchTab('search');const search=v.panels.get('search').querySelector('input[type=search]');search.value=file.basename;search.dispatchEvent(new Event('input',{bubbles:true}));
  await until(()=>!v.contentEl.querySelector('.em-library-results [role=status]')?.textContent.includes('wird gesucht'));
  const noteLink=v.contentEl.querySelector('.em-search-results [data-em-note]');assert('globalNoteSearch',!!noteLink);
  v.state.search.mode='explore';noteLink.click();
  assert('searchExploreSelectsGraph',v.tab==='graph'&&p.explore&&c.activePath===original.active);
  v.switchTab('search');v.state.search.mode='open';v.searchPanel.update();
  const target=v.contentEl.querySelector('.em-search-results [data-em-note="'+original.active+'"]')??v.contentEl.querySelector('.em-search-results [data-em-note]');
  target.click();await until(()=>c.activePath===original.active&&app.workspace.getLeavesOfType('markdown').length===original.leaves.size);report.searchOpenDetails={activeMatches:c.activePath===original.active,before:original.leaves.size,after:app.workspace.getLeavesOfType('markdown').length};assert('searchOpenUsesMainEditor',report.searchOpenDetails.activeMatches&&report.searchOpenDetails.after===report.searchOpenDetails.before);
  target.dispatchEvent(new MouseEvent('auxclick',{button:1,bubbles:true,cancelable:true}));
  await until(()=>app.workspace.getLeavesOfType('markdown').some(l=>!original.leaves.has(l)&&!!l.view.file));
  assert('searchMiddleClickNewTab',true);for(const leaf of app.workspace.getLeavesOfType('markdown'))if(!original.leaves.has(leaf))leaf.detach();
  const libraryLink=v.contentEl.querySelector('.em-library-results [data-zotlit-item]');
  assert('realLibrarySearch',!!libraryLink);
  const itemKey=libraryLink.dataset.zotlitItem;
  libraryLink.click();await until(()=>app.workspace.getLeavesOfType('zotlit-library').some(l=>l.view.selected?.key===itemKey));
  assert('literatureOpensSelectedLibraryItem',true);
  const countBefore=app.workspace.getLeavesOfType('zotlit-library').length;
  libraryLink.dispatchEvent(new MouseEvent('auxclick',{button:1,bubbles:true,cancelable:true}));await wait(50);
  assert('literatureMiddleClickNoExtraTab',app.workspace.getLeavesOfType('zotlit-library').length===countBefore);
  v.state.search.mode='explore';libraryLink.click();await wait(200);
  assert('literatureExploreGraph',v.tab==='graph'&&p.explore&&!!p.focusPath&&p.cy.nodes().length>0&&c.activePath===original.active);
  // Test inquiry controls using a separate controller; no real note reads or writes.
  probe=new c.constructor(app,()=>JSON.parse(original.settings),async()=>{},[],async()=>{});probe.activePath=original.active;probe.graph.snapshot=c.graph.snapshot;
  const requests=[];let continued=false;
  probe.provider.chat=async options=>{requests.push(options);if(!continued)options.onTruncated?.();return continued?'Fortsetzung.':'Erster Teil.';};
  v.controller=probe;off=probe.subscribe(()=>v.update(true));v.state.inquiry={kind:'free',mode:'none',prompt:'Synthetic research question',extra:'',template:'',wikipedia:false,includeHistory:false};v.switchTab('inquiry');
  v.panels.get('inquiry').querySelector('.mod-cta').click();await until(()=>probe.inquiryHistory.length===1&&!probe.abort);
  assert('partialResearchVisible',v.panels.get('inquiry').textContent.includes('Erster Teil.')&&v.panels.get('inquiry').textContent.includes('Ausgabelimit erreicht'));
  continued=true;[...v.panels.get('inquiry').querySelectorAll('button')].find(b=>b.textContent==='Antwort fortsetzen').click();await until(()=>!probe.abort&&probe.inquiryHistory[0].answer.includes('Fortsetzung.'));
  assert('researchContinuationPreservesText',probe.inquiryHistory.length===1&&probe.inquiryHistory[0].answer==='Erster Teil.\n\nFortsetzung.'&&!probe.inquiryHistory[0].truncated);
  assert('continuationOnlySelectedAnswer',requests[1].messages.filter(m=>m.role==='assistant').length===1&&requests[1].messages.find(m=>m.role==='assistant').content==='Erster Teil.');
  off();off=undefined;probe.dispose();probe=undefined;v.controller=c;
  assert('userHistoryUnchanged',JSON.stringify(c.inquiryHistory)===original.history);
  assert('userSettingsUnchanged',JSON.stringify(c.settings())===original.settings);
  assert('noFilesCreated',app.vault.getFiles().length===original.files);
  report.notesWritten=0;report.syntheticModelCalls=2;
  return report;
 } catch(error) {throw Error(String(error)+' '+JSON.stringify(report));} finally {
  off?.();probe?.dispose();v.controller=c;
  for(const leaf of app.workspace.getLeavesOfType('markdown'))if(!original.leaves.has(leaf))leaf.detach();
  const main=[...original.leaves].find(l=>l.view.file?.path===original.active);if(main)app.workspace.setActiveLeaf(main,{focus:false});
  c.activePath=original.active;v.state=original.state;p.searchItem=original.searchItem;p.mode=original.mode;p.modeSelect.value=original.mode;p.focusPath=original.focus;p.follow=original.follow;p.followBox.checked=p.follow;p.explore=original.explore;p.exploreBox.checked=p.explore;p.closeDetails();p.renderContext();v.switchTab(original.tab);c.notify();
 }
}
evaluate(`(()=>{window.__emWorkspaceCheck={done:false};(${check.toString()})().then(report=>window.__emWorkspaceCheck={done:true,report}).catch(e=>window.__emWorkspaceCheck={done:true,failure:String(e),stack:e.stack});return true;})()`);
let result;
for(let i=0;i<150;i++){result=evaluate('window.__emWorkspaceCheck');if(result.done)break;await new Promise(resolve=>setTimeout(resolve,100));}
if(!result?.done||result.failure)throw Error(JSON.stringify(result));
writeFileSync('docs/workspace-native-check.json',JSON.stringify(result.report,null,2)+'\n');console.log(JSON.stringify(result.report,null,2));evaluate('delete window.__emWorkspaceCheck');
