import {describe,expect,it,vi} from 'vitest';
import type {Setting,SettingDefinition,SettingDefinitionItem,SettingDefinitionPage} from 'obsidian';
import {settingsDefinitions, type SettingsSection} from '../src/ui/settings/definitions';
function editor(page:SettingDefinitionItem):SettingDefinition {
 if(!('type'in page)||page.type!=='page'||!page.items?.[0]||'type'in page.items[0])throw Error('Expected an indexed editor page.');return page.items[0];
}
describe('native indexed settings editors',()=>{
 it('indexes actual field and model controls without rendering or mutating settings during registration',()=>{
  const render=vi.fn<(setting:Setting,section:SettingsSection)=>void>(),fields=Object.freeze(['Überbau','Ein eigenes Feld']),profiles=Object.freeze(['Mein Profil']);
  const pages=settingsDefinitions(render,fields,profiles);expect(render).not.toHaveBeenCalled();expect(pages).toHaveLength(4);
  expect(editor(pages[0]!).aliases).toContain('Kontextfenster');expect(editor(pages[1]!).aliases).toEqual(expect.arrayContaining([...fields]));expect(editor(pages[2]!).aliases).toContain('Mein Profil');expect(editor(pages[3]!).aliases).toContain('Citekey kopieren');
 });
 it('routes an indexed editor to its real section and does not use auto-persisting controls',()=>{
  const render=vi.fn<(setting:Setting,section:SettingsSection)=>void>(),pages=settingsDefinitions(render,[],[]),setting={} as Setting;
  for(const page of pages){const def=editor(page);expect(def.control).toBeUndefined();expect(def.render).toBeTypeOf('function');def.render?.(setting,{} as never);}
  expect(render.mock.calls.map(call=>call[1])).toEqual(['model','relations','profiles','data']);
 });
 it('provides unique native navigation pages and excludes the removed research section',()=>{
  const pages=settingsDefinitions(()=>{},[],[]) as SettingDefinitionPage[];expect(new Set(pages.map(page=>page.name)).size).toBe(pages.length);
  expect(JSON.stringify(pages)).not.toMatch(/Recherche|inquiry/iu);expect(pages.every(page=>page.items?.length)).toBe(true);
 });
});


describe('feature settings navigation',()=>{
 it('places one global language control above the five native feature pages',()=>{
  const render=vi.fn(),features={language:{name:'Sprache',control:{type:'dropdown' as const,key:'uiLanguage',options:{auto:'Obsidian',de:'Deutsch',en:'English'}}},graph:[{name:'Graph editor'}],mermaid:[{name:'Mermaid editor'}],argdown:[{name:'Argdown editor'}],search:[{name:'Search preferences'}]};
  const definitions=settingsDefinitions(render,['Eigenes Feld'],['Eigenes Profil'],features);expect(render).not.toHaveBeenCalled();expect(definitions[0]).toBe(features.language);expect(definitions.slice(1).map(item=>'name'in item?item.name:undefined)).toEqual(['Graph','Feldideen','Mermaid','Argdown','Suche']);
  const ideas=definitions[2] as SettingDefinitionPage;expect(ideas.items?.map(item=>'name'in item?item.name:undefined)).toEqual(['Modell','Beziehungen','Profile','Daten']);expect(editor(ideas.items![1]!).aliases).toContain('Eigenes Feld');expect(editor(ideas.items![2]!).aliases).toContain('Eigenes Profil');
 });
});
