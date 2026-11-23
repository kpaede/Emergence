// @vitest-environment jsdom
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {MarkdownView,TFile,type App,type Editor,type WorkspaceLeaf} from 'obsidian';
import {installDomHelpers} from './helpers/dom';
import {TetradPanel} from '../src/tetrad/panel';
import {TetradBinding} from '../src/tetrad/binding';
import {DEFAULT_PATTERN,TetradStore} from '../src/tetrad/patterns';
import {editSection,starter,tetradBlocks} from '../src/tetrad/source';

vi.mock('obsidian',async importOriginal=>{
 const {TestComponent,TestModal}=await import('./helpers/reader-host');
 return {...await importOriginal<Record<string,unknown>>(),Component:class extends TestComponent{load():void{}},Modal:TestModal,
  MarkdownRenderer:{render:vi.fn(async(_app:unknown,text:string,host:HTMLElement)=>{host.createEl('p',{text});})}};
});
vi.mock('../src/mermaid/code-editor',()=>({MermaidCodeEditor:class{
 readonly view:{dom:HTMLElement;focus:ReturnType<typeof vi.fn>};
 constructor(host:HTMLElement){this.view={dom:host.createDiv({cls:'cm-editor'}),focus:vi.fn()};}
 setReadOnly=vi.fn();setSource=vi.fn();setLabel=vi.fn();highlight=vi.fn();destroy=vi.fn();
}}));

interface PanelState {
 source:string;savedSource:string;session:number;disposed:boolean;failed:boolean;showSource:boolean;binding?:TetradBinding;
 newButton:HTMLButtonElement;insertButton:HTMLButtonElement;sourceButton:HTMLButtonElement;error:HTMLElement;status:HTMLElement;
 editor:{setSource:ReturnType<typeof vi.fn>;view:{focus:ReturnType<typeof vi.fn>}};
 graph?:{editing:boolean;saving:boolean;flush():Promise<void>;focus():void};layout?:{destroy:()=>void};commit(source:string):Promise<void>;
}
const panels:TetradPanel[]=[];
beforeEach(()=>{
 installDomHelpers();document.body.empty();
 const createEl=Object.getOwnPropertyDescriptor(HTMLElement.prototype,'createEl')!.value as (this:HTMLElement,tag:keyof HTMLElementTagNameMap,options?:DomElementInfo)=>HTMLElement;
 Object.defineProperty(HTMLElement.prototype,'createEl',{configurable:true,value:function(this:HTMLElement,tag:keyof HTMLElementTagNameMap,options?:DomElementInfo&{value?:string}){
  const element=createEl.call(this,tag,options);if(tag==='option'&&options?.value!==undefined)(element as HTMLOptionElement).value=options.value;return element;
 }});
 Object.defineProperty(HTMLElement.prototype,'toggleClass',{configurable:true,value:function(this:HTMLElement,name:string,on:boolean){this.classList.toggle(name,on);}});
 vi.stubGlobal('createDiv',(options?:DomElementInfo)=>{const element=document.body.createDiv(options);element.remove();return element;});
});
afterEach(()=>{for(const panel of panels.splice(0))panel.unload();vi.restoreAllMocks();vi.unstubAllGlobals();document.body.empty();});
function gate<T>(){let release!:(value:T)=>void;const promise=new Promise<T>(resolve=>{release=resolve;});return {promise,release};}
function file(path:string):TFile{const result=new TFile();result.path=path;result.basename=path.replace(/\.md$/u,'');return result;}
async function fixture(){
 const fileA=file('A.md'),fileB=file('B.md'),sourceA=starter(DEFAULT_PATTERN,'Alpha'),sourceB=starter(DEFAULT_PATTERN,'Beta');
 const notes=new Map([[fileA.path,'Plain A\n'],[fileB.path,'Intro B\n\n'+sourceB+'\nEnd B']]),files=new Map([[fileA.path,fileA],[fileB.path,fileB]]);
 let active:TFile|undefined=fileA;
 const read=vi.fn(async(target:TFile)=>notes.get(target.path)!);
 const process=vi.fn(async(target:TFile,change:(text:string)=>string)=>{const next=change(notes.get(target.path)!);notes.set(target.path,next);return next;});
 const app={workspace:{getLeavesOfType:()=>[],on:vi.fn()},vault:{read,process,getFileByPath:(path:string)=>files.get(path),on:vi.fn()}} as unknown as App;
 const host=document.body.createDiv(),store=new TetradStore(undefined,async()=>{}),panel=new TetradPanel(app,host,()=>active,store);panels.push(panel);
 const state=panel as unknown as PanelState,render=vi.spyOn(panel,'render').mockResolvedValue();
 await panel.newDraft(sourceA);render.mockClear();
 return {app,panel,state,render,fileA,fileB,sourceA,sourceB,notes,read,process,setCurrent:(target:TFile|undefined)=>{active=target;}};
}

