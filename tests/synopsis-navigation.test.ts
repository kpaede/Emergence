import {describe,it,expect,vi} from 'vitest';
import type {EmergenceController} from '../src/controller';
import {openSynopsisNote} from '../src/ui/graph-navigation';
const ref={id:'a',title:'Note',linktext:'Ordner/Note',sourcePath:'Quelle.md',exists:false};
function controller(){const main={openFile:vi.fn(async()=>{})},tab={openFile:vi.fn(async()=>{})},file={path:'Ordner/Note.md'};
 const app={vault:{getFileByPath:vi.fn(()=>file)},metadataCache:{getFirstLinkpathDest:vi.fn(()=>undefined as unknown)},workspace:{rootSplit:{},getMostRecentLeaf:vi.fn(()=>main),getLeaf:vi.fn(()=>tab),setActiveLeaf:vi.fn(),openLinkText:vi.fn(async()=>{})}};
 return {c:{app} as unknown as EmergenceController,app,main,tab,file};}
describe('native synopsis navigation',()=>{
 it('opens an existing Markdown file in the main editor, preserving the sidebar',async()=>{const {c,app,main,file}=controller();await openSynopsisNote(c,{...ref,exists:true,path:file.path});expect(main.openFile).toHaveBeenCalledWith(file,{active:true});expect(app.workspace.getLeaf).not.toHaveBeenCalled();});
 it('passes an explicitly clicked unresolved link and source to Obsidian, without creating files itself',async()=>{const {c,app,main}=controller();await openSynopsisNote(c,ref);expect(app.workspace.setActiveLeaf).toHaveBeenCalledWith(main,{focus:false});expect(app.workspace.openLinkText).toHaveBeenCalledWith(ref.linktext,ref.sourcePath,false);});
 it('honors a modifier-selected new tab',async()=>{const {c,app,tab,file}=controller();await openSynopsisNote(c,{...ref,path:file.path,exists:true},'tab');expect(app.workspace.getLeaf).toHaveBeenCalledWith('tab');expect(tab.openFile).toHaveBeenCalledWith(file,{active:true});});
});
