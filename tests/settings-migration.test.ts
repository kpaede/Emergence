import {describe,it,expect} from 'vitest';
import {defaults,migrateSettings} from '../src/config';
describe('removing obsolete research configuration',()=>{
 it('discards former research templates while preserving model, profiles, field descriptions and per-note preferences',()=>{
  const settings=defaults();settings.model='local:personal';settings.profiles[0]!.instructions='Eigene Feldideen-Regeln';settings.fieldDescriptions={'Überbau':'Übergeordnete Disziplin'};settings.assignment.fieldsByNote={'Ontologie.md':['Überbau']};
  const legacy={...settings,inquiryTemplates:[{name:'Frühere Frage',prompt:'Früherer Text'}]},before=JSON.stringify(legacy);
  expect(migrateSettings(legacy)).toEqual(settings);expect(JSON.stringify(legacy)).toBe(before);
 });
 it('no longer validates unused former template data when loading an existing installation',()=>{
  expect(migrateSettings({...defaults(),inquiryTemplates:'obsolete invalid data'})).toEqual(defaults());
 });
});
