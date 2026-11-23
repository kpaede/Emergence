import {describe,it,expect} from 'vitest';
import {DEFAULT_PATTERN,TetradStore,validatePattern,type TetradPattern} from '../src/tetrad/patterns';
import {starter,tetradBlocks,parseSource,editSection,relocateTetrad,createInsertion} from '../src/tetrad/source';
import {mountTetrad} from '../src/tetrad/render/layout';
import {TetradBinding} from '../src/tetrad/binding';
import {TFile,MarkdownView,type App,type WorkspaceLeaf,type Editor} from 'obsidian';
import {noteText} from '../src/tetrad/note';
import {tetradDom} from './helpers/tetrad-dom';
const custom:TetradPattern={id:'mein-modell',name:'Vier Perspektiven',level:3,headings:{enhances:'Stärken',reverses:'Risiken',retrieves:'Chancen',obsolesces:'Verluste'}};
const patterns=[DEFAULT_PATTERN,custom];
describe('Tetrader patterns and Markdown editing',()=>{
 it('round trips the original format and custom headings with stable positions',()=>{
  for(const pattern of patterns){const source=starter(pattern,'**Medium**'),doc=parseSource(source,pattern);expect(doc.title).toBe('**Medium**');expect(doc.sections.size).toBe(4);for(const [law,section]of doc.sections)expect(editSection(source,pattern,law,section.body)).toBe(source);}
 });
 it('supports existing aliases and source order independently of position',()=>{
  const source='> [!TeTrAd] Test\n> ## Obsolescence\n> Old\n> ## ENHANCEMENT:\n> **Voice**\n>\n> Gloss\n> ## Retrieval\n> Group\n> ## Reversal\n> Noise\n';
  const doc=parseSource(source,DEFAULT_PATTERN);expect(doc.sections.get('enhances')?.body).toBe('**Voice**\n\nGloss');expect(doc.sections.get('obsolesces')?.body).toBe('Old');expect(doc.sections.size).toBe(4);
 });
 it('keeps headings inside code and nested quotes as content and refuses duplicate sections',()=>{
  const source='> [!tetrad] Test\n> ## Enhances\n> Core\n>\n> ```md\n> ## Enhances\n> ```\n> > ## Enhances\n';
  expect(parseSource(source,DEFAULT_PATTERN).sections.size).toBe(1);expect(()=>parseSource(source+'> ## Enhances\n',DEFAULT_PATTERN)).toThrow();
 });
 it('patches only the selected body, retaining CRLF, links, and other sections byte for byte',()=>{
  const source=starter(custom).replace(/\n/gu,'\r\n'),doc=parseSource(source,custom),section=doc.sections.get('reverses')!,body='**Kern**\n\n[[Notiz|Link]]\nZweite Zeile\n\n- Gloss';
  const updated=editSection(source,custom,'reverses',body);expect(updated.startsWith(source.slice(0,section.from))).toBe(true);expect(updated.endsWith(source.slice(section.to))).toBe(true);expect(updated.replace(/\r\n/gu,'')).not.toContain('\n');expect(parseSource(updated,custom).sections.get('reverses')?.body).toBe(body);
 });
 it('adds missing sections while preserving incomplete drafts',()=>{
  const source='> [!mein-modell] Leer\n> Vorbemerkung\n',updated=editSection(source,custom,'retrieves','Kern\n\nErklärung');expect(updated.startsWith(source)).toBe(true);expect(parseSource(updated,custom).sections.get('retrieves')?.body).toBe('Kern\n\nErklärung');
 });
 it('locates multiple callouts while ignoring fenced examples, unknown types and nested quotes',()=>{
  const first=starter(DEFAULT_PATTERN),second=starter(custom),note='# Titel\n\n```md\n'+first+'```\n\n> [!unknown] Ignore\n\n> > [!tetrad] Nested\n\n'+first+'\n'+second+'\nEnde';
  const blocks=tetradBlocks(note,patterns);expect(blocks.map(b=>b.type)).toEqual(['tetrad','mein-modell']);for(const block of blocks)expect(note.slice(block.from,block.to)).toBe(block.source);
 });
 it('relocates after unrelated edits, but refuses changed, removed or ambiguous copies',()=>{
  const source=starter(DEFAULT_PATTERN),note='Intro\n\n'+source+'\nEnde',block=tetradBlocks(note,patterns)[0]!;
  expect(relocateTetrad(note,'Neu\n'+note,block,patterns).source).toBe(source);
  for(const changed of [note.replace('Kernaussage','Änderung'),'Kein Block','Andere Einleitung\n'+source+'\n'+source+'\nAnderes Ende'])expect(()=>relocateTetrad(note,changed,block,patterns)).toThrow();
 });
 it('refuses a deleted block when an identical sibling remains',()=>{const source=starter(DEFAULT_PATTERN),before='Intro\n'+source+'\n'+source+'\nEnde',block=tetradBlocks(before,patterns)[0]!;expect(()=>relocateTetrad(before,'Intro\n'+source+'\nEnde',block,patterns)).toThrow();});
 it('validates distinct headings and callout identifiers and persists a defensive copy',async()=>{
  const saved:unknown[]=[],store=new TetradStore(undefined,async()=>{saved.push(store.snapshot());});const draft=structuredClone(custom);await store.add(draft);draft.headings.enhances='Mutated';expect(store.pattern(custom.id)?.headings.enhances).toBe('Stärken');const copy=store.list();copy[0]!.headings.enhances='Mutated';expect(store.pattern('tetrad')?.headings.enhances).toBe('Enhances');expect(new TetradStore(saved[0],async()=>{}).pattern(custom.id)).toEqual(custom);
  await expect(store.add(custom)).rejects.toThrow();expect(()=>validatePattern({...custom,id:'bad id'})).toThrow();expect(()=>validatePattern({...custom,headings:{...custom.headings,reverses:' stärken :'}})).toThrow();expect(()=>validatePattern({...custom,headings:{...custom.headings,reverses:'**Risk**'}})).toThrow();
 });
 it('rolls back failed pattern persistence and queues concurrent additions',async()=>{
  const store=new TetradStore(undefined,async()=>{throw new Error('disk');});await expect(store.add(custom)).rejects.toThrow('disk');expect(store.list()).toHaveLength(1);
  const safe=new TetradStore(undefined,async()=>{});await Promise.all([safe.add(custom),safe.add({...custom,id:'zweites'})]);expect(safe.list()).toHaveLength(3);
 });
});
describe('Tetrader layout integration',()=>{
 it('renders custom headings and reverses upper gloss blocks only, and restores original DOM',()=>{
  const dom=tetradDom('<div class="callout"><div class="callout-title">Medium</div><div class="callout-content"><h3>Stärken</h3><p>Kern</p><p>Nahe</p><p>Fern</p><h3>Chancen</h3><p>Gruppe</p><p>Erstens</p><p>Zweitens</p></div></div>');
  const callout=dom.window.document.querySelector<HTMLElement>('.callout')!,before=callout.innerHTML,store=new TetradStore(undefined,async()=>{}),layout=mountTetrad(callout,store.settings(custom),custom);
  expect(callout.querySelector('.tetrader-enhances .tetrader-statement')?.textContent).toBe('Kern');expect(Array.from(callout.querySelectorAll('.tetrader-enhances .tetrader-gloss')).map(e=>e.textContent)).toEqual(['Fern','Nahe']);expect(Array.from(callout.querySelectorAll('.tetrader-retrieves .tetrader-gloss')).map(e=>e.textContent)).toEqual(['Erstens','Zweitens']);expect(callout.ownerDocument.getElementById(callout.querySelector('.tetrader-reverses')!.getAttribute('aria-labelledby')!)?.textContent).toBe('Risiken');expect(callout.querySelector('.tetrader-reverses')!.hasAttribute('aria-label')).toBe(false);
  layout.destroy();expect(callout.innerHTML).toBe(before);dom.window.close();
 });
 it('supports center and legend settings and shows duplicate sections without moving content',()=>{
  const dom=tetradDom('<div class="callout"><div class="callout-content"><h2>Enhances</h2><p>A</p><h2>Enhances</h2><p>B</p></div></div>'),callout=dom.window.document.querySelector<HTMLElement>('.callout')!,before=callout.innerHTML,store=new TetradStore(undefined,async()=>{}),layout=mountTetrad(callout,store.settings(DEFAULT_PATTERN),DEFAULT_PATTERN);expect(callout.querySelector('.tetrader-hint')).toBeTruthy();expect(callout.querySelectorAll('p').length).toBe(3);layout.destroy();expect(callout.innerHTML).toBe(before);dom.window.close();
 });
});
describe('Tetrader safe note binding',()=>{
 function fixture(initial:string){let text=initial;const file=new TFile();file.path='Tetrad.md';const app={workspace:{getLeavesOfType:()=>[]},vault:{read:async()=>text,process:async(_file:TFile,change:(value:string)=>string)=>{text=change(text);}}} as unknown as App;return {app,file,get:()=>text,set:(value:string)=>{text=value;}};}
 it('serializes edits to only the bound block and retains unrelated changes',async()=>{
  const a=starter(DEFAULT_PATTERN,'Erste'),b=starter(custom,'Zweite'),note='Intro\n\n'+a+'\n'+b+'\nEnde',f=fixture(note),block=tetradBlocks(note,patterns)[1]!,binding=new TetradBinding(f.app,f.file,note,block,()=>patterns);
  f.set('Neue Zeile\n'+note);const one=editSection(b,custom,'enhances','Eins'),two=editSection(one,custom,'enhances','Zwei');await Promise.all([binding.save(one),binding.save(two)]);expect(f.get()).toBe('Neue Zeile\n'+note.replace(b,two));await binding.flush();
 });
 it('refuses overwriting an external edit, including a race inside vault.process',async()=>{
  const source=starter(DEFAULT_PATTERN),f=fixture(source),block=tetradBlocks(source,patterns)[0]!,binding=new TetradBinding(f.app,f.file,source,block,()=>patterns);f.set(source.replace('Kernaussage','Extern'));await expect(binding.save(source.replace('Kernaussage','Lokal'))).rejects.toThrow();expect(f.get()).toContain('Extern');await expect(binding.flush()).rejects.toThrow();
  const raced=fixture(source),racedBinding=new TetradBinding(raced.app,raced.file,source,block,()=>patterns);raced.app.vault.process=async(_file,change)=>{const external=source+'\nAndere Änderung';raced.set(external);raced.set(change(external));return raced.get();};await expect(racedBinding.save(source.replace('Kernaussage','Lokal'))).rejects.toThrow();expect(raced.get()).toContain('Andere Änderung');
 });
});

