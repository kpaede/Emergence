import {build} from 'esbuild';
import {mkdtemp, readFile, writeFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join, resolve} from 'node:path';
import {pathToFileURL} from 'node:url';

// Experimental second stage. Consumes synthetic benchmark outputs only, never a Vault.
const file = resolve('docs/model-comparison.json'), report = JSON.parse(await readFile(file, 'utf8'));
if (!report.syntheticOnly || report.notesRead !== 0) throw Error('Nur synthetische Vergleichsdaten erlaubt.');
const folder = await mkdtemp(join(tmpdir(), 'emergence-verification-'));
try {
 await build({stdin: {contents: `export {OllamaProvider} from './src/llm/provider'; export {ensureBudget} from './src/llm/context'; export {verificationContext,parseVerification} from './src/llm/assignment-verifier'; export * from './tests/model-comparison-fixture';`, resolveDir: process.cwd()}, bundle: true, platform: 'node', format: 'esm', banner: {js: "import {createRequire} from 'node:module'; const require = createRequire(import.meta.url);"}, outfile: join(folder, 'runtime.mjs'), logLevel: 'silent'});
 const {OllamaProvider, ensureBudget, verificationContext, parseVerification, comparisonCases, comparisonSettings, scoreAssignments} = await import(pathToFileURL(join(folder, 'runtime.mjs')).href);
 for (const r of report.results) {
  const settings = comparisonSettings(); settings.model = r.model; settings.timeoutMs = 90000;
  const provider = new OllamaProvider(() => settings); await provider.health();
  for (const generation of r.generation) {
   const test = comparisonCases().find(t => t.id === generation.case); if (!test || generation.status !== 'complete' || !generation.assignments.length) continue;
   const start = performance.now(), metrics = [];
   try {
    const proposals = generation.assignments.map((s, i) => ({id: `P${i + 1}`, field: s.field, target: s.target.replace(/\.md$/u, '')}));
    const context = verificationContext(test.source.replace(/\.md$/u, ''), test.fixture.content, test.fixture.g.rules, proposals);
    ensureBudget(context.messages, settings, context.maxTokens, context.format);
    const kept = parseVerification(await provider.chat({...context, temperature: 0, signal: new AbortController().signal, onMetrics: m => metrics.push(m)}), context.format);
    const assignments = generation.assignments.filter((_, i) => kept.has(`P${i + 1}`));
    const score = scoreAssignments({status: 'complete', suggestions: assignments}, test);
    generation.verification = {elapsedMs: Math.round(performance.now() - start), totalMs: generation.elapsedMs + Math.round(performance.now() - start), metrics, kept: [...kept], assignments, ...score};
   } catch (error) {generation.verification = {error: String(error), elapsedMs: Math.round(performance.now() - start), passed: false};}
   await writeFile(file, JSON.stringify(report, null, 2)+'\n');
   console.log(JSON.stringify({model: r.model, case: generation.case, verification: generation.verification}));
  }
  await fetch('http://127.0.0.1:11434/api/generate', {method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({model:r.model,keep_alive:0}), signal:AbortSignal.timeout(30000)});
 }
} finally {await rm(folder, {recursive:true,force:true});}
