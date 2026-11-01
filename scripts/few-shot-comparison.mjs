import {build} from 'esbuild';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const models=process.argv.slice(2).length?process.argv.slice(2):['qwen3.5:9b','gemma4:12b'];
const folder=await mkdtemp(join(tmpdir(),'emergence-few-shot-'));
const examples=[
 {title:'Zellmembran',text:'Die Zellmembran ist ein Gegenstand der Zellbiologie.',answer:[{field:'Überbau',target:'Zellbiologie',evidence:'T'}]},
 {title:'Zellbiologie',text:'Die Zellbiologie untersucht unter anderem die Zellmembran.',answer:[{field:'Unterbau',target:'Zellmembran',evidence:'T'}]},
 {title:'Die Zauberflöte',text:'Die Zauberflöte ist ein musikalisches Werk, komponiert von Wolfgang Amadeus Mozart.',answer:[{field:'Komponist_in',target:'Mozart, Wolfgang Amadeus',evidence:'T'}]},
 {title:'Leitmotiv',text:'Leitmotiv ist ein Begriff für eine musikalische Technik. Richard Wagner verwendete diese Technik. Diese Erwähnung macht Wagner nicht zum Komponisten eines Begriffs.',answer:[]},
];
const report={date:new Date().toISOString(),syntheticOnly:true,notesRead:0,notesWritten:0,examples,architecture:'existing complete-catalogue pipeline plus explicit positive/negative field examples',results:[]};
const file=resolve('docs/few-shot-comparison.json');
try{
 await build({stdin:{contents:`export {OllamaProvider} from './src/llm/provider';export {DocumentAnalyzer} from './src/llm/analyzer';export * from './tests/model-comparison-fixture';`,resolveDir:process.cwd()},bundle:true,platform:'node',format:'esm',banner:{js:"import {createRequire} from 'node:module';const require=createRequire(import.meta.url);"},outfile:join(folder,'runtime.mjs'),logLevel:'silent'});
 const {OllamaProvider,DocumentAnalyzer,comparisonCases,comparisonSettings,scoreAssignments}=await import(pathToFileURL(join(folder,'runtime.mjs')).href);
 for(const model of models){
  const settings=comparisonSettings();settings.model=model;settings.timeoutMs=90000;
  const transport=(url,init)=>{
   if(typeof url==='string'&&url.endsWith('/api/chat')){
    const body=JSON.parse(init.body),demonstrations=examples.flatMap(e=>[{role:'user',content:JSON.stringify({example:true,source:e.title,text:e.text,task:'Nur passende Feld-Ziel-Zuordnungen. Keine Personenzuordnung für einen abstrakten Begriff. Nicht genannte Gegenpositionen und bloß erwähnte Namen nicht als neue Relationen ausgeben.'})},{role:'assistant',content:JSON.stringify({suggestions:e.answer})}]);
    body.messages=[body.messages[0],...demonstrations,...body.messages.slice(1)];init={...init,body:JSON.stringify(body)};
   }return fetch(url,init);
  };
  const provider=new OllamaProvider(()=>settings,transport);await provider.health();const row={model,generation:[]};report.results.push(row);
  for(const test of comparisonCases()){
   const f=test.fixture,start=performance.now();
   try{const result=await new DocumentAnalyzer(provider).analyze(test.source,f.content,f.g,f.p,settings,new AbortController().signal,()=>{},f.options);
    row.generation.push({case:test.id,...scoreAssignments(result,test),elapsedMs:result.elapsedMs,errors:result.errors,assignments:result.suggestions.map(s=>({field:s.field,target:s.target,kind:s.targetKind})),diagnostics:result.diagnostics});
   }catch(error){row.generation.push({case:test.id,passed:false,error:String(error),elapsedMs:Math.round(performance.now()-start)});}
   await writeFile(file,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({model,...row.generation.at(-1)}));
  }
  await fetch('http://127.0.0.1:11434/api/generate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({model,keep_alive:0}),signal:AbortSignal.timeout(30000)});
 }
}finally{await rm(folder,{recursive:true,force:true});}