describe('Tetrader note snapshots',()=>{
 it('reads the vault for a reading view and prefers unsaved text from a source view',async()=>{
  const file=new TFile();file.path='Medium.md';const view=new MarkdownView({} as WorkspaceLeaf);
  Object.assign(view,{file,editor:{getValue:()=> 'Unsaved source'} as unknown as Editor,getMode:()=> 'preview'});
  const app={workspace:{getLeavesOfType:()=>[{view}]},vault:{read:async()=> 'Current disk text'}} as unknown as App;
  expect(await noteText(app,file)).toBe('Current disk text');Object.assign(view,{getMode:()=> 'source'});expect(await noteText(app,file)).toBe('Unsaved source');
 });
});

describe('Tetrad insertion command',()=>{
 it('separates callouts from surrounding prose and selects the subject without losing existing content',()=>{
  for(const [before,after]of [['','Text'],['Before','After'],['Before\n','\nAfter'],['Before\n\n','\n\nAfter'],['Before\r\n','\r\nAfter']]){
   const insertion=createInsertion(before!,after!,custom,'Medium'),note=before!+insertion.text+after!;expect(note.startsWith(before!)).toBe(true);expect(note.endsWith(after!)).toBe(true);expect(insertion.text.slice(insertion.titleOffset,insertion.titleOffset+6)).toBe('Medium');expect(tetradBlocks(note,patterns)).toHaveLength(1);if(before!.includes('\r\n'))expect(insertion.text.replace(/\r\n/gu,'')).not.toContain('\n');
  }
 });
});
