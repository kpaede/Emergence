import {parseLinktext,type App} from 'obsidian';

/** Standard drag payloads only; resolved vault URLs become ordinary Markdown links. */
export function companionDropText(event:DragEvent,app:App,destination:string):string|undefined{
 const transfer=event.dataTransfer;if(!transfer)return;
 const plain=transfer.getData('text/plain'),text=plain||transfer.getData('text/uri-list').split(/\r?\n/u).filter(line=>line&&!line.startsWith('#')).join('\n');if(!text.trim())return;
 return text.split(/\r?\n/u).map(line=>{
  if(!line.trim().startsWith('obsidian://'))return line;
  try{const url=new URL(line.trim());if(url.hostname!=='open'||url.searchParams.has('vault')&&url.searchParams.get('vault')!==app.vault.getName())return line;const target=url.searchParams.get('file');if(!target)return line;const {path,subpath}=parseLinktext(target),file=app.vault.getFileByPath(path)??app.vault.getFileByPath(path+'.md');return file?app.fileManager.generateMarkdownLink(file,destination,subpath):line;}catch{return line;}
 }).join('\n');
}
