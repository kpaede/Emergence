import {afterEach,describe,it,expect,vi} from 'vitest';
import {parseDocument,parse as parseYaml} from 'yaml';
import {companionFixture as fixture,companionSource} from './helpers/companion-service';
import {parseCompanion,serializeCompanion} from '../src/companion/codec';
import {thoughts} from '../src/companion/thoughts';
vi.mock('obsidian',async importOriginal=>({...await importOriginal<Record<string,unknown>>(),Component:class{private callbacks:(()=>void)[]=[];register(callback:()=>void){this.callbacks.push(callback);}registerEvent(){}unload(){for(const callback of this.callbacks)callback();}}}));
afterEach(()=>{vi.unstubAllGlobals();vi.useRealTimers();});
async function missing(){
 const f=fixture(),index=await f.service.create('Paper.md',{mode:'sections',location:'subfolder',folder:'',subfolder:'Chapters'}),doc=await f.service.read(index),section=doc.sections[0]!,member=doc.files![section.id]!,original=f.data.get(member)!;
 f.data.delete(member);return {...f,index,doc,section,member,original};
}
describe('repairing individual companion chapter files',()=>{
 it('creates an empty chapter at its recorded path with matching metadata and leaves every other file unchanged',async()=>{
  const f=await missing(),before=new Map(f.data);f.settings.companion={...f.settings.companion,storage:{mode:'document',location:'folder',folder:'Different defaults'}};
  await f.service.createChapterFile(f.index,f.section.id);const restored=await f.service.read(f.index),part=parseCompanion(f.data.get(f.member)!),metadata=parseYaml(part.header) as Record<string,unknown>;
  expect(restored.files![f.section.id]).toBe(f.member);expect(part.sections[0]!.raw).toBe('');expect(metadata['emergence-companion-role']).toBe('section');expect(metadata['emergence-parent-companion-id']).toBe(f.doc.id);expect(part.sections[0]!.id).toBe(f.section.id);
  for(const [path,text]of before)if(path!==f.index)expect(f.data.get(path)).toBe(text);expect(f.data.get('Paper.md')).toBe(companionSource);f.service.unload();
 });
 it('uses the stored folder and naming pattern when the missing chapter has no recorded file path',async()=>{
  const f=await missing(),index=parseCompanion(f.data.get(f.index)!),yaml=parseDocument(index.header),files={...f.doc.files};delete files[f.section.id];yaml.set('emergence-section-files',files);index.header=yaml.toString();f.data.set(f.index,serializeCompanion(index));
  await f.service.createChapterFile(f.index,f.section.id);expect((await f.service.read(f.index)).files![f.section.id]).toBe('Chapters/Paper – A.md');f.service.unload();
 });
 it('does not overwrite a file restored before the create action reaches the queue',async()=>{
  const f=await missing();f.data.set(f.member,f.original);const before=new Map(f.data);await expect(f.service.createChapterFile(f.index,f.section.id)).rejects.toThrow('inzwischen');expect(f.data).toEqual(before);f.service.unload();
 });
 it('relinks a matching existing chapter without rewriting its contents or recreating the old file',async()=>{
  const f=await missing(),target='Recovered.md';f.data.set(target,f.original);const before=new Map(f.data),plan=await f.service.prepareChapterFile(f.index,f.section.id,target);expect(plan.kind).toBe('existing');expect(f.data).toEqual(before);
  await f.service.useChapterFile(plan);expect((await f.service.read(f.index)).files![f.section.id]).toBe(target);expect(f.data.get(target)).toBe(f.original);expect(f.data.has(f.member)).toBe(false);for(const [path,text]of before)if(path!==f.index)expect(f.data.get(path)).toBe(text);f.service.unload();
 });
 it('previews an ordinary Markdown file and retains its entire body and custom properties after assignment',async()=>{
  const f=await missing(),body='# Existing heading\n\nFirst paragraph.\n\n- Internal list\n  - Nested list\n\n> Quotation.\n',text='---\ntags: [research]\ncustom: preserved\n---\n'+body;f.data.set('Collected.md',text);const before=new Map(f.data),plan=await f.service.prepareChapterFile(f.index,f.section.id,'Collected.md');expect(plan.kind).toBe('text');expect(f.data).toEqual(before);
  await f.service.useChapterFile(plan);const doc=await f.service.read(f.index),nodes=thoughts(doc.sections.find(s=>s.id===f.section.id)!);expect(nodes).toHaveLength(1);expect(nodes[0]!.text).toBe(body);const metadata=parseYaml(parseCompanion(f.data.get('Collected.md')!).header) as Record<string,unknown>;expect(metadata.custom).toBe('preserved');expect(metadata.tags).toEqual(['research']);expect(f.data.get('Paper.md')).toBe(companionSource);f.service.unload();
 });
 it('retains an existing EOME multiline outline as separate thoughts with their actual hierarchy',async()=>{
  const f=await missing();f.data.set('Outline.md','---\neome-outline-format: 2\ncustom: kept\n---\n- Root\n  \n  Second paragraph\n  - Internal list\n\t- Child\n- Another root\n');const plan=await f.service.prepareChapterFile(f.index,f.section.id,'Outline.md');expect(plan.kind).toBe('outline');await f.service.useChapterFile(plan);
  const nodes=thoughts((await f.service.read(f.index)).sections.find(s=>s.id===f.section.id)!);expect(nodes).toHaveLength(3);expect(nodes[1]!.parent).toBe(nodes[0]!.id);expect(nodes[0]!.text).toBe('Root\n\nSecond paragraph\n- Internal list');f.service.unload();
 });
 it('blocks main documents, the index and other chapters before changing any file',async()=>{
  const f=await missing();await f.service.create('Unrelated.md');const before=new Map(f.data),other=f.doc.files![f.doc.sections[1]!.id]!;
  for(const target of ['Paper.md','Unrelated.md',f.index,other])await expect(f.service.prepareChapterFile(f.index,f.section.id,target)).rejects.toThrow('Hauptdokument');expect(f.data).toEqual(before);f.service.unload();
 });
 it('rejects a chapter file that belongs to another companion',async()=>{
  const f=await missing(),other=await f.service.create('Unrelated.md',{mode:'sections',location:'beside',folder:''}),target=Object.values((await f.service.read(other)).files!)[0]!,before=new Map(f.data);await expect(f.service.prepareChapterFile(f.index,f.section.id,target)).rejects.toThrow('anderen');expect(f.data).toEqual(before);f.service.unload();
 });
 it('retains a later external edit to the selected file and refuses an outdated assignment preview',async()=>{
  const f=await missing();f.data.set('Picked.md','Original text');const plan=await f.service.prepareChapterFile(f.index,f.section.id,'Picked.md');f.data.set('Picked.md','New external text');const before=new Map(f.data);await expect(f.service.useChapterFile(plan)).rejects.toThrow();expect(f.data).toEqual(before);f.service.unload();
 });
 it('restores ordinary Markdown byte for byte if the index write fails after conversion',async()=>{
  const f=await missing(),text='---\ncustom: original\n---\n# Keep me\n\n- Inner list\n';f.data.set('Picked.md',text);const plan=await f.service.prepareChapterFile(f.index,f.section.id,'Picked.md'),before=new Map(f.data),process=f.app.vault.process.bind(f.app.vault);let fail=true;
  f.app.vault.process=async(file,change)=>{if(file.path===f.index&&fail){fail=false;throw Error('index disk failure');}return process(file,change);};await expect(f.service.useChapterFile(plan)).rejects.toThrow('index disk failure');expect(f.data).toEqual(before);expect(f.service.needsRecovery(f.index)).toBe(false);f.service.unload();
 });
 it('preserves a concurrent file change detected inside the atomic write',async()=>{
  const f=await missing();f.data.set('Picked.md','Original text');const plan=await f.service.prepareChapterFile(f.index,f.section.id,'Picked.md'),process=f.app.vault.process.bind(f.app.vault),indexBefore=f.data.get(f.index);
  f.app.vault.process=async(file,change)=>{if(file.path==='Picked.md')f.data.set(file.path,'External replacement');return process(file,change);};await expect(f.service.useChapterFile(plan)).rejects.toThrow();expect(f.data.get('Picked.md')).toBe('External replacement');expect(f.data.get(f.index)).toBe(indexBefore);f.service.unload();
 });
 it('creates only the requested chapter while other missing chapters remain explicitly unavailable',async()=>{
  const f=await missing(),second=f.doc.files![f.doc.sections[1]!.id]!;f.data.delete(second);await f.service.createChapterFile(f.index,f.section.id);const doc=await f.service.readForView(f.index);expect(doc.unavailableFiles?.[f.section.id]).toBeUndefined();expect(doc.unavailableFiles?.[f.doc.sections[1]!.id]?.reason).toBe('missing');expect(f.data.has(second)).toBe(false);f.service.unload();
 });
 it('rejects malformed or incomplete companion metadata instead of silently converting it into an ordinary thought',async()=>{
  const f=await missing();for(const text of ['---\nnot a property map\n---\nBody','---\nemergence-storage: {}\n---\nBody','---\nemergence-sections: {}\n---\nBody']){f.data.set('Picked.md',text);const before=new Map(f.data);await expect(f.service.prepareChapterFile(f.index,f.section.id,'Picked.md')).rejects.toThrow();expect(f.data).toEqual(before);}f.service.unload();
 });
});
