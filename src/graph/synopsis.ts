import {fieldRelations, type FieldRelations} from './field-relations';
import {fieldAllowedForSource, isWorkField} from './field-scope';
import type {GraphSnapshot, Settings, LiteratureReference} from '../types';
import {defaultSynopsisDepths, synopsisRelations, type AncestorPath, type SynopsisDepth, type SynopsisEntry, type SynopsisNote, type SynopsisRelation} from './synopsis-types';

export function synopsisDepths(settings: Settings): Record<SynopsisRelation, SynopsisDepth> {
 const depths = defaultSynopsisDepths();
 if (settings.graphStructure?.depth) depths.broader = settings.graphStructure.depth as 1 | 2 | 3;
 return {...depths, ...settings.synopsis?.depths};
}
export function synopsisFields(graph: GraphSnapshot, settings: Settings): Record<SynopsisRelation, string[]> {
 const named = (...names: string[]) => graph.fields.filter(field => names.some(name => name.toLocaleLowerCase() === field.toLocaleLowerCase()));
 const legacy = settings.graphStructure;
 const fields: Record<SynopsisRelation, string[]> = {
  broader: legacy?.up ? [legacy.up] : named('Überbau', 'Überordnung'), narrower: legacy?.down ? [legacy.down] : named('Unterbau', 'Unterordnung'),
  similar: legacy?.right ? [legacy.right] : named('Ähnlichkeit'), friction: legacy?.left ? [legacy.left] : named('Reibung'),
  examples: legacy?.examples ? [legacy.examples] : named('Beispiel', 'Beispiele'), literature: named('Literatur'), links: [],
 };
 for (const relation of synopsisRelations) if (settings.synopsis?.fields?.[relation]) fields[relation] = settings.synopsis.fields[relation].filter(f => graph.fields.includes(f));
 return fields;
}

