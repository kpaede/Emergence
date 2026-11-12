import {writeFileSync} from 'node:fs';
import {evaluate, reloadPlugin} from './obsidian-cli.mjs';

reloadPlugin();
async function check() {
 const v=app.workspace.getLeavesOfType('emergence-workspace')[0].view,c=v.controller,p=v.graphPanel;
 if(c.abort||c.applyingIdea)throw Error('Eine Benutzeraktion läuft.');
 const wait=ms=>new Promise(resolve=>window.setTimeout(resolve,ms));
 const until=async predicate=>{for(let i=0;i<160;i++){if(predicate())return;await wait(50);}throw Error('UI timeout');};
 const original={tab:v.tab,state:JSON.parse(JSON.stringify(v.state)),focus:p.focusPath,follow:p.follow,explore:p.explore,active:c.activePath,
  leaves:new Set(app.workspace.getLeavesOfType('markdown')),files:app.vault.getFiles().length,settings:JSON.stringify(c.settings())};
 const report={};const assert=(name,condition)=>{report[name]=!!condition;if(!condition)throw Error(name);};

 try {
  assert('fiveTabs',JSON.stringify([...v.contentEl.querySelectorAll('.em-tabs > [role=tab]')].map(b=>b.textContent))===JSON.stringify(['Graph','Feldideen','Mermaid','Argdown','Suche']));
  assert('labelledSearchLast',!!v.contentEl.querySelector('[role=tab]:last-child[aria-label=Suche] .lucide-search'));
  assert('searchRemovedFromGraph',!v.panels.get('graph').querySelector('input[type=search]'));
  v.switchTab('graph');p.explore=false;p.exploreBox.checked=false;p.follow=true;p.focus(c.activePath);p.renderStructure();
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
  // The active note need not have a matching library entry. Use an already indexed citation for the library-action check.
  const reference=c.graph.snapshot.edges.find(e=>e.layer==='zotlit'&&e.reference?.citekey)?.reference;
  if(reference?.citekey){search.value=reference.citekey;search.dispatchEvent(new Event('input',{bubbles:true}));await until(()=>!v.contentEl.querySelector('.em-library-results [role=status]')?.textContent.includes('wird gesucht'));}
  const libraryLink=v.contentEl.querySelector('.em-library-results [data-zotlit-item]');
  assert('realLibrarySearch',!!libraryLink);await until(()=>!!v.contentEl.querySelector('.em-library-results [data-zotlit-formatted]'));assert('searchUsesZotlitCsl',true);
  const itemKey=libraryLink.dataset.zotlitItem;
  libraryLink.click();await until(()=>app.workspace.getLeavesOfType('zotlit-library').some(l=>l.view.selected?.key===itemKey));
  assert('literatureOpensSelectedLibraryItem',true);
  const countBefore=app.workspace.getLeavesOfType('zotlit-library').length;
  libraryLink.dispatchEvent(new MouseEvent('auxclick',{button:1,bubbles:true,cancelable:true}));await wait(50);
  assert('literatureMiddleClickNoExtraTab',app.workspace.getLeavesOfType('zotlit-library').length===countBefore);
  v.state.search.mode='explore';libraryLink.click();await wait(200);
  assert('libraryActionIndependentOfNoteMode',app.workspace.getLeavesOfType('zotlit-library').some(l=>l.view.selected?.key===itemKey));
  assert('userSettingsUnchanged',JSON.stringify(c.settings())===original.settings);
  assert('noFilesCreated',app.vault.getFiles().length===original.files);
  report.notesWritten=0;report.syntheticModelCalls=0;
  return report;
 } catch(error) {throw Error(String(error)+' '+JSON.stringify(report));} finally {
  v.controller=c;
  for(const leaf of app.workspace.getLeavesOfType('markdown'))if(!original.leaves.has(leaf))leaf.detach();
  const main=[...original.leaves].find(l=>l.view.file?.path===original.active);if(main)app.workspace.setActiveLeaf(main,{focus:false});
  c.activePath=original.active;v.state=original.state;p.focusPath=original.focus;p.follow=original.follow;p.explore=original.explore;p.exploreBox.checked=p.explore;p.details.hidden=true;p.renderStructure();v.switchTab(original.tab);c.notify();
 }
}
evaluate(`(()=>{window.__emWorkspaceCheck={done:false};(${check.toString()})().then(report=>window.__emWorkspaceCheck={done:true,report}).catch(e=>window.__emWorkspaceCheck={done:true,failure:String(e),stack:e.stack});return true;})()`);
let result;
for(let i=0;i<150;i++){result=evaluate('window.__emWorkspaceCheck');if(result.done)break;await new Promise(resolve=>setTimeout(resolve,100));}
if(!result?.done||result.failure)throw Error(JSON.stringify(result));
writeFileSync('docs/workspace-native-check.json',JSON.stringify(result.report,null,2)+'\n');console.log(JSON.stringify(result.report,null,2));evaluate('delete window.__emWorkspaceCheck');