describe('Tetrader panel insertion and document changes',()=>{
 it('starts a fresh diagram after an existing one and exposes insertion instead of create',async()=>{
  const f=await fixture();f.setCurrent(f.fileB);await f.panel.openBlock(f.fileB,0);expect(f.state.newButton.hidden).toBe(false);expect(f.state.insertButton.hidden).toBe(false);expect(f.state.insertButton.disabled).toBe(true);
  const original=f.notes.get(f.fileB.path);await f.panel.createNew();expect(f.state.binding).toBeUndefined();expect(f.state.newButton.hidden).toBe(false);expect(f.state.insertButton.hidden).toBe(false);expect(f.panel.source).not.toContain('Beta');expect(f.notes.get(f.fileB.path)).toBe(original);
  await f.panel.insert();expect(tetradBlocks(f.notes.get(f.fileB.path)!,[DEFAULT_PATTERN])).toHaveLength(2);expect(f.state.binding?.index).toBe(1);expect(f.state.newButton.hidden).toBe(false);
 });
 it('starts a fresh uninserted diagram and keeps the previous content available through Undo',async()=>{const f=await fixture();await f.panel.createNew();expect(f.panel.source).not.toBe(f.sourceA);expect(f.process).not.toHaveBeenCalled();await f.panel.undo();expect(f.panel.source).toBe(f.sourceA);});
 it('finishes an active field before insertion without waiting on its own insertion promise',async()=>{
  const f=await fixture(),latest=editSection(f.sourceA,DEFAULT_PATTERN,'enhances','Current input\nsecond line'),graph={editing:true,saving:false,focus:vi.fn(),flush:vi.fn(async()=>{await f.state.commit(latest);graph.editing=false;})};f.state.graph=graph;
  await f.panel.insert();expect(graph.flush).toHaveBeenCalledOnce();expect(f.notes.get(f.fileA.path)).toContain('> Current input\n> second line');expect(tetradBlocks(f.notes.get(f.fileA.path)!,[DEFAULT_PATTERN])).toHaveLength(1);f.state.graph=undefined;
 });
 it('keeps the target selected at click time while finishing an active field',async()=>{
  const f=await fixture(),waiting=gate<void>(),started=gate<void>(),graph={editing:true,saving:false,focus:vi.fn(),flush:vi.fn(async()=>{started.release();await waiting.promise;graph.editing=false;})};f.state.graph=graph;
  const inserting=f.panel.insert();await started.promise;f.setCurrent(f.fileB);waiting.release();await inserting;expect(f.process.mock.calls[0]?.[0]).toBe(f.fileA);expect(tetradBlocks(f.notes.get(f.fileB.path)!,[DEFAULT_PATTERN])).toHaveLength(1);f.state.graph=undefined;
 });
 it('leaves a failed edit open instead of starting a new diagram',async()=>{
  const f=await fixture();f.setCurrent(f.fileB);await f.panel.openBlock(f.fileB,0);const binding=f.state.binding,graph={editing:true,saving:false,focus:vi.fn(),flush:vi.fn(async()=>{throw Error('Disk full');})};f.state.graph=graph;
  await expect(f.panel.createNew()).rejects.toThrow('Disk full');expect(f.state.binding).toBe(binding);expect(f.panel.source).toBe(f.sourceB);expect(f.state.newButton.disabled).toBe(false);f.state.graph=undefined;
 });
 it('keeps creation usable without a target note and disables insertion with an explanation',async()=>{const f=await fixture();f.setCurrent(undefined);f.panel.context();expect(f.state.insertButton.disabled).toBe(true);expect(f.state.status.textContent).toContain('Markdown');await expect(f.panel.insert()).rejects.toThrow('Markdown');expect(f.process).not.toHaveBeenCalled();});
 it('removes the redundant status row for an inserted tetrad',async()=>{const f=await fixture();await f.panel.openBlock(f.fileB,0);f.panel.context();expect(f.state.status.hidden).toBe(true);expect(f.state.status.textContent).toBe('');expect(f.state.insertButton.disabled).toBe(true);});
 it('inserts at the actual cursor in a source editor and preserves text on both sides',async()=>{
  const f=await fixture();let note='Before After';const editor={getValue:()=>note,getCursor:()=>({line:0,ch:7}),posToOffset:(p:{line:number;ch:number})=>p.ch,offsetToPos:(offset:number)=>({line:0,ch:offset}),replaceRange:(text:string,p:{ch:number})=>{note=note.slice(0,p.ch)+text+note.slice(p.ch);}} as unknown as Editor;
  const view=new MarkdownView({} as WorkspaceLeaf);Object.assign(view,{file:f.fileA,editor,getMode:()=> 'source'});f.app.workspace.getLeavesOfType=()=>[{view} as unknown as WorkspaceLeaf];
  await f.panel.insert();expect(note).toMatch(/^Before \n\n> \[!tetrad\]/u);expect(note).toMatch(/\n\nAfter$/u);expect(f.process).not.toHaveBeenCalled();expect(f.state.binding?.file).toBe(f.fileA);
 });
 it('captures the intended file and source before an asynchronous note read',async()=>{
  const f=await fixture(),read=gate<string>(),beforeB=f.notes.get(f.fileB.path)!;
  f.read.mockImplementationOnce(async()=>read.promise);const inserting=f.panel.insert();
  f.setCurrent(f.fileB);f.state.source=starter(DEFAULT_PATTERN,'Later editor text');read.release('Plain A\n');await inserting;
  expect(f.process).toHaveBeenCalledOnce();expect(f.process.mock.calls[0]?.[0]).toBe(f.fileA);
  expect(f.notes.get(f.fileA.path)).toContain(f.sourceA.trimEnd());expect(f.notes.get(f.fileA.path)).not.toContain('Later editor text');expect(f.notes.get(f.fileB.path)).toBe(beforeB);
 });

 it('shares one pending insertion instead of creating duplicate blocks',async()=>{
  const f=await fixture(),saving=gate<void>(),started=gate<void>();
  f.process.mockImplementationOnce(async(target,change)=>{started.release();await saving.promise;const next=change(f.notes.get(target.path)!);f.notes.set(target.path,next);return next;});
  const first=f.panel.insert(),second=f.panel.insert();expect(second).toBe(first);await started.promise;
  expect(f.state.insertButton.disabled).toBe(true);saving.release();await Promise.all([first,second]);
  expect(f.process).toHaveBeenCalledOnce();expect(tetradBlocks(f.notes.get(f.fileA.path)!,[DEFAULT_PATTERN])).toHaveLength(1);expect(f.state.binding?.file).toBe(f.fileA);
 });

 it('waits for an already writing insertion before opening another block and never rebinds the old file',async()=>{
  const f=await fixture(),saving=gate<void>(),started=gate<void>();
  f.process.mockImplementationOnce(async(target,change)=>{started.release();await saving.promise;const next=change(f.notes.get(target.path)!);f.notes.set(target.path,next);return next;});
  const inserting=f.panel.insert();await started.promise;f.setCurrent(f.fileB);const switching=f.panel.openBlock(f.fileB,0);
  await Promise.resolve();expect(f.read.mock.calls.some(call=>call[0]===f.fileB)).toBe(false);expect(f.state.binding).toBeUndefined();
  saving.release();await Promise.all([inserting,switching]);
  expect(f.notes.get(f.fileA.path)).toContain(f.sourceA.trimEnd());expect(f.state.binding?.file).toBe(f.fileB);expect(f.panel.source).toBe(f.sourceB);expect(f.render).toHaveBeenCalledOnce();
  await Promise.resolve();expect(f.state.binding?.file).toBe(f.fileB);
 });

 it('cancels an insertion that has not started writing when a newer document is requested',async()=>{
  const f=await fixture(),reading=gate<string>();f.read.mockImplementationOnce(async()=>reading.promise);
  const inserting=f.panel.insert();f.setCurrent(f.fileB);const switching=f.panel.openBlock(f.fileB,0);
  reading.release('Plain A\n');const result=await Promise.allSettled([inserting,switching]);
  expect(result.map(item=>item.status)).toEqual(['rejected','fulfilled']);expect(f.process).not.toHaveBeenCalled();expect(f.notes.get(f.fileA.path)).toBe('Plain A\n');
  expect(f.state.binding?.file).toBe(f.fileB);expect(f.panel.source).toBe(f.sourceB);
 });

 it('does not publish an insertion result after the panel is disposed',async()=>{
  const f=await fixture(),saving=gate<void>(),started=gate<void>();
  f.process.mockImplementationOnce(async(target,change)=>{started.release();await saving.promise;const next=change(f.notes.get(target.path)!);f.notes.set(target.path,next);return next;});
  const inserting=f.panel.insert();await started.promise;f.state.disposed=true;saving.release();await inserting;
  expect(f.notes.get(f.fileA.path)).toContain(f.sourceA.trimEnd());expect(f.state.binding).toBeUndefined();expect(f.render).not.toHaveBeenCalled();
 });
});

