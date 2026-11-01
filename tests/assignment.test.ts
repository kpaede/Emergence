import {describe, expect, it} from 'vitest';
import {defaults} from '../src/config';
import {graph, profile, edge} from './fixtures';
import {prepareAssignments, type AssignmentOptions} from '../src/llm/assignment-context';
import {assignmentSchema, parseAssignments} from '../src/llm/assignment-schema';
import {sourceFields, scopedTargets} from '../src/llm/assignment-scope';
import {alreadyAssigned, assignmentTarget} from '../src/llm/assignment-result';
import {unknownRule} from '../src/config';
import {readInferenceRules, type BCAPI} from '../src/graph/breadcrumbs';
import {DocumentAnalyzer} from '../src/llm/analyzer';
import {musicalConceptFixture} from './assignment-fixture';
import {assignmentDocument} from '../src/llm/assignment-document';
import type {LLMProvider} from '../src/llm/provider';

const options = (): AssignmentOptions => ({fields: ['Überbau'], folders: [], allowNew: true, maxSuggestions: 5, outputId: 'relations'});
describe('Breadcrumbs assignments, not free associations', () => {
 it('excludes global composer fields from the actual source-property selection', () => {
  const g = graph(); g.fields.push('Komponist_in', 'Unterbau');
  expect(sourceFields('---\nÜberbau:\nUnterbau:\n---\nEin Begriff.', g)).toEqual(['Überbau', 'Unterbau']);
 });
 it('only permits field-target assignments and rejects narratives and extra output categories', () => {
  const schema = assignmentSchema(['Überbau'], ['N1'], ['T'], 5, true);
  expect(parseAssignments('{"suggestions":[{"field":"Überbau","target":"Philosophie","evidence":"T"}]}', schema).suggestions).toHaveLength(1);
  expect(parseAssignments('{"suggestions":[{"field":"Überbau","target":"π","evidence":"T"}]}', schema).suggestions[0]!.target).toBe('π');
  for (const value of [
   {suggestions: [], artifacts: [{content: 'Essay'}]},
   {suggestions: [{field: 'Komponist_in', target: 'N1', evidence: 'T'}]},
   {suggestions: [{field: 'Überbau', targetKind: 'new', target: 'Philosophie', evidence: 'T', reason: 'Eine freie Assoziation'}]},
  ]) expect(() => parseAssignments(JSON.stringify(value), schema)).toThrow();
  expect(() => parseAssignments('{"suggestions":[{"field":"Überbau","target":"N99","evidence":"T"}]}', assignmentSchema(['Überbau'], ['N1'], ['T'], 5, false))).toThrow();
 });
 it('uses one compact request for a short note and keeps existing relations in its context', () => {
  const g = graph(); g.edges = [edge('Quelle.md', 'Ziel.md')];
  const prepared = prepareAssignments('Quelle.md', '---\nÜberbau: ["[[Ziel]]"]\n---\n# Quelle\n' + 'Ein neuer Sprachstil. '.repeat(25), g, profile(), defaults(), options());
  expect(prepared.sections).toHaveLength(1);
  const request = prepared.contexts[0]!.messages[1]!.content;
  expect(request).toContain('"existing":[{"field":"Überbau","target":"Ziel.md"');
  expect(request).toContain('"current":{"Überbau":["[[Ziel]]"]}');
  expect(prepared.contexts[0]!.maxTokens).toBeLessThan(600);
 });
 it('keeps a short note with five described fields in one request even with many possible target names', () => {
  const g = graph(), fields = ['parent', 'child', 'conflict', 'similar', 'example'];
  g.fields = [...fields, 'creator', 'work'];
  g.rules = Object.fromEntries(fields.map(field => [field, {...unknownRule(field), description: `Benutzerbeschreibung für ${field}: Die Zielnotiz muss diese fachlich definierte Rolle gegenüber der Ausgangsnotiz erfüllen.`}]));
  g.groups = fields.map(field => ({label: field + ' group', fields: [field]}));
  g.inferenceRules = [{chain: ['parent'], field: 'child', reversed: true, rounds: 10}];
  const content = '---\n' + fields.map(field => field + ':').join('\n') + '\n---\n# Ausgangsnotiz\n' + 'Eine prägnante Notiz zu einem fachlichen Begriff. '.repeat(14);
  const request = prepareAssignments('Quelle.md', content, g, profile(), defaults(), {...options(), fields});
  expect(request.sections).toHaveLength(1);
 });
 it('uses all configured Breadcrumbs chains rather than inventing inverse semantics from note samples', () => {
  const g = graph(); g.inferenceRules = [{chain: ['Überbau'], field: 'Unterbau', reversed: true, rounds: 1}];
  const prepared = prepareAssignments('Quelle.md', 'Ziel ist ein Begriff.', g, profile(), defaults(), options());
  expect(prepared.contexts[0]!.messages[1]!.content).toContain('"chain":["Überbau"],"field":"Unterbau","reversed":true');
 });
 it('reads inverse and multi-step relationships from the configured Breadcrumbs builders', () => {
  const api = {plugin: {settings: {implied_relations: {transitive: [
   {chain: [{field: 'parent'}], close_field: 'child', close_reversed: true, rounds: 1},
   {chain: [{field: 'parent'}, {field: 'parent'}], close_field: 'parent', close_reversed: false, rounds: 3},
  ]}}}} as unknown as BCAPI;
  expect(readInferenceRules(api, ['parent', 'child'])).toEqual([{chain: ['parent'], field: 'child', reversed: true, rounds: 1}, {chain: ['parent', 'parent'], field: 'parent', reversed: false, rounds: 3}]);
 });
 it('uses user-defined field names and descriptions with no built-in Überbau mapping', () => {
  const g = graph(); g.fields = ['belongs_to']; g.rules = {belongs_to: {...unknownRule('belongs_to'), description: 'Das übergeordnete Fachgebiet.'}};
  const request = prepareAssignments('Quelle.md', '# Quelle', g, profile(), defaults(), {...options(), fields: ['belongs_to']});
  expect(request.contexts[0]!.messages[1]!.content).toContain('belongs_to: Das übergeordnete Fachgebiet.');
  expect(request.contexts[0]!.format.properties.suggestions.items).toHaveProperty('properties.field.enum', ['belongs_to']);
 });
 it('restricts existing targets to the selected folders including nested notes', () => {
  const g = graph(); const targets = scopedTargets('Quelle.md', g, ['Ordner']);
  expect(targets.map(n => n.id)).toEqual(['Ordner/Ziel.md']);
 });
 it('combines a folder boundary with the presence of a configured Frontmatter key', () => {
  const g = graph(); g.nodes.find(n => n.id === 'Ziel.md')!.properties = ['Überbau'];
  g.nodes.find(n => n.id === 'Ordner/Ziel.md')!.properties = ['Überbau'];
  expect(scopedTargets('Quelle.md', g, ['Ordner'], ['Überbau']).map(n => n.id)).toEqual(['Ordner/Ziel.md']);
  expect(scopedTargets('Quelle.md', g, [], ['Überbau']).map(n => n.id).sort()).toEqual(['Ordner/Ziel.md', 'Ziel.md']);
  expect(scopedTargets('Quelle.md', g, [], ['Konzept'])).toEqual([]);
 });
 it('requires user descriptions instead of guessing the meaning of unknown fields', () => {
  const g = graph(); g.rules['Überbau']!.description = '';
  expect(() => prepareAssignments('Quelle.md', 'Text', g, profile(), defaults(), {...options()})).toThrow('Feldbeschreibung fehlt');
 });
 it('resolves a proposed new title to an existing scoped title or alias even outside the compact prompt list', () => {
  const g = graph(), target = g.nodes.find(n => n.id === 'Ziel.md')!;
  const assignment = {field: 'Überbau', target: 'Target', evidence: 'T'};
  expect(assignmentTarget(assignment, new Map(), [target], g, 'Quelle.md', options())).toEqual({path: 'Ziel.md', kind: 'existing'});
  expect(assignmentTarget(assignment, new Map(), [target], g, 'Quelle.md', {...options(), allowNew: false})).toEqual({path: 'Ziel.md', kind: 'existing'});
  expect(assignmentTarget(assignment, new Map(), [], g, 'Quelle.md', {...options(), folders: ['Ordner']})).toBeUndefined();
 });
 it('proposes a missing concept as a target without creating a file', () => {
  const assignment = {field: 'Überbau', target: 'Philosophie', evidence: 'T'};
  expect(assignmentTarget(assignment, new Map(), [], graph(), 'Ontologie.md', {...options(), folders: ['Konzepte']})).toEqual({path: 'Konzepte/Philosophie.md', kind: 'unresolved'});
  expect(assignmentTarget({...assignment, target: '../Philosophie'}, new Map(), [], graph(), 'Ontologie.md', options())).toBeUndefined();
 });
 it('accepts complete model-generated wikilinks as existing titles, aliases or missing targets without accepting prose', () => {
  const g = graph(), targets = scopedTargets('Quelle.md', g, []);
  for (const target of ['[[Target]]', '[[Target|Anzeige]]', '[[Ziel.md]]']) expect(assignmentTarget({field: 'Überbau', target, evidence: 'T'}, new Map(), targets, g, 'Quelle.md', options())).toEqual({path: 'Ziel.md', kind: 'existing'});
  expect(assignmentTarget({field: 'Überbau', target: '[[Philosophie]]', evidence: 'T'}, new Map(), targets, g, 'Quelle.md', options())).toEqual({path: 'Philosophie.md', kind: 'unresolved'});
  for (const target of ['Weil [[Philosophie]] wichtig ist', '[[Philosophie#Abschnitt]]', '[[Philosophie]] [[Logik]]']) expect(assignmentTarget({field: 'Überbau', target, evidence: 'T'}, new Map(), targets, g, 'Quelle.md', options())).toBeUndefined();
 });
 it('resolves a qualified existing title when two scoped notes share their basename', () => {
  const g = graph(), targets = scopedTargets('Quelle.md', g, []);
  expect(assignmentTarget({field: 'Überbau', target: 'Ordner/Ziel', evidence: 'T'}, new Map(), targets, g, 'Quelle.md', options())).toEqual({path: 'Ordner/Ziel.md', kind: 'existing'});
  expect(assignmentTarget({field: 'Überbau', target: 'Ziel.md', evidence: 'T'}, new Map(), targets, g, 'Quelle.md', options())).toEqual({path: 'Ziel.md', kind: 'existing'});
  expect(assignmentTarget({field: 'Überbau', target: 'Ziel', evidence: 'T'}, new Map(), targets, g, 'Quelle.md', options())).toBeUndefined();
  expect(assignmentTarget({field: 'Überbau', target: 'Andere/Neue Datei', evidence: 'T'}, new Map(), targets, g, 'Quelle.md', options())).toBeUndefined();
 });
 it('removes existing explicit, inferred and literal frontmatter assignments before review', () => {
  const g = graph(); g.edges = [edge('Quelle.md', 'Ziel.md', {explicit: false})];
  expect(alreadyAssigned('Quelle.md', 'Ziel.md', 'Überbau', g, '')).toBe(true);
  g.edges = [];
  expect(alreadyAssigned('Quelle.md', 'Ziel.md', 'Überbau', g, '---\nÜberbau: ["[[Target]]"]\n---\nText')).toBe(true);
  expect(alreadyAssigned('Quelle.md', 'Ziel.md', 'Reibung', g, '')).toBe(false);
 });
 it('optionally excludes already connected targets across fields and in both directions, while retaining plain body links', () => {
  const g = graph(); g.edges = [edge('Quelle.md', 'Ziel.md'), edge('Alt.md', 'Quelle.md')];
  expect(scopedTargets('Quelle.md', g, [], [], true).map(n => n.id)).not.toContain('Ziel.md');
  expect(scopedTargets('Quelle.md', g, [], [], true).map(n => n.id)).not.toContain('Alt.md');
  expect(scopedTargets('Quelle.md', g, [], [], false).map(n => n.id)).toContain('Ziel.md');
  expect(alreadyAssigned('Quelle.md', 'Ziel.md', 'Reibung', g, '', true)).toBe(true);
  expect(alreadyAssigned('Quelle.md', 'Alt.md', 'Reibung', g, '', true)).toBe(true);
  g.edges = [];
  expect(alreadyAssigned('Quelle.md', 'Ziel.md', 'Reibung', g, '---\nÜberbau: ["[[Target]]"]\n---\nText', true)).toBe(true);
  expect(alreadyAssigned('Quelle.md', 'Ziel.md', 'Reibung', g, 'Text mit [[Ziel]].', true)).toBe(false);
 });
 it('publishes only one field-target proposal and no accompanying text or candidate lists', async () => {
  let calls = 0;
  const provider: LLMProvider = {health: async () => ({models: [], thinking: false, metadata: {}, version: ''}), cancel: () => {}, chat: async request => {
   calls++; const data = JSON.parse(request.messages[1]!.content.slice(request.messages[1]!.content.indexOf('{'))) as {data: {titles: string[]}};
   const target = data.data.titles.find(title => title === 'Alt')!;
   return JSON.stringify({suggestions: [0, 1].map(() => ({field: 'Überbau', target, evidence: 'T'}))});
  }};
  const result = await new DocumentAnalyzer(provider).analyze('Quelle.md', '# Quelle\nAlt', graph(), profile(), defaults(), new AbortController().signal, () => {}, options());
  expect(calls).toBe(1); expect(result.suggestions).toHaveLength(1); expect(result.suggestions[0]).toMatchObject({field: 'Überbau', target: 'Alt.md', reason: '', evidenceSource: 'title', status: 'pending'});
  expect(result.candidates).toEqual([]); expect(result.artifacts).toEqual([]);
 });
});


