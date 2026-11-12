import {t as tr} from '../i18n';
import type {IRuleNode} from './model';
import {span, type ArgdownModel} from './model';
import {assertRelation, type RelationKind} from './relations';
import type {Edit} from './actions';
export interface LogicalLink {id: string; target: string; kind: RelationKind; reverse: boolean; original?: {range: {from: number; to: number}; operator: {from: number; to: number}; kind: RelationKind; reverse: boolean}}
export function readLogicalLinks(model: ArgdownModel, statement: IRuleNode): LogicalLink[] {
 const relations = statement.children?.find((r): r is IRuleNode => 'children' in r && String(r.name) === 'relations'); const links: LogicalLink[] = [];
 for (const rule of relations?.children ?? []) {
  if (!('children' in rule) || !rule.relation) continue;
  const child = rule.children?.find((r): r is IRuleNode => 'children' in r && ['statement','argument'].includes(String(r.name)));
  // Preserve inline definitions, child subtrees and data instead of silently discarding them.
  if (!child || child.children?.some(r => 'children' in r && ['statementDefinition','statementContent','relations'].includes(String(r.name)) || 'tokenType' in r && /Definition|Data/u.test(r.tokenType.name))) continue;
  const token = rule.children?.find(r => 'tokenType' in r), operator = token ? span(token) : undefined, range = span(rule); if (!operator || !range) continue;
  const raw = model.source.slice(operator.from, operator.to).trim(), reverse = raw.startsWith('<') || !raw.endsWith('>') && raw !== '><';
  const other = reverse ? rule.relation.from : rule.relation.to; if (!other?.title || !['argument','equivalence-class'].includes(String(other.type))) continue;
  const kind: RelationKind = String(rule.relation.relationType) === 'entails' ? 'support' : String(rule.relation.relationType) === 'contrary' ? 'attack' : rule.relation.relationType as RelationKind;
  links.push({id: 'link-' + range.from, target: (String(other.type) === 'argument' ? 'a:' : 's:') + other.title, kind, reverse, original: {range, operator, kind, reverse}});
 }
 return links;
}
export function linkSymbols(link: LogicalLink): string {const symbol = {support: '+', attack: '-', undercut: '_', contradictory: '><'}[link.kind]; return link.kind === 'contradictory' ? symbol : link.reverse ? '<' + symbol : symbol + '>';}
export function validateLogicalLinks(links: LogicalLink[], conclusion = false): void {for (const link of links) {if (!/^[as]:/u.test(link.target) || !link.target.slice(2) || /[\]<>\r\n[]/u.test(link.target.slice(2))) throw new Error(tr("argdown.select_a_valid_target_for_this_relation")); const other = link.target.startsWith('a:') ? 'argument' : 'statement'; if (!(conclusion && link.reverse && link.kind === 'undercut')) assertRelation(link.reverse ? other : 'statement', link.reverse ? 'statement' : other, link.kind);}}
export function logicalLinkEdits(model: ArgdownModel, original: LogicalLink[], next: LogicalLink[]): Edit[] {
 const edits: Edit[] = [];
 for (const old of original) {
  if (!old.original) continue; const link = next.find(l => l.id === old.id);
  if (!link) {edits.push({...old.original.range, insert: ''}); continue;}
  if (link.target !== old.target) throw new Error(tr("argdown.remove_this_relation_and_add_it_again_with_a_new_target"));
  if (link.kind !== old.kind || link.reverse !== old.reverse) {const raw = model.source.slice(old.original.operator.from, old.original.operator.to); edits.push({...old.original.operator, insert: (raw.match(/^\s*/u)?.[0] ?? '') + linkSymbols(link)});}
 }
 return edits;
}
export function appendLogicalLinks(body: string, links: LogicalLink[], indent = '  '): string {
 const extra = links.filter(link => !link.original).map(link => indent + linkSymbols(link) + ' ' + (link.target.startsWith('a:') ? '<' + link.target.slice(2) + '>' : '[' + link.target.slice(2) + ']'));
 return body.trimEnd() + (extra.length ? '\n' + extra.join('\n') : '');
}
