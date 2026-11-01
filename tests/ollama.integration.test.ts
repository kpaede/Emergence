// @vitest-environment jsdom
import {musicalConceptFixture} from './assignment-fixture';
import {expect, it} from 'vitest';
import {defaults, unknownRule} from '../src/config';
import {OllamaProvider, type LLMProvider} from '../src/llm/provider';
import {DocumentAnalyzer} from '../src/llm/analyzer';
import type {Concept} from '../src/types';
import {graph, profile, edge} from './fixtures';
import type {AssignmentOptions} from '../src/llm/assignment-context';
import {contextEstimate,estimateTextTokens} from '../src/llm/context';
import {hash} from '../src/util';

const live = process.env.EMERGENCE_OLLAMA_TEST === '1';
const concept = (id: string, properties: string[] = []): Concept => ({id, title: id.split('/').at(-1)!.replace(/\.md$/u, ''), aliases: [], tags: [], type: 'md', exists: true, mtime: 1, size: 1, properties});
const model = process.env.EMERGENCE_TEST_MODEL ?? defaults().model;
const settings = defaults(); settings.model = model;

it.skipIf(!live)('local Qwen processes a note larger than its context window before proposing field ideas',async()=>{
 const config={...settings,timeoutMs:180000},g=graph(),p=profile();p.maxTokens=1024;
 g.fields=['Überbau'];g.groups=[];g.edges=[];g.nodes=[concept('Ontologie.md',['Überbau']),concept('Philosophie.md')];g.rules={'Überbau':{...unknownRule('Überbau'),description:'Übergeordnetes Fachgebiet, dessen Teildisziplin die Ausgangsnotiz ist.',provenance:'user',writable:true,targetProperty:'Überbau'}};
 const paragraphs=['Ontologie untersucht als philosophische Disziplin das Sein, Existenz und Kategorien des Seienden.','Substanzen, Eigenschaften, Relationen und Prozesse sind mögliche ontologische Kategorien. Die Einordnung eines Begriffs ist von seinem Namen zu unterscheiden.','Erkenntnistheorie fragt nach Wissen und seinen Bedingungen. Ontologie fragt dagegen danach, was existiert. Beide gehören zur Philosophie.'];
 let body='# Ontologie\n';for(let i=0;estimateTextTokens(body)<config.numCtx*1.15;i++)body+=`\nAbsatz ${i+1}. ${paragraphs[i%paragraphs.length]}\n`;
 const text='---\nÜberbau:\n---\n'+body+'\nAbschluss: Ontologie ist eine Teildisziplin der Philosophie.\n',provider=new OllamaProvider(()=>config),requests:import('../src/llm/provider').ChatOptions[]=[],start=performance.now();
 const tracked:LLMProvider={health:signal=>provider.health(signal),cancel:()=>provider.cancel(),chat:async request=>{requests.push(request);expect(contextEstimate(request.messages,request.maxTokens,request.format)).toBeLessThanOrEqual(config.numCtx);return provider.chat(request);}};
 const result=await new DocumentAnalyzer(tracked).analyze('Ontologie.md',text,g,p,config,new AbortController().signal,message=>process.stdout.write(message+'\n'),{fields:['Überbau'],folders:[],allowNew:true,maxSuggestions:4,perField:4,outputId:'relations'});
 process.stdout.write(JSON.stringify({case:'long-note-field-ideas',sourceCharacters:text.length,estimatedSourceTokens:estimateTextTokens(body),numCtx:config.numCtx,requests:requests.length,seconds:Number(((performance.now()-start)/1000).toFixed(2)),status:result.status,assignments:result.suggestions.map(s=>[s.field,s.target]),diagnostics:result.diagnostics})+'\n');
 expect(result.status,result.errors.join('\n')).toBe('complete');expect(result.sourceVersion).toBe(await hash(text));expect(result.diagnostics?.sourceMode).toBe('overview');expect(result.diagnostics!.sourceParts).toBeGreaterThan(1);expect(result.suggestions).toContainEqual(expect.objectContaining({field:'Überbau',target:'Philosophie.md',status:'pending',value:'[[Philosophie]]'}));
},600000);
const options = (fields: string[]): AssignmentOptions => ({fields, folders: [], allowNew: true, maxSuggestions: 4, outputId: 'relations'});
function counted(config = settings) {
 const provider = new OllamaProvider(() => config);
 let calls = 0, response = '';
 const countedProvider: LLMProvider = {health: signal => provider.health(signal), cancel: () => provider.cancel(), chat: async request => {calls++; response = await provider.chat(request); return response;}};
 return {analyzer: new DocumentAnalyzer(countedProvider), calls: () => calls, response: () => response};
}
for (const exists of [true, false]) it.skipIf(!live)(`local Qwen assigns Ontologie to Philosophie (${exists ? 'existing' : 'missing'} target), in one request`, async () => {
 const g = graph(); g.fields = ['Überbau']; g.groups = []; g.edges = [];
 g.nodes = [concept('Konzepte/Ontologie.md', ['Überbau']), concept('Konzepte/Sprachwissenschaft.md'), ...(exists ? [concept('Konzepte/Philosophie.md')] : [])];
 g.rules = {'Überbau': {...unknownRule('Überbau'), description: 'Das übergeordnete Fachgebiet, in das die Ausgangsnotiz inhaltlich gehört.', provenance: 'user', writable: true, targetProperty: 'Überbau'}};
 const text = '---\nÜberbau:\n---\n# Ontologie\nOntologie ist eine philosophische Disziplin und untersucht das Sein, die Existenz und die grundlegenden Kategorien des Seienden.';
 const test = counted(), start = performance.now();
 const result = await test.analyzer.analyze('Konzepte/Ontologie.md', text, g, profile(), settings, new AbortController().signal, () => {}, options(['Überbau']));
 expect(result.status, result.errors.join('\n')).toBe('complete'); expect(test.calls()).toBe(1);
 expect(result.suggestions, test.response()).toContainEqual(expect.objectContaining({field: 'Überbau', target: 'Konzepte/Philosophie.md', targetKind: exists ? 'existing' : 'unresolved', status: 'pending', reason: ''}));
 expect(result.candidates).toEqual([]); expect(result.artifacts).toEqual([]);
 process.stdout.write(JSON.stringify({case: exists ? 'ontology-existing' : 'ontology-new', requests: test.calls(), seconds: Number(((performance.now() - start) / 1000).toFixed(2)), assignments: result.suggestions.map(s => [s.field, s.target])}) + '\n');
}, 180000);