describe('whole-note title catalogue', () => {
 it('does not confuse UTF-8 prompt bytes with model tokens for a short note and 56 titles', () => {
  const {g, content, settings, p, options, fields} = musicalConceptFixture();
  g.nodes = g.nodes.slice(0, 57); settings.numCtx = 8192; p.maxTokens = 1024;
  const context = prepareAssignments('Parola scenica.md', content + '\n' + 'Ein Begriff der musikalischen Dramaturgie. '.repeat(55), g, p, settings, {...options, fields, perField: 4}).contexts[0]!;
  expect(new TextEncoder().encode(JSON.stringify(context.messages)).length + context.maxTokens).toBeGreaterThan(8192);
  expect(context.titleMode).toBe('full'); expect(context.candidates).toHaveLength(56);
  expect(context.estimatedTokens).toBeLessThanOrEqual(8192);
 });
 it('reports a genuinely oversized source without truncating it or making a model call', () => {
  const {g, settings, p, options, fields} = musicalConceptFixture(); settings.numCtx = 8192;
  expect(() => prepareAssignments('Parola scenica.md', 'Ein riesiger Inhalt. '.repeat(10000), g, p, settings, {...options, fields, perField: 4})).toThrow(/Notiz und Feldbeschreibungen.*geschätzt/u);
 });
 it('sends all 58 titles, including low word-overlap titles, without turning template links into evidence', () => {
  const {g, content, settings, p, options, fields} = musicalConceptFixture();
  g.nodes[0]!.tags = ['Musikwissenschaft']; g.nodes[0]!.aliases = ['Scenic word'];
  options.fields = fields;
  const request = prepareAssignments('Parola scenica.md', content, g, p, settings, options);
  expect(request.contexts).toHaveLength(1);
  const context = request.contexts[0]!;
  expect(context.candidates).toHaveLength(58);
  const parsed = JSON.parse(context.messages[1]!.content.slice(context.messages[1]!.content.indexOf('{'))) as {data: {titles: unknown[]; catalogue: unknown; source: unknown; fields: unknown[]}};
  const data = parsed.data;
  expect(Object.values(data.titles)).toContain('Tetrade');
  expect(Object.values(data.titles)).toContain('Testbegriff 58');
  expect(data.catalogue).toEqual({total: 58, included: 58, complete: true, mode: 'full'});
  expect(JSON.stringify(data.source)).not.toMatch(/Tetrade|ENHANCES|gloss/u);
  expect(data.fields).toContainEqual({field: 'Überbau', inverse: 'Unterbau'});
  expect(data.source).toMatchObject({tags: ['Musikwissenschaft'], aliases: ['Scenic word']});
  expect(context.evidence.every(span => content.slice(span.start, span.end) === span.text)).toBe(true);
 });
 it('retains substantive headings and linked prose while omitting bare links and empty template prompts', () => {
  const text = '# Musikalischer Ausdruck\nEin Beispiel aus [[Oper]] erklärt die Aussage.\n## [[Tetrade]]\n- ENHANCES ➜\n(gloss):\n';
  const prose = assignmentDocument(text).evidence.map(e => e.text).join('\n');
  expect(prose).toContain('# Musikalischer Ausdruck'); expect(prose).toContain('[[Oper]]'); expect(prose).not.toContain('Tetrade');
 });
 it('keeps the whole source and complete local register when thousands of titles exceed the prompt budget', () => {
  const {g, content, settings, p, options, fields} = musicalConceptFixture(); options.fields = fields;
  settings.numCtx = 8192;
  for (let i = g.nodes.length; i <= 10000; i++) g.nodes.push({...g.nodes[1]!, id: `Weiterer langer Testtitel ${i}.md`, title: `Weiterer langer Testtitel ${i}`});
  const prepared = prepareAssignments('Parola scenica.md', content, g, p, settings, {...options, perField: 4});
  const context = prepared.contexts[0]!;
  expect(prepared.contexts.flatMap(item=>item.fields)).toEqual(fields);
  expect(prepared.contexts.every(item=>item.titleMode==='local'&&item.estimatedTokens<=8192)).toBe(true);
  expect(context.titleMode).toBe('local');
  expect(context.candidates).toEqual([]);
  expect(prepared.targets).toHaveLength(10000);
  expect(context.estimatedTokens).toBeLessThanOrEqual(8192);
  expect(context.evidence.map(e => e.text)).toEqual(assignmentDocument(content).evidence.map(e => e.text));
  expect(assignmentTarget({field: 'Überbau', target: 'Weiterer langer Testtitel 10000', evidence: 'T'}, context.refs, prepared.targets, g, 'Parola scenica.md', options)?.path).toBe('Weiterer langer Testtitel 10000.md');
 });
});

