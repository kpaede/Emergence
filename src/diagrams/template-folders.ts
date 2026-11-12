import {Component,TFile,TFolder,type App} from 'obsidian';
import type {Settings} from '../types';
import {t as tr} from '../i18n';
import {fencedSource} from '../mermaid/blocks';
import type {MermaidLibrary,MermaidTemplate} from '../mermaid/library';
import {templatesInNote,validTemplateFolder,type TemplateKind} from './template-notes';
import {featureEnabled} from '../features';

/** Folder access is scoped to the two configured vault folders and uses public Vault APIs. */
export class TemplateFolders extends Component {
 private timers=new Map<TemplateKind,number>();private generation={mermaid:0,argdown:0};private disposed=false;
 constructor(private app:App,private settings:()=>Settings,private libraries:Record<TemplateKind,MermaidLibrary>){
  super();for(const kind of ['mermaid','argdown'] as const)libraries[kind].connectFolder({enabled:()=>!!this.path(kind),refresh:()=>this.refresh(kind),add:(name,source)=>this.add(kind,name,source),open:item=>this.open(item)});
 }
 onload():void{
  const changed=(path:string)=>{for(const kind of ['mermaid','argdown'] as const){const folder=this.path(kind);if(featureEnabled(this.settings(),kind)&&folder&&(path===folder||path.startsWith(folder+'/')||folder.startsWith(path+'/')))this.schedule(kind);}};
  this.registerEvent(this.app.vault.on('create',file=>changed(file.path)));
  this.registerEvent(this.app.vault.on('modify',file=>changed(file.path)));
  this.registerEvent(this.app.vault.on('delete',file=>changed(file.path)));
  this.registerEvent(this.app.vault.on('rename',(file,oldPath)=>{changed(file.path);changed(oldPath);}));
  this.register(()=>{this.disposed=true;for(const timer of this.timers.values())window.clearTimeout(timer);this.generation.mermaid++;this.generation.argdown++;});
 }
 private path(kind:TemplateKind):string{return this.settings().templateFolders?.[kind]??'';}
 pause(kind:TemplateKind):void{const timer=this.timers.get(kind);if(timer)window.clearTimeout(timer);this.timers.delete(kind);this.generation[kind]++;}
 private schedule(kind:TemplateKind):void{const previous=this.timers.get(kind);if(previous)window.clearTimeout(previous);this.timers.set(kind,window.setTimeout(()=>{this.timers.delete(kind);void this.refresh(kind);},180));}
 async refresh(kind:TemplateKind):Promise<void>{
  if(!featureEnabled(this.settings(),kind)){this.pause(kind);return;}
  const generation=++this.generation[kind],path=this.path(kind),library=this.libraries[kind];
  if(!path){library.setFolderTemplates([]);return;}
  const folder=this.app.vault.getAbstractFileByPath(path);
  if(!validTemplateFolder(path,this.app.vault.configDir)||!(folder instanceof TFolder)){library.setFolderTemplates([],tr('settings.templateFolderMissing',{path}));return;}
  const files:TFile[]=[],pending=[folder];while(pending.length){for(const child of pending.pop()!.children){if(child.name.startsWith('.')||child.path===this.app.vault.configDir)continue;if(child instanceof TFolder)pending.push(child);else if(child instanceof TFile&&child.extension.toLowerCase()==='md')files.push(child);}}
  files.sort((a,b)=>a.path.localeCompare(b.path));const items:MermaidTemplate[]=[],errors:string[]=[];
  for(const file of files){
   if(this.disposed||generation!==this.generation[kind]||path!==this.path(kind))return;
   const filePath=file.path;if(!filePath.startsWith(path+'/'))continue;
   try{const source=await this.app.vault.cachedRead(file);if(file.path===filePath)items.push(...templatesInNote(filePath,source,kind));}catch{errors.push(tr('settings.templateReadError',{path:filePath}));}
  }
  if(!this.disposed&&generation===this.generation[kind]&&path===this.path(kind))library.setFolderTemplates(items,errors.join('\n'));
 }
 private async add(kind:TemplateKind,name:string,source:string):Promise<void>{
  const folder=this.path(kind);if(!validTemplateFolder(folder,this.app.vault.configDir)||!(this.app.vault.getAbstractFileByPath(folder) instanceof TFolder))throw new Error(tr('settings.templateFolderMissing',{path:folder}));
  const base=name.replace(/[\\/:*?"<>|#[\]\r\n\0]/gu,' ').replace(/\s+/gu,' ').replace(/^\.+|[. ]+$/gu,'').trim()||'Template';
  const content='# '+name.replace(/[\r\n]/gu,' ')+'\n\n'+fencedSource(source,kind)+'\n';
  for(let index=0;index<1000;index++){
   const path=folder+'/'+base+(index?' '+String(index+1):'')+'.md';if(this.app.vault.getAbstractFileByPath(path))continue;
   // Vault.create refuses an existing path; never modify or overwrite a template note.
   await this.app.vault.create(path,content);await this.refresh(kind);return;
  }
  throw new Error(tr('mermaid.enter_a_name'));
 }
 private async open(item:MermaidTemplate):Promise<void>{if(!item.path)return;const file=this.app.vault.getFileByPath(item.path);if(file)await this.app.workspace.getLeaf('tab').openFile(file,{eState:{line:item.line??0}});}
}