it.skipIf(!live)('local Qwen does not assign an existing composer or an unrelated work to a concept', async () => {
 const g = graph(); g.fields = ['Überbau', 'Reibung', 'Ähnlichkeit', 'Beispiel', 'Komponist_in']; g.groups = [];
 g.nodes = [concept('Parola scenica.md'), concept('Personen/Verdi, Giuseppe.md'), concept('Werke/Belmont und Constanze.md')];
 g.edges = [edge('Parola scenica.md', 'Personen/Verdi, Giuseppe.md')];
 const descriptions: Record<string, string> = {
  Überbau: 'Übergeordnetes Fachgebiet oder fachlicher Herkunftskontext. Bereits vorhandene Zuordnungen nicht wiederholen.',
  Reibung: 'Eine Position, die einer konkreten Aussage der Ausgangsnotiz widerspricht. Ein anderes Thema genügt nicht.',
  Ähnlichkeit: 'Ein anderes fachliches Konzept mit vergleichbarer Funktion. Keine bloße Person oder Werkzugehörigkeit.',
  Beispiel: 'Ein konkreter, nachweisbarer Anwendungsfall des beschriebenen Konzepts. Eine gemeinsame Gattung genügt nicht.',
 };
 g.rules = Object.fromEntries(Object.entries(descriptions).map(([field, description]) => [field, {...unknownRule(field), description, provenance: 'user' as const, writable: true, targetProperty: field}]));
 const text = '---\nÜberbau: ["[[Personen/Verdi, Giuseppe]]"]\nReibung:\nÄhnlichkeit:\nBeispiel:\n---\n# Parola scenica\nEin dramatischer Sprachstil, der eine kurze prägnante Wendung musikalisch hervorhebt, um die Situation auf den Punkt zu bringen.';
 const test = counted(), start = performance.now();
 const result = await test.analyzer.analyze('Parola scenica.md', text, g, profile(), settings, new AbortController().signal, () => {}, options(Object.keys(descriptions)));
 expect(result.status, result.errors.join('\n')).toBe('complete'); expect(test.calls()).toBe(1);
 expect(result.suggestions.some(s => s.field === 'Komponist_in' || s.target.includes('Verdi') || s.target.includes('Belmont') || /Act|Scene/iu.test(s.target))).toBe(false);
 expect(new Set(result.suggestions.map(s => s.target)).size).toBe(result.suggestions.length);
 process.stdout.write(JSON.stringify({case: 'concept-roles', requests: test.calls(), seconds: Number(((performance.now() - start) / 1000).toFixed(2)), assignments: result.suggestions.map(s => [s.field, s.target])}) + '\n');
}, 180000);


