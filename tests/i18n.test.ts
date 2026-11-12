import {afterEach,describe,expect,it} from 'vitest';
import {initializeLanguage,resolveLocale,t,number as formatNumber,dateTime} from '../src/i18n';
import {en} from '../src/i18n/locales/en';
import {de} from '../src/i18n/locales/de';
import {migrateSettings,defaults} from '../src/config';
import {synopsisLabels} from '../src/graph/synopsis-types';
import {synopsisFixture} from './synopsis-fixture';
import {synopsisFields} from '../src/graph/synopsis';
import {MermaidLibrary} from '../src/mermaid/library';
import {ArgdownEngine} from '../src/argdown/engine';
import {ARGDOWN_EXAMPLES} from '../src/argdown/blocks';
import {shapeChoices} from '../src/mermaid/choice-presets';
afterEach(()=>initializeLanguage('de'));
describe('Local interface catalogs',()=>{
 it('has exactly the same nonempty keys and interpolation parameters in both languages',()=>{
  expect(Object.keys(de).sort()).toEqual(Object.keys(en).sort());
  const parameters=(value:string)=>[...value.matchAll(/\{\{\s*([^},]+)(?:,[^}]+)?\s*\}\}/gu)].map(match=>match[1]!.trim()).sort();
  for(const key of Object.keys(en) as (keyof typeof en)[]){expect(de[key].trim(),key).not.toBe('');expect(parameters(de[key]),key).toEqual(parameters(en[key]));}
 });
 it('follows Obsidian language codes with English fallback and honors explicit overrides',()=>{
  for(const language of ['de','de-DE','de_CH'])expect(resolveLocale('auto',language)).toBe('de');
  for(const language of ['en','en-GB','fr','ja','', 'default'])expect(resolveLocale('auto',language)).toBe('en');
  expect(resolveLocale('en','de')).toBe('en');expect(resolveLocale('de','en')).toBe('de');
 });
 it('uses complete messages, literal interpolation and CLDR singular/plural forms',()=>{
  initializeLanguage('en');expect(t('messages.pendingDecision',{count:1})).toBe('1 suggestion still needs your decision.');expect(t('messages.pendingDecision',{count:2})).toBe('2 suggestions still need your decision.');
  expect(t('messages.fileMissing',{path:'<img> {{name}}.md'})).toBe('File is missing: <img> {{name}}.md');
  initializeLanguage('de');expect(t('messages.pendingDecision',{count:1})).toBe('Noch 1 Vorschlag braucht deine Entscheidung.');expect(t('messages.openIdeas',{count:2})).toBe('2 offene Ideen');
 });
 it('resolves module-level labels at use time instead of caching the initial language',()=>{
  initializeLanguage('en');expect(synopsisLabels.narrower).toBe('Narrower');expect(synopsisLabels.similar).toBe('Similarity');expect(shapeChoices(false).find(choice=>choice.value==='rect')?.label).toBe('Rectangle');
  initializeLanguage('de');expect(synopsisLabels.narrower).toBe('Unterordnung');expect(shapeChoices(false).find(choice=>choice.value==='rect')?.label).toBe('Rechteck');
 });
 it('keeps vault field matching independent of translated graph labels',()=>{const graph=synopsisFixture(),settings=defaults(),before=JSON.stringify(graph),fields=synopsisFields(graph,settings);initializeLanguage('en');expect(synopsisFields(graph,settings)).toEqual(fields);expect(synopsisLabels.broader).toBe('Broader');expect(JSON.stringify(graph)).toBe(before);});
 it('localizes new starter diagrams while preserving custom templates and original examples',async()=>{
  const library=new MermaidLibrary(undefined,async()=>{});await library.add('Eigener Name','flowchart LR\nA[Eigener Text]');const data=JSON.stringify(library.snapshot()),originalExample=library.list().find(item=>item.id==='pele-0')!.source;
  initializeLanguage('en');expect(library.list().find(item=>item.id==='starter-flowchart')!.source).toContain('B{Decision}');expect(library.list().find(item=>item.id==='starter-mindmap')!.source).toContain('Topic');expect(library.list().find(item=>item.id==='pele-0')!.source).toBe(originalExample);expect(JSON.stringify(library.snapshot())).toBe(data);
  const engine=new ArgdownEngine();for(const example of ARGDOWN_EXAMPLES.slice(0,3))expect(()=>engine.parse(example.source)).not.toThrow();expect(ARGDOWN_EXAMPLES[0]!.source).toContain('[Thesis]');
  initializeLanguage('de');expect(library.list().find(item=>item.id==='starter-flowchart')!.source).toContain('B{Entscheidung}');expect(ARGDOWN_EXAMPLES[0]!.source).toContain('[These]');
 });
 it('formats display numbers and times with the selected locale',()=>{
  initializeLanguage('en');expect(formatNumber(1234.5)).toBe('1,234.5');const english=dateTime(new Date('2026-11-12T12:00:00Z'));
  initializeLanguage('de');expect(formatNumber(1234.5)).toBe('1.234,5');expect(dateTime(new Date('2026-11-12T12:00:00Z'))).not.toBe(english);
 });
 it('preserves the German interface of older installations without changing their authored content',()=>{
  const previous=defaults();delete previous.uiLanguage;previous.profiles[0]!.name='Mein Profil';previous.profiles[0]!.instructions='Eigene Anweisung';previous.profiles[0]!.language='de';previous.fieldDescriptions={Feld:'Eigener Text'};
  const before=JSON.stringify(previous),migrated=migrateSettings(previous);expect(migrated.uiLanguage).toBe('de');expect(migrated.profiles).toEqual(previous.profiles);expect(migrated.fieldDescriptions).toEqual(previous.fieldDescriptions);expect(JSON.stringify(previous)).toBe(before);
  expect(migrateSettings(null).uiLanguage).toBe('auto');expect(migrateSettings({...migrated,uiLanguage:'en'}).profiles[0]!.language).toBe('de');
 });
});
