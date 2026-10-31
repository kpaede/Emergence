import {build} from 'esbuild';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {associationInstructions,associationTemplate} from './association-profile.mjs';
const folder=await mkdtemp(join(tmpdir(),'emergence-association-'));
const report={date:new Date().toISOString(),syntheticOnly:true,notesRead:0,notesWritten:0,goal:'Up to four short thinking prompts per Breadcrumbs field present in the source frontmatter; field roles remain editable.',model:'qwen3.5:9b',temperature:0.4,instructions:associationInstructions,results:[]};
try{
 await build({stdin:{contents:`export {OllamaProvider} from './src/llm/provider';export {DocumentAnalyzer} from './src/llm/analyzer';export * from './tests/model-comparison-fixture';`,resolveDir:process.cwd()},bundle:true,platform:'node',format:'esm',banner:{js:"import {createRequire} from 'node:module';const require=createRequire(import.meta.url);"},outfile:join(folder,'runtime.mjs'),logLevel:'silent'});
 const {OllamaProvider,DocumentAnalyzer,comparisonCases,comparisonSettings,scoreAssignments}=await import(pathToFileURL(join(folder,'runtime.mjs')).href);
 const settings=comparisonSettings();settings.timeoutMs=90000;
 const provider=new OllamaProvider(()=>settings);await provider.health();
 for(const test of comparisonCases().filter(c=>['musical-sparse'].includes(c.id))){
  const f=test.fixture; f.p.instructions=associationInstructions;f.p.templates.relations=associationTemplate;f.p.temperature=0.4;f.p.maxTokens=1024;f.options.fields=[...f.fields];f.options.perField=4;f.options.maxSuggestions=f.fields.length*4;f.options.excludeExistingTargets=true;f.g.edges=[{id:"existing-verdi",source:test.source,target:"Verdi, Giuseppe.md",field:"Überbau",layer:"breadcrumbs",explicit:true,provenance:"typed_link",occurrences:[]}];f.p.outputs[0].allowedEdgeTypes=[];
  const start=performance.now();
  try{const result=await new DocumentAnalyzer(provider).analyze(test.source,f.content,f.g,f.p,settings,new AbortController().signal,()=>{},'','',f.options);
   report.results.push({case:test.id,structuralPassed:result.status==='complete'&&f.fields.every(field=>result.suggestions.filter(s=>s.field===field).length<=4)&&result.suggestions.every(s=>s.reason===''&&!s.target.includes('Verdi, Giuseppe')&&!s.target.includes('Tetrade')),strictClassification:scoreAssignments(result,test),status:result.status,elapsedMs:result.elapsedMs,errors:result.errors,assignments:result.suggestions.map(s=>({field:s.field,target:s.target,kind:s.targetKind})),diagnostics:result.diagnostics});
  }catch(error){report.results.push({case:test.id,error:String(error),elapsedMs:Math.round(performance.now()-start)});}
  await writeFile(resolve('docs/association-comparison.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report.results.at(-1)));
 }
 if(report.results.some(r=>!r.structuralPassed))process.exitCode=1;
}finally{await rm(folder,{recursive:true,force:true});}