it.skipIf(!live)('local Qwen proposes a useful musical parent with 58 complete titles and ignores an empty template link', async () => {
 const {g, content, settings, p, options} = musicalConceptFixture();
 settings.model = model;
 p.instructions = 'Fachkontext: Musikwissenschaft. ' + p.instructions;
 const test = counted(settings), start = performance.now();
 const result = await test.analyzer.analyze('Parola scenica.md', content, g, p, settings, new AbortController().signal, () => {}, options);
 process.stdout.write(JSON.stringify({case: 'musical-parent-full-catalogue', requests: test.calls(), seconds: Number(((performance.now() - start) / 1000).toFixed(2)), assignments: result.suggestions.map(s => [s.field, s.target]), metrics: result.diagnostics}) + '\n');
 expect(result.status, result.errors.join('\n')).toBe('complete'); expect(test.calls()).toBe(1);
 expect(result.suggestions.some(s => s.field === 'Überbau' && /(?:^|\/)(?:Oper|Musiktheater)\.md$/u.test(s.target)), test.response()).toBe(true);
 expect(result.suggestions.some(s => /Tetrade|Verdi|Prima la musica|Das kurze Leben/u.test(s.target)), test.response()).toBe(false);
 expect(result.suggestions.some(s => s.field === 'Unterbau' && /Recitativo|Belcanto/u.test(s.target)), test.response()).toBe(false);
 expect(result.diagnostics).toMatchObject({requests: 1, titlesTotal: 58, titlesSent: 58});
}, 180000);

it.skipIf(!live)('local Qwen knows the broad domain of the musical concept without a candidate catalogue', async () => {
 const provider = new OllamaProvider(() => settings), start = performance.now();
 const response = await provider.chat({messages: [{role: 'system', content: 'Antworte ausschließlich mit JSON mit dem Schlüssel titles (Liste von Begriffen).'}, {role: 'user', content: 'In welchen übergeordneten Fachgebieten oder Gattungen wird der Begriff „Parola scenica“ verwendet? Nenne höchstens drei breite Oberbegriffe.'}],
  temperature: 0, maxTokens: 160, signal: new AbortController().signal,
  format: {type: 'object', additionalProperties: false, required: ['titles'], properties: {titles: {type: 'array', maxItems: 3, items: {type: 'string'}}}}});
 const result = JSON.parse(response) as {titles: string[]};
 process.stdout.write(JSON.stringify({case: 'domain-knowledge-control', seconds: Number(((performance.now() - start) / 1000).toFixed(2)), titles: result.titles}) + '\n');
 expect(result.titles.some(t => /Oper|Musiktheater/u.test(t)), response).toBe(true);
}, 180000);
