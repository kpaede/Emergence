import type {GraphSnapshot} from '../types';
export type FieldRelations = Map<string, Map<string, Set<string>>>;
export function inverseFieldRules(graph: GraphSnapshot): {from: string; to: string}[] {
 const pairs = new Map<string, Set<string>>(), rules: {from:string;to:string}[] = [];
 const rule = (from:string,to:string) => {if(!graph.fields.includes(from)||!graph.fields.includes(to))return;rules.push({from,to});for(const [a,b] of [[from,to],[to,from]]){if(!pairs.has(a!))pairs.set(a!,new Set());pairs.get(a!)!.add(b!);}};
 for(const r of graph.inferenceRules??[])if(r.reversed&&r.chain.length===1)rule(r.chain[0]!,r.field);
 for(const [field,r] of Object.entries(graph.rules)){if(r.inverse)rule(field,r.inverse);if(r.symmetric)rule(field,field);}
 const direct=[...rules];
 // A generic inverse shared by several roles (e.g. Werk) cannot identify a creator's role.
 for(const r of direct)if(pairs.get(r.to)?.size===1)rules.push({from:r.to,to:r.from});
 return rules;
}
/** One-hop inverse facts only. Never feed derived edges back through the rules. */
export function fieldRelations(graph: GraphSnapshot): FieldRelations {
 const maps: FieldRelations = new Map(graph.fields.map(field=>[field,new Map<string,Set<string>>() ]));
 const rules = inverseFieldRules(graph);
 const add=(field:string,source:string,target:string)=>{const map=maps.get(field);if(!map)return;if(!map.has(source))map.set(source,new Set());map.get(source)!.add(target);};
 const edges=graph.edges.filter(e=>e.explicit&&e.layer==='breadcrumbs');
 for(const edge of edges)add(edge.field,edge.source,edge.target);
 for(const edge of edges)for(const r of rules)if(r.from===edge.field)add(r.to,edge.target,edge.source);
 return maps;
}
