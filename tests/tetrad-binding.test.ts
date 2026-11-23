import {describe,expect,it,vi} from 'vitest';
import {MarkdownView,TFile,type App,type Editor,type EditorPosition,type WorkspaceLeaf} from 'obsidian';
import {TetradBinding} from '../src/tetrad/binding';
import {DEFAULT_PATTERN} from '../src/tetrad/patterns';
import {editSection,starter,tetradBlocks} from '../src/tetrad/source';

const patterns=()=>[DEFAULT_PATTERN];
function fixture(){
 const original=starter(DEFAULT_PATTERN,'Medium'),file=new TFile();file.path='Medium.md';
 let text='Introduction\n\n'+original+'\nAfterword';
 const read=vi.fn(async()=>text);
 const process=vi.fn(async(_file:TFile,change:(value:string)=>string)=>{text=change(text);return text;});
 const leaves:WorkspaceLeaf[]=[];
 const app={workspace:{getLeavesOfType:()=>leaves},vault:{read,process}} as unknown as App;
 const binding=new TetradBinding(app,file,text,tetradBlocks(text,patterns())[0]!,patterns);
 return {app,file,original,binding,read,process,leaves,get:()=>text,set:(value:string)=>{text=value;}};
}
function changed(source:string,body='New text'):string{return editSection(source,DEFAULT_PATTERN,'enhances',body);}
function deferred(){let resolve!:()=>void;const promise=new Promise<void>(done=>{resolve=done;});return {promise,resolve};}

