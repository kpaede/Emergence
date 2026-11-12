import type {RelationMember, IRuleNode} from '@argdown/core';
import {nodeKey, edgeKey, type ArgdownModel} from './model';
/** Match native projected edges to the actual relation occurrences in the source. */
export function projectedRelationRules(model: ArgdownModel, key: string): IRuleNode[] {
 const edge = model.edges.find(edge => edgeKey(edge) === key); if (!edge) return [];
 const mapped = (member: RelationMember | undefined, outgoing: boolean): string[] => {
  if (!member) return [];
  if (String(member.type) === 'argument') return ['a:' + member.title];
  if (String(member.type) === 'inference') return ['a:' + ('argumentTitle' in member ? String(member.argumentTitle) : '')];
  if (String(member.type) !== 'equivalence-class') return [];
  const title = member.title ?? '', key = 's:' + title;
  if (model.nodes.some(node => nodeKey(node) === key)) return [key];
  return (model.response.statements?.[title]?.members ?? []).flatMap(statement => String(statement.role) === (outgoing ? 'main-conclusion' : 'premise') && 'argumentTitle' in statement ? ['a:' + String(statement.argumentTitle)] : []);
 };
 const result: IRuleNode[] = [];
 for (const relation of model.response.relations ?? []) {
  const kind = String(relation.relationType), displayedKind = String(edge.relationType);
  const matches = kind === displayedKind || kind === 'entails' && displayedKind === 'support' || ['contrary', 'contradictory'].includes(kind) && displayedKind === 'attack';
  if (!matches) continue;
  const direct = mapped(relation.from, true).includes(nodeKey(edge.from)) && mapped(relation.to, false).includes(nodeKey(edge.to));
  const reverse = ['contrary', 'contradictory'].includes(kind) && mapped(relation.to, true).includes(nodeKey(edge.from)) && mapped(relation.from, false).includes(nodeKey(edge.to));
  if (direct || reverse) result.push(...relation.occurrences);
 }
 return [...new Set(result)];
}
