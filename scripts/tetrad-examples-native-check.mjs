import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {command,evaluate,reloadPlugin} from './obsidian-cli.mjs';
if(command('vault',['info=path'])!==resolve('../../..'))throw Error('Wrong vault.');
const notes=['Crowd','Microphone','Newspaper'].map(name=>({name,path:'Emergence Beispiele/Tetraden/'+name+'.md',source:readFileSync('examples/tetrads/'+name+'.md','utf8')}));
const output='/tmp/emergence-tetrad-examples';mkdirSync(output,{recursive:true});reloadPlugin();
async function check(notes,output){
 const plugin=app.plugins.plugins.emergence,view=app.workspace.getLeavesOfType('emergence-workspace')[0].view,p=view.tetradPanel,win=require('electron').remote.getCurrentWindow(),wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
 const saved={tab:view.tab,source:p.source,binding:p.binding,history:p.history,showSource:p.showSource,active:view.controller.activePath,leaf:app.workspace.activeLeaf,dark:document.body.classList.contains('theme-dark'),light:document.body.classList.contains('theme-light'),background:win.webContents.getBackgroundThrottling()};
 const checks={},assert=(name,value)=>{checks[name]=!!value;if(!value)throw Error(name);},until=async predicate=>{for(let n=0;n<200;n++){if(await predicate())return;await wait(30);}throw Error('Timeout');};
 const lines=element=>{const range=element.ownerDocument.createRange();range.selectNodeContents(element);const result=[];for(const rect of range.getClientRects()){if(!rect.width||!rect.height)continue;let line=result.find(line=>Math.abs(line.top-rect.top)<3);if(!line){line={top:rect.top,left:rect.left,right:rect.right};result.push(line);}else{line.left=Math.min(line.left,rect.left);line.right=Math.max(line.right,rect.right);}}return result.sort((a,b)=>a.top-b.top);};
 let leaf;
 try{
  win.webContents.setBackgroundThrottling(false);
  // Deliberately installed examples are kept. Existing authored files are never overwritten.
  for(const note of notes){const file=app.vault.getFileByPath(note.path);if(file&&(await app.vault.read(file))!==note.source)throw Error('Existing example has different contents: '+note.path);}
  for(const folder of ['Emergence Beispiele','Emergence Beispiele/Tetraden'])if(!app.vault.getAbstractFileByPath(folder))await app.vault.createFolder(folder);
  for(const note of notes)if(!app.vault.getFileByPath(note.path))await app.vault.create(note.path,note.source);
  await plugin.tetradStore.setDisplay({...plugin.tetradStore.display,centerDisplay:'none',legendPosition:'none'});
  leaf=app.workspace.getLeaf('tab');view.switchTab('tetrad');if(p.showSource)p.toggleSource();await wait(2500);
  for(const note of notes){
   const file=app.vault.getFileByPath(note.path);await leaf.openFile(file);await leaf.setViewState({type:'markdown',state:{file:file.path,mode:'preview'}});view.controller.activePath=file.path;await p.openBlock(file,0);await wait(250);
   assert(note.name+'FourCores',p.preview.querySelectorAll('[data-em-core]').length===4);assert(note.name+'NoLegend',p.preview.querySelector('.tetrader-corner-legend').hidden);
   for(const wing of p.preview.querySelectorAll('[data-em-law]')){
    const paragraphs=[...wing.querySelectorAll('.tetrader-gloss > p')],stream=wing.querySelector('.tetrader-glosses');if(!paragraphs.length)continue;
    const rect=stream.getBoundingClientRect(),rows=[...stream.querySelectorAll('.tetrader-gloss')];if(!stream.classList.contains('is-single-line'))assert(note.name+wing.dataset.emLaw+'FullParagraphWidth',rows.every(row=>Math.abs(row.getBoundingClientRect().width-rect.width)<1));assert(note.name+wing.dataset.emLaw+'NoTrailingBlankRows',Math.abs(rect.height-(rows.at(-1).getBoundingClientRect().bottom-rows[0].getBoundingClientRect().top))<2);
    const lineBoxes=lines(paragraphs[0]);assert(note.name+wing.dataset.emLaw+'AutomaticWrapping',lineBoxes.length>1||paragraphs.length>1);
   }
   await until(()=>leaf.view.previewMode.containerEl.querySelector('.tetrader-tetrad'));assert(note.name+'ReadingViewWorks',leaf.view.previewMode.containerEl.querySelectorAll('.tetrader-law').length===4);
   for(const theme of ['light','dark']){
    document.body.toggleClass('theme-light',theme==='light');document.body.toggleClass('theme-dark',theme==='dark');app.workspace.trigger('css-change');p.preview.scrollTop=0;document.activeElement?.blur();await wait(200);
    const rect=p.preview.getBoundingClientRect();require('fs').writeFileSync(output+'/'+note.name+'-'+theme+'.png',(await win.capturePage({x:Math.round(rect.x),y:Math.round(rect.y),width:Math.round(rect.width),height:Math.round(rect.height)})).toPNG());
   }
   assert(note.name+'SourceUnchanged',(await app.vault.read(file))===note.source);
  }
  return {paths:notes.map(note=>note.path),checks};
 }finally{
  p.graph?.cancelEdit();await p.flush();p.binding=undefined;if(leaf){await leaf.setViewState({type:'empty',state:{}});leaf.detach();}
  document.body.toggleClass('theme-dark',saved.dark);document.body.toggleClass('theme-light',saved.light);app.workspace.trigger('css-change');view.controller.activePath=saved.active;
  if(saved.binding)await p.openBlock(saved.binding.file,saved.binding.index);else await p.newDraft(saved.source);p.history=saved.history;if(p.showSource!==saved.showSource)p.toggleSource();view.switchTab(saved.tab);if(saved.leaf)app.workspace.setActiveLeaf(saved.leaf,{focus:false});win.webContents.setBackgroundThrottling(saved.background);
 }
}
evaluate(`(()=>{window.__emTetradExamples={done:false};(${check.toString()})(${JSON.stringify(notes)},${JSON.stringify(output)}).then(report=>window.__emTetradExamples={done:true,report}).catch(error=>window.__emTetradExamples={done:true,failure:error.stack});return true;})()`);
let result;for(let i=0;i<600;i++){result=evaluate('window.__emTetradExamples');if(result.done)break;await new Promise(resolve=>setTimeout(resolve,100));}
if(!result?.done||result.failure)throw Error(JSON.stringify(result));writeFileSync(output+'/checks.json',JSON.stringify(result.report,null,2)+'\n');console.log(JSON.stringify(result.report,null,2));evaluate('delete window.__emTetradExamples');
