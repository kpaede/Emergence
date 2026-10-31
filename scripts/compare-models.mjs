import {build} from 'esbuild';
import {mkdtemp, writeFile, rm, readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join, resolve} from 'node:path';
import {pathToFileURL} from 'node:url';

// Explicit benchmark only: synthetic data, installed local models, sequential calls, no Vault access.
const models = process.argv.slice(2).filter(arg => arg !== '--append');
const append = process.argv.includes('--append');
const folder = await mkdtemp(join(tmpdir(), 'emergence-model-comparison-'));
const endpoint = 'http://127.0.0.1:11434';
const output = resolve('docs/model-comparison.json');
const report = append ? JSON.parse(await readFile(output, 'utf8')) : {date: new Date().toISOString(), syntheticOnly: true, notesRead: 0, notesWritten: 0, results: []};
if (!report.syntheticOnly || report.notesRead !== 0) throw Error('Nur synthetische Berichte können ergänzt werden.');
report.updated = new Date().toISOString();
const save = () => writeFile(output, JSON.stringify(report, null, 2) + '\n');
const post = async (path, data) => {
 const response = await fetch(endpoint + '/api/' + path, {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(data), signal: AbortSignal.timeout(30000)});
 if (!response.ok) throw Error(path + ': HTTP ' + response.status); return response.json();
};
try {
 await build({stdin: {contents: `export {OllamaProvider} from './src/llm/provider'; export {DocumentAnalyzer} from './src/llm/analyzer'; export * from './tests/model-comparison-fixture';`, resolveDir: process.cwd()}, bundle: true, platform: 'node', format: 'esm', banner: {js: "import {createRequire} from 'node:module'; const require = createRequire(import.meta.url);"}, outfile: join(folder, 'runtime.mjs'), logLevel: 'silent'});
 const {OllamaProvider, DocumentAnalyzer, comparisonCases, pairCases, comparisonSettings, scoreAssignments} = await import(pathToFileURL(join(folder, 'runtime.mjs')).href);
 const installed = await (await fetch(endpoint + '/api/tags')).json();
 if (!models.length) models.push(...installed.models.map(m => m.name));
 for (const model of models) {
  if (!installed.models.some(m => m.name === model)) throw Error('Modell ist nicht installiert: ' + model + '. Kein automatischer Download.');
  const settings = comparisonSettings(); settings.model = model; settings.timeoutMs = 90000;
  const provider = new OllamaProvider(() => settings), capabilities = await provider.health();
  const modelResult = {model, details: capabilities.metadata.details, mode: 'thinking-disabled', numCtx: settings.numCtx, generation: [], pairClassification: null};
  report.results.push(modelResult); await save();
  console.log(JSON.stringify({event: 'model-start', model, details: modelResult.details}));
  for (const test of comparisonCases()) {
   const start = performance.now();
   try {
    const f = test.fixture; f.settings.model = model; f.settings.timeoutMs = settings.timeoutMs;
    const result = await new DocumentAnalyzer(provider).analyze(test.source, f.content, f.g, f.p, f.settings, new AbortController().signal, () => {}, '', '', f.options);
    const score = scoreAssignments(result, test);
    modelResult.generation.push({case: test.id, ...score, status: result.status, errors: result.errors, elapsedMs: result.elapsedMs, diagnostics: result.diagnostics,
     assignments: result.suggestions.map(s => ({field: s.field, target: s.target, kind: s.targetKind}))});
   } catch (error) {modelResult.generation.push({case: test.id, passed: false, elapsedMs: Math.round(performance.now() - start), error: String(error)});}
   await save(); console.log(JSON.stringify({model, ...modelResult.generation.at(-1)}));
  }
  const start = performance.now(), metrics = [];
  try {
   const ids = pairCases.map(p => p.id), properties = Object.fromEntries(ids.map(id => [id, {type: 'boolean'}]));
   const format = {type: 'object', required: ids, additionalProperties: false, properties};
   const response = await provider.chat({messages: [
    {role: 'system', content: 'Prüfe für jeden Vorschlag ausschließlich, ob das Ziel die beschriebene Feldrolle gegenüber der Quelle erfüllt. Richtung beachten. Eine Person ist kein Begriff und keine Gattung. Bloße Erwähnung, Vorlage oder gemeinsames Thema genügt nicht. Wenn keine Relation belegt ist: false. Antworte nur mit dem JSON-Objekt aus den Prüf-IDs und true/false.'},
    {role: 'user', content: JSON.stringify(pairCases.map(({expected, ...pair}) => pair))},
   ], temperature: 0, maxTokens: 256, format, signal: new AbortController().signal, onMetrics: m => metrics.push(m)});
   const actual = JSON.parse(response);
   const judgements = pairCases.map(p => ({id: p.id, expected: p.expected, actual: actual[p.id], correct: actual[p.id] === p.expected}));
   modelResult.pairClassification = {elapsedMs: Math.round(performance.now() - start), metrics, correct: judgements.filter(j => j.correct).length, total: judgements.length,
    falsePositives: judgements.filter(j => !j.expected && j.actual === true).length, judgements};
  } catch (error) {modelResult.pairClassification = {error: String(error), elapsedMs: Math.round(performance.now() - start)};}
  await save(); console.log(JSON.stringify({model, pairClassification: modelResult.pairClassification}));
  await post('generate', {model, keep_alive: 0});
 }
 console.log(JSON.stringify({report: output, summary: report.results.map(r => ({model: r.model, generationChecks: r.generation.filter(g => g.passed).length + '/' + r.generation.length, pairChecks: r.pairClassification.correct + '/' + r.pairClassification.total}))}));
} finally {await rm(folder, {recursive: true, force: true});}
