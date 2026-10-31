import type {PaneType} from 'obsidian';
import type {EmergenceController} from '../controller';
import type {SynopsisNote} from '../graph/synopsis-types';

/** Reuse the main editor; an explicit click on an unresolved link uses native Obsidian creation. */
export async function openSynopsisNote(controller:EmergenceController,note:SynopsisNote,newLeaf:PaneType|boolean=false):Promise<void>{
 const {app}=controller;
 const file=note.path?app.vault.getFileByPath(note.path):app.metadataCache.getFirstLinkpathDest(note.linktext,note.sourcePath);
 if(file){
  const leaf=newLeaf?app.workspace.getLeaf(newLeaf):app.workspace.getMostRecentLeaf(app.workspace.rootSplit)??app.workspace.getLeaf('tab');
  await leaf.openFile(file,{active:true});return;
 }
 const main=app.workspace.getMostRecentLeaf(app.workspace.rootSplit);if(main)app.workspace.setActiveLeaf(main,{focus:false});
 await app.workspace.openLinkText(note.linktext,note.sourcePath,newLeaf);
}
export async function openGraphNote(controller:EmergenceController,path:string,newLeaf:PaneType|boolean=false):Promise<boolean>{
 const file=controller.app.vault.getFileByPath(path);if(!file)return false;
 await openSynopsisNote(controller,{id:path,path,title:file.basename,linktext:path,sourcePath:'',exists:true},newLeaf);return true;
}
