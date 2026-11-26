import {afterEach,describe,it,expect,vi} from 'vitest';
import {companionFixture} from './helpers/companion-service';
import {validReaderDrop} from '../src/companion/reader-model';
import {applyThought,thoughts} from '../src/companion/thoughts';
import {dragOperations,type CompanionDrag} from '../src/companion/drag';
vi.mock('obsidian',async importOriginal=>({...await importOriginal<Record<string,unknown>>(),Component:(await import('./helpers/reader-host')).TestComponent}));
afterEach(()=>{vi.unstubAllGlobals();vi.restoreAllMocks();});

describe('read-only drag target validation',()=>{
 it('agrees with committed move validation for every source, target, section and placement without cloning the document',async()=>{
  const f=companionFixture(),path=await f.service.create('Paper.md'),doc=await f.service.read(path),a=doc.sections[0]!.id,b=doc.sections[1]!.id;
  await f.service.executeMany(path,[{kind:'add',section:a,id:'one',placement:'last',text:'One'},{kind:'add',section:a,id:'two',target:'one',placement:'last',text:'Two'},{kind:'add',section:a,id:'three',target:'two',placement:'last',text:'Three'},{kind:'add',section:a,id:'four',placement:'last',text:'Four'},{kind:'add',section:b,id:'other',placement:'last',text:'Other'}]);const current=await f.service.read(path),nodes=current.sections.flatMap(thoughts),before=JSON.stringify(current);
  for(const node of nodes)for(const section of [a,b])for(const target of [undefined,...nodes.map(n=>n.id)])for(const placement of ['before','after','first','last'] as const){const data:CompanionDrag={path,id:node.id,section:node.section,parent:node.parent};let accepted=true;try{applyThought(current,dragOperations(data,section,target,placement)[0]!);}catch{accepted=false;}expect(validReaderDrop(current,path,data,section,target,placement),JSON.stringify({node:node.id,section,target,placement})).toBe(accepted);}
  expect(JSON.stringify(current)).toBe(before);const clone=vi.fn(()=>{throw Error('Hover must not clone content');});vi.stubGlobal('structuredClone',clone);expect(validReaderDrop(current,path,{path,id:'four',section:a},a,'two','last')).toBe(true);expect(clone).not.toHaveBeenCalled();f.service.unload();
 });
 it('rejects stale payloads, missing files, nested selections and targets inside a selected subtree',async()=>{
  const f=companionFixture(),path=await f.service.create('Paper.md'),a=(await f.service.read(path)).sections[0]!.id;await f.service.executeMany(path,[{kind:'add',section:a,id:'one',placement:'last',text:'One'},{kind:'add',section:a,id:'child',target:'one',placement:'last',text:'Child'},{kind:'add',section:a,id:'other',placement:'last',text:'Other'}]);const doc=await f.service.read(path),data:CompanionDrag={path,id:'one',section:a};expect(validReaderDrop(doc,path,{...data,parent:'stale'},a,'other','last')).toBe(false);expect(validReaderDrop(doc,path,{...data,nodes:[{id:'one',section:a},{id:'child',section:a,parent:'one'}]},a,'other','last')).toBe(false);expect(validReaderDrop(doc,path,data,a,'child','last')).toBe(false);const missing={...doc,unavailableFiles:{[a]:{path:'missing.md',reason:'missing' as const,message:'missing',reference:''}}};expect(validReaderDrop(missing,path,data,a,'other','last')).toBe(false);f.service.unload();
 });
});
