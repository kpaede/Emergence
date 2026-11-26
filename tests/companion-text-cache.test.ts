import {afterEach,describe,it,expect,vi} from 'vitest';
import type {App} from 'obsidian';
import {ExactTextCache} from '../src/companion/text-cache';
import {parsedStored,clearStoredParse} from '../src/companion/stored-parse';
import {serializeCompanion,emptyCompanion} from '../src/companion/codec';
import {companionFixture} from './helpers/companion-service';
import {thoughts} from '../src/companion/thoughts';

vi.mock('obsidian',async importOriginal=>({...await importOriginal<Record<string,unknown>>(),Component:(await import('./helpers/reader-host')).TestComponent}));
afterEach(()=>vi.unstubAllGlobals());
describe('exact-text analysis caches',()=>{
 it('reads chapter files in bounded parallel batches and retains their document order',async()=>{
  const f=companionFixture();f.data.set('Paper.md',Array.from({length:20},(_,i)=>'# Section '+i+'\n\nText\n').join('\n'));const path=await f.service.create('Paper.md',{mode:'sections',location:'beside',folder:''}),doc=await f.service.read(path),members=new Set(Object.values(doc.files!));let active=0,peak=0;
  vi.spyOn(f.app.vault,'read').mockImplementation(async file=>{if(!members.has(file.path))return f.data.get(file.path)!;active++;peak=Math.max(peak,active);try{await new Promise(resolve=>window.setTimeout(resolve,2));return f.data.get(file.path)!;}finally{active--;}});
  const next=await f.service.readForView(path);expect(peak).toBe(8);expect(active).toBe(0);expect(next.sections.map(section=>section.id)).toEqual(doc.sections.map(section=>section.id));expect(next.unavailableFiles).toBeUndefined();f.service.unload();
 });
 it('continues reading files and detects edits, deletion and incorrect chapter identity with a warm cache',async()=>{const f=companionFixture(),path=await f.service.create('Paper.md',{mode:'sections',location:'beside',folder:''}),doc=await f.service.read(path),id=doc.sections[0]!.id;await f.service.execute(path,{kind:'add',section:id,placement:'last',text:'Original'});const member=(await f.service.read(path)).files![id]!,original=f.data.get(member)!,read=vi.spyOn(f.app.vault,'read'),before=read.mock.calls.length;await f.service.readForView(path);expect(read.mock.calls.length).toBeGreaterThan(before);f.data.set(member,original.replace('Original','External'));expect((await f.service.readForView(path)).sections[0]!.raw).toContain('External');f.data.delete(member);expect((await f.service.readForView(path)).unavailableFiles?.[id]?.reason).toBe('missing');f.data.set(member,original.replace(/emergence-parent-companion-id:.*$/mu,'emergence-parent-companion-id: foreign'));expect((await f.service.readForView(path)).unavailableFiles?.[id]?.reason).toBe('invalid');f.data.set(member,original);expect((await f.service.readForView(path)).unavailableFiles?.[id]).toBeUndefined();f.service.unload();});
 it('keeps two revisions per key and bounds retained text and entries',()=>{
  const cache=new ExactTextCache<number>(12,3);cache.set('a','first',1);cache.set('a','next',2);expect(cache.get('a','first')).toBe(1);cache.set('a','third',3);expect(cache.get('a','first')).toBeUndefined();expect(cache.get('a','next')).toBe(2);cache.set('b','12345678',4);expect(cache.get('a','next')).toBe(2);expect(cache.get('a','third')).toBeUndefined();cache.clear();expect(cache.get('b','12345678')).toBeUndefined();
 });
 it('does not retain text larger than the limit and never matches a different text',()=>{const cache=new ExactTextCache<number>(3);cache.set('a','long',1);expect(cache.get('a','long')).toBeUndefined();cache.set('a','abc',2);expect(cache.get('a','abd')).toBeUndefined();expect(cache.get('a','abc')).toBe(2);});
 it('returns independent parsed documents and invalidates on changed bytes even at the same path',()=>{
  const app={} as App,doc=emptyCompanion('Main.md');doc.sections=[{id:'section',title:'A',level:1,state:'linked',format:2,raw:'- Original\n'}];const original=serializeCompanion(doc),first=parsedStored(app,'Companion.md',original);first.document.sections[0]!.raw='Changed in memory';expect(parsedStored(app,'Companion.md',original).document.sections[0]!.raw).toBe('- Original\n');const changed=original.replace('Original','External');expect(parsedStored(app,'Companion.md',changed).document.sections[0]!.raw).toBe('- External\n');expect(()=>parsedStored(app,'Companion.md','Invalid')).toThrow();expect(parsedStored(app,'Companion.md',original).document.sections[0]!.raw).toBe('- Original\n');clearStoredParse(app);
 });
 it('keeps thought results independent and respects raw edits and identity modes',()=>{const section={id:'s',title:'A',level:1,state:'linked' as const,format:2 as const,raw:'- Original <!-- em-note:a -->\n\t- Child <!-- em-note:b -->\n',plain:false},first=thoughts(section);first[0]!.text='Mutation';expect(thoughts({...section})[0]!.text).toBe('Original');section.raw=section.raw.replace('Original','External');expect(thoughts(section)[0]!.text).toBe('External');expect(thoughts({...section,plain:true})[0]!.text).toContain('em-note:a');});
});