describe('Tetrad binding recovery and transactions',()=>{
 it('keeps a write failure visible until a later save succeeds, then resumes normally',async()=>{
  const f=fixture(),diskError=Error('Disk full'),candidate=changed(f.original);
  f.process.mockRejectedValueOnce(diskError);
  await expect(f.binding.save(candidate)).rejects.toBe(diskError);
  await expect(f.binding.flush()).rejects.toBe(diskError);
  expect(f.binding.source).toBe(f.original);expect(f.get()).toContain(f.original);
  await f.binding.save(candidate);await expect(f.binding.flush()).resolves.toBeUndefined();
  expect(f.binding.source).toBe(candidate);expect(f.get()).toContain(candidate);
  await f.binding.save(changed(candidate,'Another edit'));
  expect(f.get()).toContain('Another edit');
 });

 it('retries after a failed read without claiming that the candidate was saved',async()=>{
  const f=fixture(),failure=Error('Temporary read failure'),candidate=changed(f.original);
  f.read.mockRejectedValueOnce(failure);
  await expect(f.binding.save(candidate)).rejects.toBe(failure);
  expect(f.process).not.toHaveBeenCalled();expect(f.binding.source).toBe(f.original);
  await expect(f.binding.flush()).rejects.toBe(failure);
  await f.binding.save(candidate);await f.binding.flush();expect(f.get()).toContain(candidate);
 });

 it('lets an already queued newer save recover from a rejected earlier attempt',async()=>{
  const f=fixture(),first=changed(f.original,'First edit'),latest=changed(f.original,'Latest edit');
  f.process.mockRejectedValueOnce(Error('Temporary disk failure'));
  const results=await Promise.allSettled([f.binding.save(first),f.binding.save(latest)]);
  expect(results.map(result=>result.status)).toEqual(['rejected','fulfilled']);
  await expect(f.binding.flush()).resolves.toBeUndefined();
  expect(f.get()).toContain(latest);expect(f.get()).not.toContain('First edit');expect(f.binding.source).toBe(latest);
 });

 it('reports a later failing write even when an earlier queued write succeeded',async()=>{
  const f=fixture(),first=changed(f.original,'First edit'),latest=changed(f.original,'Latest edit'),failure=Error('Disconnected storage');
  f.process.mockImplementationOnce(async(_file,change)=>{f.set(change(f.get()));return f.get();}).mockRejectedValueOnce(failure);
  const results=await Promise.allSettled([f.binding.save(first),f.binding.save(latest)]);
  expect(results.map(result=>result.status)).toEqual(['fulfilled','rejected']);
  await expect(f.binding.flush()).rejects.toBe(failure);expect(f.binding.source).toBe(first);expect(f.get()).toContain(first);
  await f.binding.save(latest);await f.binding.flush();expect(f.get()).toContain(latest);
 });

 it('serializes refresh behind a pending write so it cannot restore an obsolete snapshot',async()=>{
  const f=fixture(),gate=deferred(),started=deferred(),candidate=changed(f.original);
  f.process.mockImplementationOnce(async(_file,change)=>{started.resolve();await gate.promise;f.set(change(f.get()));return f.get();});
  const save=f.binding.save(candidate);await started.promise;
  const refresh=f.binding.refresh();await Promise.resolve();expect(f.read).toHaveBeenCalledTimes(1);
  gate.resolve();await Promise.all([save,refresh]);
  expect(f.binding.source).toBe(candidate);expect(f.read).toHaveBeenCalledTimes(2);
  await f.binding.save(changed(candidate,'After refresh'));expect(f.get()).toContain('After refresh');
 });

 it('clears a transient failure after successfully refreshing an unchanged original block',async()=>{
  const f=fixture(),candidate=changed(f.original);
  f.process.mockRejectedValueOnce(Error('Disk unavailable'));await expect(f.binding.save(candidate)).rejects.toThrow('Disk unavailable');
  f.set('Added before\n'+f.get());await f.binding.refresh();
  await expect(f.binding.flush()).resolves.toBeUndefined();expect(f.binding.source).toBe(f.original);
  await f.binding.save(candidate);expect(f.get()).toBe('Added before\nIntroduction\n\n'+candidate+'\nAfterword');
 });

 it('continues protecting an externally edited block through retries and refresh attempts',async()=>{
  const f=fixture(),external=changed(f.original,'External text'),local=changed(f.original,'Local text');
  f.set(f.get().replace(f.original,external));const actual=f.get();
  await expect(f.binding.save(local)).rejects.toThrow();
  await expect(f.binding.refresh()).rejects.toThrow();
  await expect(f.binding.save(local)).rejects.toThrow();await expect(f.binding.flush()).rejects.toThrow();
  expect(f.get()).toBe(actual);expect(f.binding.source).toBe(f.original);expect(f.process).not.toHaveBeenCalled();
  const reopened=new TetradBinding(f.app,f.file,actual,tetradBlocks(actual,patterns())[0]!,patterns);
  await reopened.save(changed(external,'Accepted after explicit reopen'));expect(f.get()).toContain('Accepted after explicit reopen');
 });

 it('does not mistake a remaining identical block for a deleted bound block',async()=>{
  const f=fixture(),before=f.get()+'\n\n'+f.original;
  const binding=new TetradBinding(f.app,f.file,before,tetradBlocks(before,patterns())[0]!,patterns);
  const remaining=before.replace(f.original,'');f.set(remaining);
  await expect(binding.save(changed(f.original))).rejects.toThrow();
  await expect(binding.refresh()).rejects.toThrow();expect(f.get()).toBe(remaining);expect(f.process).not.toHaveBeenCalled();
 });

 it('compares the whole actual file inside the vault transaction and can retry safely',async()=>{
  const f=fixture(),candidate=changed(f.original);
  f.process.mockImplementationOnce(async(_file,change)=>{f.set('Concurrent introduction\n'+f.get());f.set(change(f.get()));return f.get();});
  await expect(f.binding.save(candidate)).rejects.toThrow();
  expect(f.get()).toContain('Concurrent introduction');expect(f.get()).not.toContain('New text');expect(f.binding.source).toBe(f.original);
  await f.binding.save(candidate);await f.binding.flush();expect(f.get()).toBe('Concurrent introduction\nIntroduction\n\n'+candidate+'\nAfterword');
 });

 it('rejects structurally invalid source before reading or writing, then accepts corrected source',async()=>{
  const f=fixture(),duplicate=f.original.replace('> ## Enhances\n','> ## Enhances\n> ## Retrieves\n');
  await expect(f.binding.save(duplicate)).rejects.toThrow();await expect(f.binding.flush()).rejects.toThrow();
  expect(f.read).not.toHaveBeenCalled();expect(f.process).not.toHaveBeenCalled();expect(f.binding.source).toBe(f.original);
  await f.binding.save(changed(f.original,'Text\n\n> ## Retrieves\n> Quoted text'));await f.binding.flush();
  expect(f.get()).toContain('> > ## Retrieves');
 });

 it('keeps source outside the one bound block byte for byte, including CRLF',async()=>{
  const f=fixture(),original=f.original.replace(/\n/gu,'\r\n'),note='Before\r\n\r\n'+original+'\r\nAfter';f.set(note);
  const binding=new TetradBinding(f.app,f.file,note,tetradBlocks(note,patterns())[0]!,patterns);
  const candidate=changed(original,'**Core**\n\n[[Target|Link]]\n\n- A\n- B').trimEnd();
  await binding.save(candidate);await binding.flush();
  expect(f.get()).toBe('Before\r\n\r\n'+candidate+'\r\n\r\nAfter');expect(binding.source).toBe(candidate+'\r\n');
 });

 it('flush waits for a newer write enqueued while an earlier write is still settling',async()=>{
  const f=fixture(),firstGate=deferred(),secondGate=deferred(),firstStarted=deferred(),secondStarted=deferred();
  f.process.mockImplementationOnce(async(_file,change)=>{firstStarted.resolve();await firstGate.promise;f.set(change(f.get()));return f.get();})
   .mockImplementationOnce(async(_file,change)=>{secondStarted.resolve();await secondGate.promise;f.set(change(f.get()));return f.get();});
  const first=f.binding.save(changed(f.original,'First'));await firstStarted.promise;
  let flushed=false;const flush=f.binding.flush().then(()=>{flushed=true;});
  const latest=f.binding.save(changed(f.original,'Latest'));firstGate.resolve();await first;await secondStarted.promise;
  expect(flushed).toBe(false);secondGate.resolve();await Promise.all([latest,flush]);expect(flushed).toBe(true);expect(f.get()).toContain('Latest');
 });

 it('uses the live source editor, keeps its range exact, and retries an editor write failure',async()=>{
  const f=fixture(),failure=Error('Editor write failed'),candidate=changed(f.original);
  const offset=(position:EditorPosition):number=>f.get().split('\n').slice(0,position.line).reduce((sum,line)=>sum+line.length+1,0)+position.ch;
  const replace=vi.fn((value:string,from:EditorPosition,to:EditorPosition)=>{const before=f.get();f.set(before.slice(0,offset(from))+value+before.slice(offset(to)));});
  replace.mockImplementationOnce(()=>{throw failure;});
  const editor={getValue:()=>f.get(),offsetToPos:(value:number)=>{const lines=f.get().slice(0,value).split('\n');return {line:lines.length-1,ch:lines.at(-1)!.length};},replaceRange:replace} as unknown as Editor;
  const view=new MarkdownView({} as WorkspaceLeaf);Object.assign(view,{file:f.file,editor,getMode:()=> 'source'});f.leaves.push({view} as unknown as WorkspaceLeaf);
  await expect(f.binding.save(candidate)).rejects.toBe(failure);expect(f.binding.source).toBe(f.original);
  await f.binding.save(candidate);await f.binding.flush();
  expect(f.get()).toBe('Introduction\n\n'+candidate+'\nAfterword');expect(replace).toHaveBeenLastCalledWith(candidate,expect.any(Object),expect.any(Object),'emergence-tetrad');
  expect(f.read).not.toHaveBeenCalled();expect(f.process).not.toHaveBeenCalled();
 });
});
