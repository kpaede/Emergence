import {afterEach,describe,it,expect,vi} from 'vitest';
import {EditorState,Text} from '@codemirror/state';
import {outlineSizes,validOutlineSizeMode} from '../src/companion/outline-size';
import {companionOutlineSizeMode} from '../src/companion/preferences';
import {reconcile} from '../src/companion/reconcile';
import {emptyCompanion} from '../src/companion/codec';
import {companionFixture} from './helpers/companion-service';
vi.mock('obsidian',async importOriginal=>({...await importOriginal<Record<string,unknown>>(),Component:(await import('./helpers/reader-host')).TestComponent}));
afterEach(()=>{vi.unstubAllGlobals();vi.restoreAllMocks();});
function fixture(source:string){const document=reconcile(emptyCompanion('Main.md'),source).document;return {sections:document.sections,anchors:new Map(document.sections.map(section=>[section.id,section.base!.from]))};}
describe('source section character sizes',()=>{
 it('applies counting options to totals and sections with one shared cached scan and no Markdown changes',async()=>{
  const f=companionFixture(),source='# A\nBody[^n] with ^[inline].\n# B\nMore.\n\n[^n]: Note.\n';f.data.set('Paper.md',source);const path=await f.service.create('Paper.md'),doc=await f.service.read(path);f.settings.companion={storage:f.service.storageDefaults(),countWhitespace:false,countFootnotes:false};const scans=f.service.metrics.characterScans,writes=f.writes.length;
  const sizes=f.service.sectionSizes(path,'section')!;expect(sizes.get(doc.sections[0]!.id)!.characters).toBe('Bodywith.'.length);expect(f.service.sourceCharacters(path)).toBe('# A\nBody with .\n# B\nMore.\n\n'.replace(/\s/gu,'').length);expect(f.service.metrics.characterScans-scans).toBe(1);for(let i=0;i<20;i++)f.service.sectionSizes(path,'subtree');expect(f.service.metrics.characterScans-scans).toBe(1);expect(f.writes).toHaveLength(writes);expect(f.data.get('Paper.md')).toBe(source);
  await f.service.execute(path,{kind:'add',section:doc.sections[0]!.id,placement:'last',text:'Companion entry'});f.service.sectionSizes(path,'subtree');expect(f.service.metrics.characterScans-scans).toBe(1);f.settings.companion.countWhitespace=true;expect(f.service.sourceCharacters(path)).toBe('# A\nBody with .\n# B\nMore.\n\n'.length);f.service.unload();
 });
 it('counts the complete source like Obsidian, including frontmatter, headings, preamble, whitespace and UTF-16 characters',async()=>{
  const f=companionFixture(),source='---\naliases: [Example]\n---\n\nBefore the heading 😀.\n# A\n\nText.\n## B\n  More text.\n';f.data.set('Paper.md',source);const path=await f.service.create('Paper.md');expect(f.service.sourceCharacters(path)).toBe(source.length);expect(f.service.sourceCharacters('Unrelated.md')).toBeUndefined();expect(f.data.get('Paper.md')).toBe(source);f.service.unload();
 });
 it('reads live totals without serializing the editor and replaces stale live snapshots after external changes',async()=>{
  const f=companionFixture(),path=await f.service.create('Paper.md'),source=f.data.get('Paper.md')!,state=EditorState.create({doc:source}),change=state.update({changes:{from:0,to:3,insert:'# Longer heading'}}),analyses=f.service.metrics.sourceAnalyses,writes=f.writes.length;f.service.live('Paper.md',state.doc,change.state.doc,change.changes,true);
  const serialize=vi.spyOn(change.state.doc,'toString').mockImplementation(()=>{throw Error('Unexpected full serialization');});expect(f.service.sectionSizes(path,'section')).toBeUndefined();expect(f.service.sourceCharacters(path)).toBe(change.state.doc.length);expect(serialize).not.toHaveBeenCalled();expect(f.service.metrics.sourceAnalyses).toBe(analyses);expect(f.writes).toHaveLength(writes);serialize.mockRestore();
  const equivalent=Text.of(change.state.doc.toJSON());f.service.live('Paper.md',change.state.doc,equivalent,change.state.update({}).changes,false);expect(f.service.sourceCharacters(path)).toBe(equivalent.length);
  const external=source+'\nExternal addition.\n';f.data.set('Paper.md',external);await f.service.sync(path);expect(f.service.sourceCharacters(path)).toBe(external.length);f.service.unload();
 });
 it.each(['string','editor'] as const)('counts own text or whole branches using %s heading positions',kind=>{
  const source='# A\nabc\n## B\nlonger text\n### C\nlast child\n# D\nend',f=fixture(source),text=kind==='editor'?Text.of(source.split('\n')):source,own=outlineSizes(f.sections,f.anchors,text,'section')!,all=outlineSizes(f.sections,f.anchors,text,'subtree')!,[a,b,c,d]=f.sections;
  expect(own.get(a!.id)!.characters).toBe('abc\n'.length);expect(all.get(a!.id)!.characters).toBe(source.slice(source.indexOf('abc'),source.indexOf('# D')).length);expect(own.get(b!.id)!.characters).toBe('longer text\n'.length);expect(all.get(b!.id)!.characters).toBe('longer text\n### C\nlast child\n'.length);expect(all.get(c!.id)!.characters).toBe('last child\n'.length);expect(all.get(d!.id)!.characters).toBe(3);expect(all.get(a!.id)!.percentage).toBeGreaterThan(all.get(b!.id)!.percentage);
 });
 it.each(['\n','\r\n'])('excludes complete Setext and ATX headings and retains whitespace (%j)',nl=>{
  const source=['Title','=====',' x  ','Sub','---','', '## Empty',''].join(nl),f=fixture(source),sizes=outlineSizes(f.sections,f.anchors,source,'section')!;expect(sizes.get(f.sections[0]!.id)!.characters).toBe((' x  '+nl).length);expect(sizes.get(f.sections[1]!.id)!.characters).toBe(nl.length);expect(sizes.get(f.sections[2]!.id)!.characters).toBe(0);
 });
 it('does not guess counts from missing, reordered or out-of-range anchors',()=>{
  const source='# A\nabc\n# B\ndef',f=fixture(source);f.anchors.delete(f.sections[0]!.id);expect(outlineSizes(f.sections,f.anchors,source,'section')).toBeUndefined();f.anchors.set(f.sections[0]!.id,source.length+1);expect(outlineSizes(f.sections,f.anchors,source,'subtree')).toBeUndefined();f.anchors.set(f.sections[0]!.id,source.indexOf('# B'));f.anchors.set(f.sections[1]!.id,0);expect(outlineSizes(f.sections,f.anchors,source,'subtree')).toBeUndefined();
 });
 it('handles skipped levels, empty headings and documents without a final newline',()=>{
  const source='#\n### Deep\nbody\n## Next\nlast',f=fixture(source),sizes=outlineSizes(f.sections,f.anchors,source,'subtree')!;expect(sizes.get(f.sections[0]!.id)!.characters).toBe(source.length-2);expect(sizes.get(f.sections[1]!.id)!.characters).toBe(5);expect(sizes.get(f.sections[2]!.id)!.characters).toBe(4);
 });
 it('uses no complete editor serialization for a 500,000-character document',()=>{
  const source=Array.from({length:500},(_,index)=>'# Heading '+index+'\n'+'x'.repeat(1000)+'\n').join(''),f=fixture(source),doc=Text.of(source.split('\n')),serialize=vi.spyOn(doc,'toString').mockImplementation(()=>{throw Error('Unexpected full serialization');});expect(source.length).toBeGreaterThan(500000);const sizes=outlineSizes(f.sections,f.anchors,doc,'subtree')!;expect(sizes.size).toBe(500);expect([...sizes.values()].every(size=>size.characters===1001)).toBe(true);expect(serialize).not.toHaveBeenCalled();
 });
 it('defaults to off without creating or persisting additional note metadata',async()=>{
  const f=companionFixture(),path=await f.service.create('Paper.md');expect(companionOutlineSizeMode(f.settings)).toBe('off');expect(f.service.outlineSizeMode()).toBe('off');expect(validOutlineSizeMode('subtree')).toBe(true);expect(validOutlineSizeMode('unknown')).toBe(false);expect(f.data.get(path)).not.toContain('characters');expect(JSON.stringify(f.service.snapshot())).not.toContain('sizeCalculations');f.service.unload();
 });
 it('updates unsaved body lengths through live anchors without source analysis or companion writes',async()=>{
  const f=companionFixture(),path=await f.service.create('Paper.md'),doc=await f.service.read(path),before=f.service.sectionSizes(path,'subtree')!,state=EditorState.create({doc:f.data.get('Paper.md')!}),at=state.doc.toString().indexOf('Body A'),change=state.update({changes:{from:at,insert:'Extra '}}),analyses=f.service.metrics.sourceAnalyses,writes=f.writes.length,listener=vi.fn(),unsubscribe=f.service.subscribeSourceSizes(listener);
  f.service.live('Paper.md',state.doc,change.state.doc,change.changes,false);const sizes=f.service.sectionSizes(path,'subtree')!;expect(sizes.get(doc.sections[0]!.id)!.characters).toBe(before.get(doc.sections[0]!.id)!.characters+6);expect(sizes.get(doc.sections[1]!.id)!.characters).toBe(before.get(doc.sections[1]!.id)!.characters);expect(f.service.metrics.sourceAnalyses).toBe(analyses);expect(f.writes).toHaveLength(writes);expect(listener).toHaveBeenCalledWith('Paper.md');unsubscribe();f.service.unload();
 });
 it('waits for structural reconciliation and uses a fresh external snapshot instead of a stale editor document',async()=>{
  const f=companionFixture(),path=await f.service.create('Paper.md'),source=f.data.get('Paper.md')!,state=EditorState.create({doc:source}),change=state.update({changes:{from:0,to:3,insert:'# Renamed'}});f.service.live('Paper.md',state.doc,change.state.doc,change.changes,true);expect(f.service.sectionSizes(path,'subtree')).toBeUndefined();const external=change.state.doc.toString().replace('Body A','A much longer replacement body');f.data.set('Paper.md',external);await f.service.sync(path);const doc=await f.service.read(path),sizes=f.service.sectionSizes(path,'subtree')!;expect(doc.sections[0]!.title).toBe('Renamed');expect(sizes.get(doc.sections[0]!.id)!.characters).toBe(external.slice(external.indexOf('\n')+1,external.indexOf('# B')).length);f.service.unload();
 });
 it('still measures the main section when its companion chapter file is missing',async()=>{
  const f=companionFixture(),path=await f.service.create('Paper.md',{mode:'sections',location:'beside',folder:''}),doc=await f.service.read(path),before=f.service.sectionSizes(path,'subtree')!;f.data.delete(doc.files![doc.sections[0]!.id]!);await f.service.readForView(path);expect(f.service.sectionSizes(path,'subtree')).toEqual(before);f.service.unload();
 });
});
