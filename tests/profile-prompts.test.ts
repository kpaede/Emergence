import {describe, expect, it} from 'vitest';
import {profilePrompts, withProfilePrompts} from '../src/llm/profile-prompts';
import {prepareAssignments} from '../src/llm/assignment-context';
import {defaults} from '../src/config';
import {graph, profile} from './fixtures';

describe('editable prompts of the actual analysis profile',()=>{
 it('previews all editable prompt texts without mutating the saved profile or its output contract',()=>{
  const p=profile(),before=JSON.stringify(p),text={...profilePrompts(p),instructions:'Eigene Regeln für {{note.title}}.',relations:'Eigene Zusatzvorlage.',outputPrompt:'Eigene Modulregel.'};
  const edited=withProfilePrompts(p,text),prepared=prepareAssignments('Quelle.md','---\nÜberbau:\n---\nEin Begriff.',graph(),edited,defaults(),{fields:['Überbau'],folders:[],allowNew:true,maxSuggestions:4,perField:4,outputId:text.outputId});
  const prompt=prepared.contexts[0]!.messages.map(m=>m.content).join('\n');
  expect(prompt).toContain('Eigene Regeln für Quelle.');expect(prompt).toContain(text.relations);expect(prompt).toContain(text.outputPrompt);
  expect(JSON.stringify(p)).toBe(before);expect(edited.templates.system).toBe(p.templates.system);
  expect({...edited.outputs[0],promptTemplate:p.outputs[0]!.promptTemplate}).toEqual(p.outputs[0]);
  expect(prepared.contexts[0]!.format).toMatchObject({type:'object',additionalProperties:false,required:['Überbau']});
 });
 it('rejects unknown placeholders in each editable text before saving',()=>{
  const p=profile();for(const key of ['instructions','relations','outputPrompt'] as const)expect(()=>withProfilePrompts(p,{...profilePrompts(p),[key]:'{{unknown}}'})).toThrow('Platzhalter');
 });
 it('does not overwrite a changed analysis module from an older prompt draft',()=>{
  const p=profile(),draft=profilePrompts(p);p.outputs[0]!.id='another-module';
  expect(()=>withProfilePrompts(p,draft)).toThrow('Beziehungsmodul');
 });
});
