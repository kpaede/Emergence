import {build} from 'esbuild';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const folder=await mkdtemp(join(tmpdir(),'emergence-sampling-'));
const report={date:new Date().toISOString(),syntheticOnly:true,notesRead:0,notesWritten:0,model:'qwen3.5:9b',source:'https://huggingface.co/Qwen/Qwen3.5-9B',results:[]};
const file=resolve('docs/sampling-comparison.json');
try{
 await build({stdin:{contents:`export {OllamaProvider} from './src/llm/provider';export {DocumentAnalyzer} from './src/llm/analyzer';export * from './tests/model-comparison-fixture';`,resolveDir:process.cwd()},bundle:true,platform:'node',format:'esm',banner:{js:"import {createRequire} from 'node:module';const require=createRequire(import.meta.url);"},outfile:join(folder,'runtime.mjs'),logLevel:'silent'});
 const {OllamaProvider,DocumentAnalyzer,comparisonCases,comparisonSettings,scoreAssignments}=await import(pathToFileURL(join(folder,'runtime.mjs')).href);
 const settings=comparisonSettings();settings.timeoutMs=90000;
 for(const presence of [0,1.5])for(const seed of [41,42]){
  const transport=(url,init)=>{if(typeof url==='string'&&url.endsWith('/api/chat')){const body=JSON.parse(init.body);body.options={...body.options,temperature:0.7,top_p:0.8,top_k:20,min_p:0,presence_penalty:presence,seed};init={...init,body:JSON.stringify(body)};}return fetch(url,init);};
  const provider=new OllamaProvider(()=>settings,transport);
  for(const test of comparisonCases().filter(c=>c.id.startsWith('musical-'))){
   const f=test.fixture,start=performance.now();
   try{const result=await new DocumentAnalyzer(provider).analyze(test.source,f.content,f.g,f.p,settings,new AbortController().signal,()=>{},f.options);
    report.results.push({temperature:0.7,presencePenalty:presence,seed,case:test.id,...scoreAssignments(result,test),elapsedMs:result.elapsedMs,errors:result.errors,assignments:result.suggestions.map(s=>({field:s.field,target:s.target})),diagnostics:result.diagnostics});
   }catch(error){report.results.push({temperature:0.7,presencePenalty:presence,seed,case:test.id,passed:false,error:String(error),elapsedMs:Math.round(performance.now()-start)});}
   await writeFile(file,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report.results.at(-1)));
  }
 }
 await fetch('http://127.0.0.1:11434/api/generate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({model:settings.model,keep_alive:0}),signal:AbortSignal.timeout(30000)});
}finally{await rm(folder,{recursive:true,force:true});}
