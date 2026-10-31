import {describe,it,expect} from 'vitest';
import {fieldRelations} from '../src/graph/field-relations';
import {SynopsisGraph} from '../src/graph/synopsis';
import {defaults} from '../src/config';
import {edge,graph} from './fixtures';
describe('Configured Breadcrumbs inverse roles',()=>{
 it('shows Konzept as the inverse of Beispiel in either explicit direction without another metadata record',()=>{
  const g=graph();g.fields.push('Beispiel','Konzept');g.inferenceRules=[{chain:['Beispiel'],field:'Konzept',reversed:true,rounds:10}];
  g.edges=[edge('Quelle.md','Ziel.md',{field:'Konzept'}),edge('Alt.md','Isoliert.md',{field:'Beispiel'})];
  const before=JSON.stringify(g),model=new SynopsisGraph(g,defaults());
  expect(model.neighbors('Ziel.md','examples')).toEqual(['Quelle.md']);expect(model.fieldNeighbors('Isoliert.md','Konzept').map(n=>n.id)).toEqual(['Alt.md']);expect(JSON.stringify(g)).toBe(before);
 });
 it('lists works at all four creator roles and preserves distinct people',()=>{
  const g=graph(),roles=['Komponist_in','Autor_in','Künstler_in','Regisseur_in'],people=['Ziel.md','Alt.md','Ordner/Ziel.md','Isoliert.md'];g.fields.push('Werk',...roles);
  g.inferenceRules=roles.map(field=>({chain:[field],field:'Werk',reversed:true,rounds:10}));g.edges=roles.map((field,i)=>edge('Quelle.md',people[i]!,{field}));
  const model=new SynopsisGraph(g,defaults());
  for(const [i,role]of roles.entries()){expect(model.fieldNeighbors(people[i]!,'Werk').map(n=>n.id)).toEqual(['Quelle.md']);expect(model.fieldNeighbors('Quelle.md',role).map(n=>n.id)).toEqual([people[i]]);}
 });
 it('does not turn a generic Werk link into four unsupported creator roles',()=>{
  const g=graph(),roles=['Komponist_in','Autor_in','Künstler_in','Regisseur_in'];g.fields.push('Werk',...roles);g.inferenceRules=roles.map(field=>({chain:[field],field:'Werk',reversed:true,rounds:10}));g.edges=[edge('Ziel.md','Quelle.md',{field:'Werk'})];
  const relations=fieldRelations(g);for(const role of roles)expect(relations.get(role)?.get('Quelle.md')).toBeUndefined();expect(relations.get('Werk')?.get('Ziel.md')).toEqual(new Set(['Quelle.md']));
 });
 it('keeps explicit list order before derived inverse facts, ignores transitive closure and terminates loops',()=>{
  const g=graph();g.fields.push('Beispiel','Konzept');g.inferenceRules=[{chain:['Beispiel'],field:'Konzept',reversed:true,rounds:10},{chain:['Konzept','Konzept'],field:'Konzept',reversed:false,rounds:100}];
  g.edges=[edge('Alt.md','Quelle.md',{field:'Beispiel'}),edge('Quelle.md','Ziel.md',{field:'Konzept'}),edge('Quelle.md','Quelle.md',{field:'Konzept'})];
  expect([...fieldRelations(g).get('Konzept')!.get('Quelle.md')!]).toEqual(['Ziel.md','Quelle.md','Alt.md']);
 });
});
