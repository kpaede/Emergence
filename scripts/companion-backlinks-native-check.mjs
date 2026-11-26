import {evaluate} from './obsidian-cli.mjs';

evaluate(String.raw`(()=>{
 const plugin=app.plugins.plugins.emergence,view=app.workspace.getLeavesOfType('emergence-workspace')[0]?.view;
 if(!view?.graphPanel?.semantic)throw Error('Open the Emergence workspace first.');
 const state=window.__emBacklinkCheck={done:false,cases:[]},folder='_Emergence backlink check '+Date.now(),paths=Object.fromEntries(['Main','Chapter','Index','Companion','Authored','Ordinary'].map(name=>[name,folder+'/'+name+'.md']));
 const tab=app.setting.pluginTabs.find(item=>item.plugin===plugin),previous=plugin.settings.hideCompanionBacklinks,created=[];
 const check=(ok,name)=>{if(!ok)throw Error(name);state.cases.push(name);};
 const pause=()=>new Promise(resolve=>setTimeout(resolve,50));
 const references=path=>view.graphPanel.semantic.actions.backlinks(path).filter(source=>source.startsWith(folder+'/')).sort();
 const mainLink='[['+paths.Main.slice(0,-3)+']]',chapterLink='[['+paths.Chapter.slice(0,-3)+']]';
 const header=(role,extra='')=>'---\nemergence-companion-id: '+crypto.randomUUID()+'\nemergence-main-document: "'+mainLink+'"\nemergence-companion-role: '+role+'\nemergence-sections: {}\n'+extra+'---\n';
 let host,semantic;
 (async()=>{
  try{
   await app.vault.createFolder(folder);
   const contents={Main:'# Main\n',Chapter:'# Chapter\n',Ordinary:mainLink+'\n',Companion:header('document'),Authored:header('document')+'\n'+mainLink+'\n',Index:header('index','emergence-storage:\n  mode: sections\n  location: beside\n  folder: ""\nemergence-section-files:\n  section: "'+paths.Chapter+'"\n')+'\n'+chapterLink+'\n'};
   for(const [name,content]of Object.entries(contents))created.push(await app.vault.create(paths[name],content));
   let ready=false;for(let i=0;i<200;i++){if(app.metadataCache.resolvedLinks[paths.Authored]?.[paths.Main]===2&&app.metadataCache.resolvedLinks[paths.Index]?.[paths.Chapter]===1){ready=true;break;}await pause();}check(ready,'Real Obsidian link index ready');
   const core=JSON.stringify(Object.fromEntries(Object.values(paths).map(path=>[path,app.metadataCache.resolvedLinks[path]])));
   if(previous!==true)await tab.setControlValue('hideCompanionBacklinks',true);
   check(JSON.stringify(references(paths.Main))===JSON.stringify([paths.Authored,paths.Ordinary].sort()),'Generated associations hidden; authored body links retained');
   check(references(paths.Chapter).length===0,'Generated index-to-chapter reference hidden');
   host=document.body.createDiv();host.style.cssText='position:fixed;left:-10000px;top:0;width:800px;height:600px';
   semantic=new view.graphPanel.semantic.constructor(host,()=>plugin.settings,()=>{}, {backlinks:path=>view.graphPanel.semantic.actions.backlinks(path)});
   const snapshot={...view.controller.graph.snapshot,version:Date.now(),nodes:Object.values(paths).map(path=>({id:path,title:path.slice(folder.length+1,-3),aliases:[],tags:[],type:'md',exists:true,mtime:0,size:0})),edges:[]};
   const displayed=()=>[...host.querySelectorAll('.em-syn-backlinks .em-syn-register li')].map(item=>item.textContent);
   semantic.render(snapshot,paths.Main);check(displayed().length===2,'Rendered backlink list respects the default filter');
   await tab.setControlValue('hideCompanionBacklinks',false);check(references(paths.Main).length===4,'Setting restores generated main-document backlinks');check(references(paths.Chapter).length===1,'Setting restores generated chapter backlink');
   semantic.invalidate();semantic.render(snapshot,paths.Main);check(displayed().length===4,'Rendered backlink list respects opt-out');
   check(JSON.stringify(Object.fromEntries(Object.values(paths).map(path=>[path,app.metadataCache.resolvedLinks[path]])))===core,'Native Obsidian backlinks unchanged');
   await tab.setControlValue('hideCompanionBacklinks',true);check(references(paths.Main).length===2,'Re-enabling filter applies immediately');
  }catch(error){state.failure=String(error?.stack??error);}
  finally{
   try{if(plugin.settings.hideCompanionBacklinks!==previous)await tab.setControlValue('hideCompanionBacklinks',previous);semantic?.destroy();host?.remove();for(const file of created.reverse())if(app.vault.getFileByPath(file.path))await app.vault.delete(file);const root=app.vault.getFolderByPath(folder);if(root&&!root.children.length)await app.vault.adapter.rmdir(folder,true);}catch(error){state.cleanupFailure=String(error);}
   state.done=true;
  }
 })();return {started:true};
})()`);
let result;for(let attempt=0;attempt<120;attempt++){result=evaluate('window.__emBacklinkCheck');if(result.done)break;await new Promise(resolve=>setTimeout(resolve,100));}
console.log(JSON.stringify(result,null,2));
if(!result?.done||result.failure||result.cleanupFailure)process.exitCode=1;
else evaluate('delete window.__emBacklinkCheck');
