import {build} from 'esbuild';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const models=process.argv.slice(2).length?process.argv.slice(2):['qwen3.5:9b','gemma4:12b'];
const folder=await mkdtemp(join(tmpdir(),'emergence-target-context-'));
// Synthetic first sentences for existing targets. Desired missing parents are NOT added to the registry.
const summaries={
 'Tetrade':'Eine Tetrade ist eine Vierergruppe, etwa in einer begrifflichen oder mathematischen Gliederung.',
 'Prima la musica e poi le parole':'Prima la musica e poi le parole ist eine Oper von Antonio Salieri.',
 'Das kurze Leben':'Das kurze Leben ist eine Oper von Manuel de Falla.',
 'Verdi, Giuseppe':'Giuseppe Verdi war Komponist und schuf zahlreiche Opern.',
 'Kontrapunkt':'Kontrapunkt bezeichnet die Verbindung selbständiger musikalischer Stimmen.',
 'Motiv':'Ein musikalisches Motiv ist eine kleine prägnante melodische oder rhythmische Gestalt.',
 'Klangfarbe':'Klangfarbe bezeichnet die charakteristische Qualität eines Klangs.',
 'Rhythmus':'Rhythmus bezeichnet die zeitliche Gliederung musikalischer Ereignisse.',
 'Sprechakt':'Ein Sprechakt ist in der Sprachwissenschaft eine Äußerung als sprachliche Handlung.',
 'Narration':'Narration bezeichnet das Erzählen und die Vermittlung von Ereignissen in einer Erzählung.',
 'Philosophie':'Philosophie untersucht grundlegende Fragen nach Sein, Wissen und Handeln.',
 'Pflanzenphysiologie':'Pflanzenphysiologie untersucht die Lebensvorgänge von Pflanzen, darunter Photosynthese.',
 'Sprachwissenschaft':'Sprachwissenschaft untersucht Sprache, ihren Aufbau und ihre Verwendung.',
};
const report={date:new Date().toISOString(),syntheticOnly:true,notesRead:0,notesWritten:0,summaries,architecture:'same complete catalogue with short factual target descriptions',results:[]};
const file=resolve('docs/target-context-comparison.json');
try{
 await build({stdin:{contents:`export {OllamaProvider} from './src/llm/provider';export {DocumentAnalyzer} from './src/llm/analyzer';export * from './tests/model-comparison-fixture';`,resolveDir:process.cwd()},bundle:true,platform:'node',format:'esm',banner:{js:"import {createRequire} from 'node:module';const require=createRequire(import.meta.url);"},outfile:join(folder,'runtime.mjs'),logLevel:'silent'});
 const {OllamaProvider,DocumentAnalyzer,comparisonCases,comparisonSettings,scoreAssignments}=await import(pathToFileURL(join(folder,'runtime.mjs')).href);
 for(const model of models){
  const settings=comparisonSettings();settings.model=model;settings.timeoutMs=90000;
  const transport=(url,init)=>{
   if(typeof url==='string'&&url.endsWith('/api/chat')){
    const body=JSON.parse(init.body),message=body.messages[1],start=message.content.indexOf('{'),data=JSON.parse(message.content.slice(start));
    data.data.titles=data.data.titles.map(t=>{const title=typeof t==='string'?t:t.title;return summaries[title]?{title,description:summaries[title]}:t;});
    message.content=message.content.slice(0,start)+JSON.stringify(data);init={...init,body:JSON.stringify(body)};
   }return fetch(url,init);
  };
  const provider=new OllamaProvider(()=>settings,transport);await provider.health();const row={model,generation:[]};report.results.push(row);
  for(const test of comparisonCases().filter(t=>['musical-sparse','musical-grounded','work-all-eleven-fields'].includes(t.id))){
   const f=test.fixture,start=performance.now();
   try{const result=await new DocumentAnalyzer(provider).analyze(test.source,f.content,f.g,f.p,settings,new AbortController().signal,()=>{},f.options);
    row.generation.push({case:test.id,...scoreAssignments(result,test),elapsedMs:result.elapsedMs,errors:result.errors,assignments:result.suggestions.map(s=>({field:s.field,target:s.target,kind:s.targetKind})),diagnostics:result.diagnostics});
   }catch(error){row.generation.push({case:test.id,passed:false,error:String(error),elapsedMs:Math.round(performance.now()-start)});}
   await writeFile(file,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({model,...row.generation.at(-1)}));
  }
  await fetch('http://127.0.0.1:11434/api/generate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({model,keep_alive:0}),signal:AbortSignal.timeout(30000)});
 }
}finally{await rm(folder,{recursive:true,force:true});}
