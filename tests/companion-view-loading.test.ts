import {afterEach,describe,expect,it,vi} from 'vitest';
import {CompanionService} from '../src/companion/service';
import {thoughts} from '../src/companion/thoughts';
import {companionFixture} from './helpers/companion-service';

vi.mock('obsidian',async original=>({...await original<Record<string,unknown>>(),Component:(await import('./helpers/reader-host')).TestComponent}));

afterEach(()=>{vi.useRealTimers();vi.unstubAllGlobals();});

describe('confirmed companion revisions and display reads',()=>{
 it('renders a confirmed revision repeatedly without rereading any files',async()=>{
  const f=companionFixture(),path=await f.service.create('Paper.md',{mode:'sections',location:'beside',folder:''}),read=vi.spyOn(f.app.vault,'read');
  const first=await f.service.viewDocument(path);first.sections[0]!.title='A local view cannot mutate the service';
  for(let n=0;n<10;n++)expect((await f.service.viewDocument(path)).sections[0]!.title).toBe('A');
  expect(read).not.toHaveBeenCalled();f.service.unload();
 });
 it('uses Obsidian cached reads for the index too, keeping direct disk reads out of display loading',async()=>{
  const f=companionFixture(),path=await f.service.create('Paper.md',{mode:'sections',location:'beside',folder:''});
  const cached=vi.fn(f.app.vault.read.bind(f.app.vault));f.app.vault.cachedRead=cached;const direct=vi.spyOn(f.app.vault,'read').mockRejectedValue(new Error('slow direct disk path'));
  const restored=new CompanionService(f.app,f.service.snapshot(),()=>f.settings,f.persist),doc=await restored.viewDocument(path);expect(doc.sections).toHaveLength(2);expect(cached).toHaveBeenCalledTimes(3);expect(direct).not.toHaveBeenCalled();restored.unload();f.service.unload();
 });
 it('provides the outline before blocked chapter reads finish',async()=>{
  const f=companionFixture(),path=await f.service.create('Paper.md',{mode:'sections',location:'beside',folder:''}),doc=await f.service.read(path),member=doc.files![doc.sections[0]!.id]!;
  let release!:()=>void;const blocked=new Promise<void>(resolve=>{release=resolve;});f.app.vault.cachedRead=async file=>{if(file.path===member)await blocked;return f.data.get(file.path)!;};
  const restored=new CompanionService(f.app,f.service.snapshot(),()=>f.settings,f.persist);let complete=false;const loading=restored.readForView(path).then(()=>{complete=true;});const outline=await restored.readOutline(path);expect(outline.sections.map(s=>s.title)).toEqual(['A','B']);expect(complete).toBe(false);release();await loading;restored.unload();f.service.unload();
 });
 it('displays the previous saved revision while a write is blocked instead of joining its queue',async()=>{
  const f=companionFixture(),path=await f.service.create('Paper.md'),doc=await f.service.viewDocument(path);let release!:()=>void,started!:()=>void;const blocked=new Promise<void>(resolve=>{release=resolve;}),writing=new Promise<void>(resolve=>{started=resolve;}),process=f.app.vault.process.bind(f.app.vault);
  f.app.vault.process=async(file,change)=>{started();await blocked;return process(file,change);};const mutation=f.service.execute(path,{kind:'add',section:doc.sections[0]!.id,placement:'last',text:'Confirmed only after save'});await writing;
  const before=await f.service.viewDocument(path);expect(thoughts(before.sections[0]!)).toHaveLength(0);release();await mutation;expect(thoughts((await f.service.viewDocument(path)).sections[0]!)[0]!.text).toBe('Confirmed only after save');f.service.unload();
 });
 it('does not read any file again between a successful write and displaying that result',async()=>{
  const f=companionFixture(),path=await f.service.create('Paper.md',{mode:'sections',location:'beside',folder:''}),doc=await f.service.viewDocument(path),process=f.app.vault.process.bind(f.app.vault),read=vi.spyOn(f.app.vault,'read');let written=false;
  read.mockImplementation(async file=>{if(written)throw new Error('Unexpected reread after save');return f.data.get(file.path)!;});f.app.vault.process=async(file,change)=>{const result=await process(file,change);written=true;return result;};
  await f.service.executeMany(path,[{kind:'add',section:doc.sections[0]!.id,placement:'last',text:'New excerpt\n\nAnother paragraph.'}]);const saved=await f.service.viewDocument(path);expect(thoughts(saved.sections[0]!)[0]!.text).toBe('New excerpt\n\nAnother paragraph.');expect(saved.fileOriginals![saved.files![saved.sections[0]!.id]!]).toBe(f.data.get(saved.files![saved.sections[0]!.id]!));f.service.unload();
 });
 it('invalidates a view immediately on an external modify event and coalesces concurrent view reads',async()=>{
  vi.useFakeTimers();const f=companionFixture(),path=await f.service.create('Paper.md');f.service.start();const doc=await f.service.viewDocument(path);f.data.set(path,f.data.get(path)!.replace('# A ','# External A '));f.vaultEvents.get('modify')!(f.file(path));const read=vi.spyOn(f.app.vault,'read');
  const [one,two]=await Promise.all([f.service.viewDocument(path),f.service.viewDocument(path)]);expect(one.sections[0]!.title).toBe('External A');expect(two.sections[0]!.title).toBe('External A');expect(doc.sections[0]!.title).toBe('A');expect(read).toHaveBeenCalledTimes(1);f.service.unload();
 });
 it('does not invalidate its own saved revision again when metadata catches up',async()=>{
  vi.useFakeTimers();const f=companionFixture(),path=await f.service.create('Paper.md',{mode:'sections',location:'beside',folder:''});f.service.start();const doc=await f.service.viewDocument(path);await f.service.execute(path,{kind:'add',section:doc.sections[0]!.id,placement:'last',text:'Saved'});const revision=f.service.pair(path)!.revision;
  for(const member of [path,...Object.values(doc.files!)])f.metadataEvents.get('changed')!(f.file(member),f.data.get(member),f.app.metadataCache.getFileCache(f.file(member)!));expect(f.service.pair(path)!.revision).toBe(revision);expect(thoughts((await f.service.viewDocument(path)).sections[0]!)[0]!.text).toBe('Saved');f.service.unload();
 });
 it('does not publish a view read superseded by an external file change',async()=>{
  vi.useFakeTimers();const f=companionFixture(),path=await f.service.create('Paper.md');let release!:()=>void,started!:()=>void;const gate=new Promise<void>(resolve=>{release=resolve;}),reading=new Promise<void>(resolve=>{started=resolve;}),restored=new CompanionService(f.app,f.service.snapshot(),()=>f.settings,f.persist);restored.onload();let calls=0;
  f.app.vault.cachedRead=async file=>{const text=f.data.get(file.path)!;if(++calls===1){started();await gate;}return text;};const loading=restored.viewDocument(path);await reading;f.data.set(path,f.data.get(path)!.replace('# A ','# Latest A '));f.vaultEvents.get('modify')!(f.file(path));release();expect((await loading).sections[0]!.title).toBe('Latest A');expect(calls).toBe(2);restored.unload();f.service.unload();
 });
 it('invalidates chapter edits arriving before the first bundle has finished loading',async()=>{
  vi.useFakeTimers();const f=companionFixture(),path=await f.service.create('Paper.md',{mode:'sections',location:'beside',folder:''}),base=await f.service.read(path),member=base.files![base.sections[0]!.id]!,restored=new CompanionService(f.app,f.service.snapshot(),()=>f.settings,f.persist);restored.onload();let release!:()=>void,started!:()=>void,blocked=false;const gate=new Promise<void>(resolve=>{release=resolve;}),reading=new Promise<void>(resolve=>{started=resolve;});
  f.app.vault.cachedRead=async file=>{const text=f.data.get(file.path)!;if(file.path===member&&!blocked){blocked=true;started();await gate;}return text;};const loading=restored.viewDocument(path);await reading;f.data.set(member,f.data.get(member)!+'- Latest external entry\n');f.vaultEvents.get('modify')!(f.file(member));release();expect((await loading).sections[0]!.raw).toContain('Latest external entry');restored.unload();f.service.unload();
 });
 it('keeps an external change made while its own write is completing',async()=>{
  const f=companionFixture(),path=await f.service.create('Paper.md'),doc=await f.service.viewDocument(path),process=f.app.vault.process.bind(f.app.vault);
  f.app.vault.process=async(file,change)=>{const result=await process(file,change);f.vaultEvents.get('modify')!(file);f.data.set(file.path,f.data.get(file.path)!.replace('# A ','# External after write '));f.vaultEvents.get('modify')!(file);return result;};await f.service.execute(path,{kind:'add',section:doc.sections[0]!.id,placement:'last',text:'Saved entry'});const latest=await f.service.viewDocument(path);expect(latest.sections[0]!.title).toBe('External after write');expect(latest.sections[0]!.raw).toContain('Saved entry');f.service.unload();
 });
});
