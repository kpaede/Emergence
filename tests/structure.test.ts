import {describe,expect,it} from 'vitest';
import {SynopsisGraph,synopsisDepths,synopsisFields} from '../src/graph/synopsis';
import {defaultSynopsisDepths,synopsisRelations,type SynopsisEntry} from '../src/graph/synopsis-types';
import {defaults,migrateSettings} from '../src/config';
import {mergeSegments} from '../src/ui/synopsis-geometry';
import {connectionPaths} from '../src/graph/paths';
import {edge,graph} from './fixtures';
import {synopsisFixture} from './synopsis-fixture';
const focus='Dekonstruktion.md';
function flatten(entries:SynopsisEntry[]):SynopsisEntry[]{const all=[...entries];for(let i=0;i<all.length;i++)all.push(...all[i]!.children);return all;}
describe('Kontext: existing metadata adapter',()=>{
 it('adapts all seven groups with complete stress counts, without mutating metadata',()=>{
  const fixture=synopsisFixture(),before=JSON.stringify(fixture),model=new SynopsisGraph(fixture,defaults());
  expect(synopsisRelations.map(r=>model.neighbors(focus,r).length)).toEqual([4,12,8,6,4,48,74]);expect(JSON.stringify(fixture)).toBe(before);
 });
 it('keeps every valid ancestor path and shared ancestors at the selected depth',()=>{
  const model=new SynopsisGraph(synopsisFixture(),defaults());
  const paths=[...model.ancestorPaths(focus,3)].map(p=>p.notes.map(n=>n.title).join(' › '));
  expect(paths).toHaveLength(4);expect(paths).toContain('Wissenschaft › Philosophie › Ästhetik');expect(paths).toContain('Wissenschaft › Philosophie › Sprachphilosophie');
  expect([...model.ancestorPaths(focus,1)].every(p=>p.notes.length===1)).toBe(true);
  expect([...model.ancestorPaths(focus,'all')].some(p=>p.notes[0]!.title==='Theorie')).toBe(true);
 });
 it('retains both paths through a multiple-parent ancestor instead of selecting a tree',()=>{
  const g=synopsisFixture();g.edges.push(edge('Ästhetik.md','Literaturwissenschaft.md'));
  const paths=[...new SynopsisGraph(g,defaults()).ancestorPaths(focus,'all')].filter(p=>p.notes.at(-1)!.title==='Ästhetik');
  expect(paths).toHaveLength(2);expect(new Set(paths.map(p=>p.notes.map(n=>n.id).join()))).toHaveProperty('size',2);
 });
 it('follows only the same relation when expanding nonhierarchical groups',()=>{
  const model=new SynopsisGraph(synopsisFixture(),defaults());
  for(const relation of synopsisRelations.filter(r=>r!=='broader')){
   const one=flatten(model.entries(focus,relation,1)),two=flatten(model.entries(focus,relation,2));
   expect(one.every(e=>e.step===1)).toBe(true);expect(two.some(e=>e.step===2)).toBe(true);
  }
 });
 it('retains the same Markdown note in multiple relation groups',()=>{
  const g=synopsisFixture();g.edges.push(edge(focus,'Hermeneutik.md',{field:'Beispiel'}),edge(focus,'Hermeneutik.md',{field:'Literatur'}));
  const model=new SynopsisGraph(g,defaults());for(const relation of ['friction','examples','literature'] as const)expect(model.neighbors(focus,relation)).toContain('Hermeneutik.md');
 });
 it('normalizes duplicate inverse records without double counting or storing new edges',()=>{
  const g=synopsisFixture();g.edges.push(edge('Philosophie.md','Ästhetik.md',{field:'Unterbau'}));const count=g.edges.length,model=new SynopsisGraph(g,defaults());
  expect(model.neighbors('Ästhetik.md','broader')).toEqual(['Philosophie.md']);expect(g.edges).toHaveLength(count);
 });
 it('uses configured symmetric rules without expanding inferred transitive closures as direct neighbors',()=>{
  const g=synopsisFixture();g.edges.push(edge(focus,'Theorie.md',{field:'Überbau',explicit:false}));const model=new SynopsisGraph(g,defaults());
  expect(model.neighbors('Strukturalismus.md','similar')).toContain(focus);expect(model.neighbors(focus,'broader')).not.toContain('Theorie.md');
 });
 it('stops self references and A↔B cycles at every depth, retaining actual reference notes',()=>{
  const g=synopsisFixture();g.edges.push(edge('Philosophie.md',focus),edge(focus,focus),edge('Zeichen.md',focus,{layer:'obsidian',field:''}));
  const model=new SynopsisGraph(g,defaults()),paths=[...model.ancestorPaths(focus,'all')];
  expect(paths.length).toBeLessThan(20);expect(paths.some(p=>p.cycle)).toBe(true);expect(flatten(model.entries(focus,'links','all')).some(e=>e.note.id===focus)).toBe(false);expect(model.returns('links')).toBeGreaterThan(0);
 });
 it('handles a deep path iteratively, without recursive call-stack growth',()=>{
  const g=graph();for(let i=0;i<1100;i++){const id=`deep${i}.md`;g.nodes.push({...g.nodes[0]!,id,title:id});g.edges.push(edge(i===0?'Quelle.md':`deep${i-1}.md`,id));}
  expect([...new SynopsisGraph(g,defaults()).ancestorPaths('Quelle.md','all')][0]!.notes).toHaveLength(1100);
 });
 it('keeps ZotLit citations without Markdown targets distinct from Markdown note references',()=>{
  const g=synopsisFixture();g.nodes.push({id:'zotlit:work:missing',title:'@missing',aliases:[],tags:[],type:'cited-work',exists:false,mtime:0,size:0,citation:{citekey:'missing',state:'noteless'}});g.edges.push(edge(focus,'zotlit:work:missing',{layer:'zotlit'}));
  const model=new SynopsisGraph(g,defaults());expect(model.neighbors(focus,'literature')).toHaveLength(48);expect(model.citationNotice(focus)).toBe(1);expect(model.notes.has('zotlit:work:missing')).toBe(false);
 });
 it('keeps unresolved Markdown links in their original source context and excludes attachments',()=>{
  const g=synopsisFixture();g.unresolved.push({source:focus,link:'Ordner/Noch nicht da',count:2},{source:focus,link:'Bild.png',count:1});const model=new SynopsisGraph(g,defaults());
  const ref=[...model.notes.values()].find(n=>n.title==='Noch nicht da')!;expect(ref).toMatchObject({linktext:'Ordner/Noch nicht da',sourcePath:focus,exists:false});expect(ref.path).toBeUndefined();expect(model.neighbors(focus,'links')).toContain(ref.id);expect([...model.notes.values()].some(n=>n.title==='Bild.png')).toBe(false);
 });
 it('does not reclassify an unresolved Breadcrumbs frontmatter link as a free body link',()=>{
  const g=synopsisFixture();g.unresolved.push({source:focus,link:'Fehlender Oberbegriff',count:1,occurrences:[{kind:'frontmatter',property:'Überbau.0'}]});
  expect(new SynopsisGraph(g,defaults()).neighbors(focus,'links')).toHaveLength(74);
  g.unresolved[0]!.occurrences!.push({kind:'body',line:12});
  expect(new SynopsisGraph(g,defaults()).neighbors(focus,'links')).toHaveLength(75);
 });
 it('does not invent a semantic assignment for unrelated Breadcrumbs fields',()=>{
  const g=synopsisFixture();g.fields.push('Komponist_in');const model=new SynopsisGraph(g,defaults());expect(model.unassignedFields).toContain('Komponist_in');expect(Object.values(model.fields).flat()).not.toContain('Komponist_in');
 });
 it('preserves legacy field preferences while the spatial side is determined by relation meaning',()=>{
  const g=synopsisFixture(),s=defaults();s.graphStructure={up:'Überbau',down:'Unterbau',left:'Reibung',right:'Ähnlichkeit',depth:2};
  expect(synopsisFields(g,s)).toMatchObject({similar:['Ähnlichkeit'],friction:['Reibung']});expect(synopsisDepths(s)).toMatchObject({broader:2,narrower:1});
 });
 it('defaults and persists seven independent depths through settings migration',()=>{
  const s=defaults();expect(synopsisDepths(s)).toEqual(defaultSynopsisDepths());s.synopsis={depths:{similar:'all',literature:3}};
  expect(synopsisDepths(migrateSettings(s))).toMatchObject({broader:3,narrower:1,similar:'all',friction:1,literature:3});
  expect(()=>migrateSettings({...s,synopsis:{depths:{similar:99}}})).toThrow('Sichttiefe');
 });
});
describe('orthogonal line grammar',()=>{
 it('merges overlapping shared rails once while preserving exact branch endpoints',()=>{
  const merged=mergeSegments([{x1:10,y1:0,x2:10,y2:20},{x1:10,y1:10,x2:10,y2:30},{x1:2,y1:15,x2:10,y2:15},{x1:10,y1:30,x2:10,y2:0}]);
  expect(merged).toHaveLength(2);expect(merged).toContainEqual({x1:10,y1:0,x2:10,y2:30});expect(merged).toContainEqual({x1:2,y1:15,x2:10,y2:15});
 });
});
describe('connection paths retained',()=>{
 it('finds both shortest diamond routes and reverse traversal',()=>{
  const g=graph();g.edges=[edge('Quelle.md','Alt.md'),edge('Quelle.md','Ziel.md'),edge('Isoliert.md','Alt.md'),edge('Ziel.md','Isoliert.md')];
  const result=connectionPaths(g,'Quelle.md','Isoliert.md');expect(result.paths).toHaveLength(2);expect(result.paths.every(p=>p.nodes.length===3)).toBe(true);
 });
});
