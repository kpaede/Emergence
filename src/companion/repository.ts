import {MarkdownView,type App,type TFile} from 'obsidian';
import {t} from '../i18n';
import {parseCompanion} from './codec';
import {parseDocument} from 'yaml';
import {hasCompanionMetadata} from './chapter-recovery';
export function validPath(path:unknown):path is string{return typeof path==='string'&&!!path&&path.endsWith('.md')&&!path.startsWith('/')&&!/[\0\r\n\\:#|^[\]]/u.test(path)&&!path.split('/').some(part=>!part||part==='.'||part==='..'||part.startsWith('.'));}
export function sourceEditor(app:App,path:string):MarkdownView|undefined{
 return app.workspace.getLeavesOfType('markdown').map(leaf=>leaf.view).find((view):view is MarkdownView=>view instanceof MarkdownView&&view.file?.path===path&&view.getMode()==='source');
}
export async function readNote(app:App,path:string,cached=false):Promise<string>{const file=app.vault.getFileByPath(path);if(!validPath(path)||!file)throw new Error(t('companion.sourceMissing'));const views=app.workspace.getLeavesOfType('markdown').map(leaf=>leaf.view).filter((view):view is MarkdownView=>view instanceof MarkdownView&&view.file?.path===path&&view.getMode()==='source'),text=views[0]?.editor.getValue();if(text!==undefined){if(views.some(view=>view.editor.getValue()!==text))throw new Error(t('companion.editorConflict'));return text;}return await (cached&&typeof app.vault.cachedRead==='function'?app.vault.cachedRead(file):app.vault.read(file));}
export function minimalChange(before:string,after:string):{from:number;to:number;insert:string}{
 let from=0,to=before.length,end=after.length;while(from<to&&from<end&&before[from]===after[from])from++;while(to>from&&end>from&&before[to-1]===after[end-1]){to--;end--;}return {from,to,insert:after.slice(from,end)};
}
/** The only write boundary. An ordinary source document can never pass this guard. */
export async function writeCompanion(app:App,path:string,before:string,after:string):Promise<void>{
 if(before===after)return;const old=parseCompanion(before),next=parseCompanion(after);if(old.id!==next.id)throw new Error(t('companion.conflict'));
 await writeExact(app,path,before,after);
}
/** Only an explicitly previewed ordinary file can enter the chapter-file format. */
export async function writeChapterAdoption(app:App,indexPath:string,path:string,original:string,chapter:string,restore:boolean,protectedSource:(path:string)=>boolean):Promise<void>{
 const index=parseCompanion(await readNote(app,indexPath)),part=parseCompanion(chapter),metadata=parseDocument(part.header),source=app.vault.getFileByPath(index.source)?.path??app.metadataCache.getFirstLinkpathDest?.(index.source.replace(/\.md$/u,''),indexPath)?.path??index.source;
 const check=()=>{if(path===indexPath||path===source||protectedSource(path)||part.source===path||part.source!==source&&part.source!==index.source||hasCompanionMetadata(original)||metadata.get('emergence-companion-role')!=='section'||metadata.get('emergence-parent-companion-id')!==index.id||part.sections.length!==1||!index.sections.some(section=>section.id===part.sections[0]?.id))throw new Error(t('companion.chapterFileBelongsElsewhere'));};
 check();await writeExact(app,path,restore?chapter:original,restore?original:chapter,check);
}
async function writeExact(app:App,path:string,before:string,after:string,check:()=>void=()=>{}):Promise<void>{
 const file=app.vault.getFileByPath(path);if(!file||!validPath(path))throw new Error(t('companion.sourceMissing'));
 const mindmap=app.workspace.getLeavesOfType('mindmap-view').some(leaf=>(leaf.view as {file?:TFile}).file?.path===path);if(mindmap)throw new Error(t('companion.mindmapBusy'));
 const view=sourceEditor(app,path);
 if(view){check();if(view.editor.getValue()!==before)throw new Error(t('companion.conflict'));const change=minimalChange(before,after);view.editor.replaceRange(change.insert,view.editor.offsetToPos(change.from),view.editor.offsetToPos(change.to),'emergence-companion');}
 else await app.vault.process(file,current=>{check();if(current!==before)throw new Error(t('companion.conflict'));return after;});
}