/** Read-only adaptation of existing facts, without another vault scan or metadata store. */
export class SynopsisGraph {
 readonly notes = new Map<string, SynopsisNote>();
 readonly fields: Record<SynopsisRelation, string[]>;
 readonly adjacency = new Map<SynopsisRelation, Map<string, Set<string>>>();
 readonly unassignedFields: string[];
 readonly fieldRelations: FieldRelations;
 private returnCounts=new Map<SynopsisRelation,number>();
 private virtualCitations = new Map<string, LiteratureReference[]>();
 private references = new Map<string,LiteratureReference>();
 constructor(readonly snapshot: GraphSnapshot, settings: Settings) {
  this.fields = synopsisFields(snapshot, settings);
  for (const relation of synopsisRelations) this.adjacency.set(relation, new Map());
  for (const note of snapshot.nodes) if (!note.citation && (note.id.endsWith('.md') || !note.exists && note.type === 'md')) {
   this.notes.set(note.id, {id: note.id, title: note.title, linktext: note.id, sourcePath: '', path: note.id, exists: note.exists});
  }
  const selected = new Set(Object.values(this.fields).flat()); this.unassignedFields = snapshot.fields.filter(f => !selected.has(f));
  const add = (relation: SynopsisRelation, source: string, target: string) => {
   if (!this.notes.has(source) || !this.notes.has(target)) return;
   const map = this.adjacency.get(relation)!; if (!map.has(source)) map.set(source, new Set()); map.get(source)!.add(target);
  };
  this.fieldRelations=fieldRelations(snapshot);
  const concepts=new Map(snapshot.nodes.map(n=>[n.id,n]));
  const citationPairs=new Set(snapshot.edges.filter(e=>e.layer==='zotlit'&&e.explicit).map(e=>JSON.stringify([e.source,e.target])));
  const derived: [SynopsisRelation, string, string][] = [];
  for (const edge of snapshot.edges) {
   if (!edge.explicit) continue;
   if (edge.layer === 'zotlit') {
    if (this.notes.has(edge.target)){add('literature', edge.source, edge.target);if(edge.reference)this.references.set(edge.target,edge.reference);}
    else {const citation=concepts.get(edge.target)?.citation;if(citation)this.virtualCitations.set(edge.source,[...this.virtualCitations.get(edge.source)??[],citation.reference??{citekey:citation.citekey,state:citation.state,indexedKey:citation.indexedKey}]);}
   }
   if (edge.layer === 'obsidian'&&!citationPairs.has(JSON.stringify([edge.source,edge.target]))) add('links', edge.source, edge.target);
   if (edge.layer !== 'breadcrumbs') continue;
   for (const relation of synopsisRelations) {
    const fields = this.fields[relation];
    if (fields.includes(edge.field)) add(relation, edge.source, edge.target);
   }
   // The explicitly mapped two sides describe one hierarchy, without writing an inverse record.
   if (this.fields.broader.includes(edge.field)) derived.push(['narrower', edge.target, edge.source]);
   if (this.fields.narrower.includes(edge.field)) derived.push(['broader', edge.target, edge.source]);
  }
  for(const relation of synopsisRelations)for(const field of this.fields[relation])for(const [source,targets] of this.fieldRelations.get(field)??[])for(const target of targets)add(relation,source,target);
  for (const [relation, source, target] of derived) add(relation, source, target);
  // Obsidian's unresolved-link index contains real link targets, not invented note paths.
  for (const unresolved of snapshot.unresolved) {
   if (!this.notes.has(unresolved.source)) continue;
   const occurrences=unresolved.occurrences??[];
   if(!occurrences.some(o=>o.kind==='body')&&occurrences.some(o=>o.kind==='frontmatter'&&snapshot.fields.some(f=>o.property===f||o.property?.startsWith(f+'.'))))continue;
   const target = unresolved.link.split('|')[0]!.split('#')[0]!;
   if (!target || /\.(?:pdf|png|jpe?g|svg|gif|webp|mp3|mp4|canvas|excalidraw)$/iu.test(target)) continue;
   const known = this.notes.get(target) ?? this.notes.get(target + '.md');
   const id = known?.id ?? `unresolved:${JSON.stringify([unresolved.source, target])}`;
   if (!known) this.notes.set(id, {id, title: target.split('/').at(-1)!.replace(/\.md$/u, ''), linktext: target, sourcePath: unresolved.source, exists: false});
   add('links', unresolved.source, id);
  }
 }
 neighbors(id: string, relation: SynopsisRelation): string[] {
  return [...this.adjacency.get(relation)?.get(id) ?? []];
 }
 fieldNeighbors(id:string,field:string):SynopsisNote[]{return [...this.fieldRelations.get(field)?.get(id)??[]].flatMap(id=>this.notes.has(id)?[this.notes.get(id)!]:[]);}
 extraFields(source: string): string[] {
  const tags = this.snapshot.nodes.find(node => node.id === source)?.tags ?? [];
  return this.unassignedFields.filter(field => isWorkField(field, this.snapshot)
   ? fieldAllowedForSource(field, tags, this.snapshot) : !!this.fieldRelations.get(field)?.get(source)?.size);
 }
 returns(relation:SynopsisRelation):number{return this.returnCounts.get(relation)??0;}
 reference(id:string):LiteratureReference|undefined{return this.references.get(id);}
 citationReferences(id:string):ReadonlyArray<LiteratureReference>{return this.virtualCitations.get(id)??[];}
 citationNotice(id: string): number {return this.citationReferences(id).length;}
 /** Lazy, iterative branch-local traversal retains every parent path without freezing the UI. */
 *ancestorPaths(focus: string, depth: SynopsisDepth): Generator<AncestorPath> {
  const limit = depth === 'all' ? this.notes.size : depth;
  const stack = this.neighbors(focus, 'broader').reverse().map(id => ({ids: [id], seen: new Set([focus, id]), cycle: id === focus}));
  while (stack.length) {
   const current = stack.pop()!, last = current.ids.at(-1)!;
   const parents = current.cycle || current.ids.length >= limit ? [] : this.neighbors(last, 'broader');
   if (!parents.length) {yield {notes: [...current.ids].reverse().map(id => this.notes.get(id)!), cycle: current.cycle}; continue;}
   let cycleYielded=false;
   for (const id of parents.reverse()) {
    if (current.seen.has(id)) {if(cycleYielded)continue;cycleYielded=true;yield {notes: [...current.ids].reverse().map(n => this.notes.get(n)!), cycle: true}; continue;}
    stack.push({ids: [...current.ids, id], seen: new Set([...current.seen, id]), cycle: false});
   }
  }
 }
 /** Breadth first expansion: shortest relation-step distance; each adjacency expands once. */
 entries(focus: string, relation: SynopsisRelation, depth: SynopsisDepth): SynopsisEntry[] {
  const limit = depth === 'all' ? this.notes.size : depth, expanded = new Set([focus]),distance=new Map([[focus,0]]);let returns=0;
  const entries: SynopsisEntry[] = [], queue = [{id: focus, children: entries, step: 0}];
  for (let index = 0; index < queue.length; index++) {
   const current = queue[index]!; if (current.step >= limit) continue;
   for (const id of this.neighbors(current.id, relation)) {
    if(current.id!==focus&&distance.has(id)&&distance.get(id)!<current.step+1){returns++;continue;}
    const repeated = expanded.has(id), entry: SynopsisEntry = {note: this.notes.get(id)!, children: [], step: current.step + 1, repeated}; current.children.push(entry);
    if (!repeated) {expanded.add(id);distance.set(id,current.step+1); queue.push({id, children: entry.children, step: entry.step});}
   }
  }
  this.returnCounts.set(relation,returns);return entries;
 }
}