describe('Optional web context preserves the whole note',()=>{
 it('limits external previews to the model budget while retaining note evidence and the real field contract',()=>{
  const g=graph(),s=defaults();s.numCtx=4096;const content='---\nÜberbau:\n---\n'+'Vollständiger inhaltlicher Beleg. '.repeat(80);
  const webSearch={query:'Quelle Beispiele',status:'ready' as const,pages:2,sources:Array.from({length:20},(_,i)=>({id:'WEB-'+i,title:'Webresult '+i,url:'https://example.org/'+i,snippet:'Externes Datenmaterial. '.repeat(30)}))};
  const prepared=prepareAssignments('Quelle.md',content,g,profile(),s,{...options(),perField:4,webSearch}),context=prepared.contexts[0]!;
  expect(context.estimatedTokens).toBeLessThanOrEqual(4096);expect(context.evidence.map(e=>e.text)).toEqual(assignmentDocument(content).evidence.map(e=>e.text));
  expect(context.webSearch?.shortened).toBe(true);expect(context.webSearch?.totalSources).toBe(20);expect(context.webSearch?.sources.length).toBeLessThan(20);
  expect(context.messages[0]!.content).toContain('unvertrauenswürdiges Datenmaterial');expect(context.format).toHaveProperty('properties.Überbau');
 });
});