describe('Tetrader direct actions',()=>{
 it('has no manual block picker or extra selector row',async()=>{const f=await fixture();expect(f.panel.root.querySelector('select')).toBeNull();expect(f.panel.root.querySelector('.em-mm-context')).toBeNull();});
 it('keeps the new and insert actions distinct after binding',async()=>{const f=await fixture(),newLabel=f.state.newButton.textContent,insertLabel=f.state.insertButton.textContent;await f.panel.insert();expect(f.state.newButton.hidden).toBe(false);expect(f.state.insertButton.hidden).toBe(false);expect(f.state.insertButton.disabled).toBe(true);expect(f.state.newButton.textContent).toBe(newLabel);expect(f.state.insertButton.textContent).toBe(insertLabel);});
 it('can show source even when accepting an active field fails',async()=>{const f=await fixture();f.state.graph={editing:true,saving:false,focus:vi.fn(),flush:vi.fn(async()=>{throw Error('Disk full');})};f.panel.toggleSource();await vi.waitFor(()=>expect(f.state.showSource).toBe(true));expect(f.state.error.textContent).toContain('Disk full');f.state.graph=undefined;});
});

describe('Tetrader accepted source and save errors',()=>{
 it('keeps the last accepted source and diagram when a submitted edit cannot be persisted',async()=>{
  const f=await fixture();f.setCurrent(f.fileB);await f.panel.openBlock(f.fileB,0);f.render.mockClear();f.state.editor.setSource.mockClear();
  const before=f.notes.get(f.fileB.path),candidate=editSection(f.sourceB,DEFAULT_PATTERN,'enhances','Never saved'),failure=Error('Disk full');
  f.process.mockRejectedValueOnce(failure);await expect(f.state.commit(candidate)).rejects.toBe(failure);
  expect(f.panel.source).toBe(f.sourceB);expect(f.state.savedSource).toBe(f.sourceB);expect(f.notes.get(f.fileB.path)).toBe(before);
  expect(f.state.editor.setSource).not.toHaveBeenCalled();expect(f.render).not.toHaveBeenCalled();
 });

 it('restores a rejected source edit and can reopen the actual externally changed original',async()=>{
  const f=await fixture();f.setCurrent(f.fileB);await f.panel.openBlock(f.fileB,0);
  f.state.source=editSection(f.sourceB,DEFAULT_PATTERN,'enhances','Rejected text');f.process.mockRejectedValueOnce(Error('Disk full'));
  await expect(f.panel.flush()).rejects.toThrow('Disk full');expect(f.panel.source).toBe(f.sourceB);expect(f.state.failed).toBe(true);expect(f.state.error.textContent).toContain('Disk full');
  const external=editSection(f.sourceB,DEFAULT_PATTERN,'enhances','External source');f.notes.set(f.fileB.path,'Intro B\n\n'+external+'\nEnd B');
  await f.panel.openBlock(f.fileB,0);expect(f.panel.source).toBe(external);expect(f.state.savedSource).toBe(external);expect(f.state.failed).toBe(false);expect(f.state.error.textContent).toBe('');
  await f.state.commit(editSection(external,DEFAULT_PATTERN,'enhances','Saved after reopen'));expect(f.notes.get(f.fileB.path)).toContain('Saved after reopen');expect(f.notes.size).toBe(2);
 });

 it('can switch blocks when its final flush rejects, without writing the rejected candidate',async()=>{
  const f=await fixture();f.setCurrent(f.fileB);await f.panel.openBlock(f.fileB,0);f.notes.set(f.fileA.path,f.sourceA);
  f.state.source=editSection(f.sourceB,DEFAULT_PATTERN,'enhances','Rejected on switch');f.process.mockRejectedValueOnce(Error('Temporary storage failure'));f.setCurrent(f.fileA);
  await f.panel.openBlock(f.fileA,0);expect(f.state.binding?.file).toBe(f.fileA);expect(f.panel.source).toBe(f.sourceA);expect(f.notes.get(f.fileB.path)).not.toContain('Rejected on switch');
 });

 it('clears the obsolete graph and reveals the source editor when the source cannot render',async()=>{
  const f=await fixture(),destroy=vi.fn();f.render.mockRestore();f.panel.preview.createDiv({text:'Obsolete graph'});f.state.layout={destroy};f.state.source='Not a Tetrad';
  await f.panel.render();
  expect(destroy).toHaveBeenCalledOnce();expect(f.panel.preview.childElementCount).toBe(0);expect(f.state.error.textContent).not.toBe('');expect(f.state.showSource).toBe(true);
  expect(f.state.sourceButton.getAttribute('aria-pressed')).toBe('true');expect(f.state.editor.view.focus).toHaveBeenCalledOnce();
 });
});
