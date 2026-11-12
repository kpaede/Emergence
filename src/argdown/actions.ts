import {t as tr} from '../i18n';
import type {ITokenNode} from '@argdown/core';
import {parseDocument} from 'yaml';
import type {ArgdownEngine} from './engine';
import {edgeKey, isGroup, nodeKey, span, leaves, type ArgdownModel, type IAstNode, type IMapNode, type IRuleNode, type SourceSpan} from './model';

import {applyEdits, dataDocument, type Edit} from './source-edits';
import {projectedRelationRules} from './projected-relations';
import {relationUnder} from './source-layout';
import {pinVisibleSections, assertHeadingGroups, sectionColor} from './sections';
import {assertRelation, kindOf, type RelationKind} from './relations';
export type {RelationKind} from './relations';
const matchesKind = (actual: string, kind: RelationKind): boolean => actual === kind || kind === 'support' && actual === 'entails' || kind === 'attack' && actual === 'contrary';
const symbols: Record<RelationKind, string> = {support: '+>', attack: '->', undercut: '_>', contradictory: '><'};
const isRule = (node: IAstNode): node is IRuleNode => 'children' in node;
const ref = (node: IMapNode): string => String(node.type) === 'argument-map-node' ? '<' + node.title + '>' : '[' + node.title + ']';
const append = (source: string, text: string): string => source.trimEnd() + '\n\n' + text + '\n';
export {applyEdits, type Edit} from './source-edits';
const parseForView = (engine: ArgdownEngine, model: ArgdownModel, source: string): ArgdownModel => model.response.emergenceDerivation ? engine.project(source, model.response.emergenceDerivation?.focus) : engine.parse(source);
function lookup(model: ArgdownModel, key: string): IMapNode {const node = model.nodes.find(n => nodeKey(n) === key); if (!node) throw new Error(tr("argdown.the_selected_node_no_longer_exists")); return node;}
function nodeRules(model: ArgdownModel, node: IMapNode): IRuleNode[] {
 return model.rules.filter(rule => String(node.type) === 'argument-map-node' ? String(rule.name) === 'argument' && rule.argument?.title === node.title : String(rule.name) === 'statement' && rule.statement?.title === node.title);
}
function definition(model: ArgdownModel, node: IMapNode): IRuleNode | undefined {
 const canonical = model.canonical?.get(nodeKey(node)), rules = nodeRules(model, node);
 for (const rule of canonical ? [...rules.filter(rule => rule.statement === canonical), ...rules.filter(rule => rule.statement !== canonical)] : rules) {
  if (String(node.type) === 'argument-map-node' && rule.children?.some(child => !isRule(child) && 'tokenType' in child && String(child.tokenType.name) === 'ArgumentDefinition')) return rule;
  const inner = rule.children?.find(child => isRule(child) && String(child.name) === 'statementDefinition'); if (inner && isRule(inner)) return inner;
 }
 return undefined;
}
export function rawNodeText(model: ArgdownModel, key: string): string {
 const node = lookup(model, key), rule = definition(model, node), content = rule?.children?.find(child => isRule(child) && String(child.name) === 'statementContent');
 const range = content ? span(content) : undefined;
 return range ? model.source.slice(range.from, range.to).trimEnd() : node.labelText ?? '';
}
function semanticNodes(model: ArgdownModel): string[] {model = model.response.emergenceDerivation?.base ?? model; return [...Object.entries(model.response.statements ?? {}).map(([title, node]) => JSON.stringify(['s', title, node.members.filter(m => m.text?.trim()).map(m => [m.text?.trimEnd(), m.data as unknown])])), ...Object.entries(model.response.arguments ?? {}).map(([title, node]) => JSON.stringify(['a', title, node.members.filter(m => m.text?.trim()).map(m => m.text?.trimEnd()), node.pcs.map(p => [p.title, p.text])]))].sort();}
function relations(model: ArgdownModel): string[] {model = model.response.emergenceDerivation?.base ?? model; return (model.response.relations ?? []).map(r => JSON.stringify([r.from?.type, r.from?.title, r.to?.type, r.to?.title, r.relationType])).sort();}
function assertRelations(before: ArgdownModel, after: ArgdownModel): void {if (JSON.stringify(relations(before)) !== JSON.stringify(relations(after))) throw new Error(tr("argdown.this_change_would_alter_existing_relations_edit_the_source_instead"));}
function assertNodes(before: ArgdownModel, after: ArgdownModel): void {if (JSON.stringify(semanticNodes(before)) !== JSON.stringify(semanticNodes(after))) throw new Error(tr("argdown.this_change_would_alter_existing_statements_or_arguments_edit_the_source"));}
export function addNode(source: string, model: ArgdownModel, kind: 'statement' | 'argument', text?: string): {source: string; key: string} {
 const taken = new Set([...Object.keys(model.response.statements ?? {}), ...Object.keys(model.response.arguments ?? {})]);
 let index = 1; const base = kind === 'statement' ? tr("argdown.statement") : tr("argdown.argument"); while (taken.has(base + index)) index++;
 const title = base + index, key = (kind === 'statement' ? 's:' : 'a:') + title;
 const content = (kind === 'statement' ? '[' + title + ']' : '<' + title + '>') + ': ' + (text ?? (kind === 'statement' ? tr("argdown.new_statement") : tr("argdown.new_argument")));
 const firstHeading = model.rules.find(r => String(r.name) === 'heading'), at = firstHeading ? span(firstHeading)?.from : undefined;
 return {source: at === undefined ? append(source, content) : applyEdits(source, [{from: at, to: at, insert: content + '\n\n'}]), key};
}
export function connectNodes(engine: ArgdownEngine, model: ArgdownModel, fromKey: string, toKey: string, kind: RelationKind): string {
 const from = lookup(model, fromKey), to = lookup(model, toKey);
 if (String(from.type) === 'group-map-node' || String(to.type) === 'group-map-node') throw new Error(tr("argdown.argdown_relations_connect_statements_or_arguments_sections_only_organize_them"));
 if (fromKey === toKey) throw new Error(tr("argdown.select_another_target_node"));
 assertRelation(kindOf(from), kindOf(to), kind);
 if (model.edges.some(edge => nodeKey(edge.from) === fromKey && nodeKey(edge.to) === toKey && matchesKind(edge.relationType, kind))) return model.source;
 const child = relationUnder(model, toKey, ref(from), kind === 'contradictory' ? '><' : symbols[kind][0]!);
 const fallback = (): string => append(model.source, ref(from) + '\n  ' + symbols[kind] + ' ' + ref(to));
 const verify = (candidate: string): string => {
  const next = parseForView(engine, model, candidate); assertNodes(model, next); assertMembership(model, next);
  if (!next.edges.some(edge => nodeKey(edge.from) === fromKey && nodeKey(edge.to) === toKey && matchesKind(edge.relationType, kind))) throw new Error(tr("argdown.the_existing_argdown_reconstruction_renders_this_relation_differently_edit_the_source"));
  return candidate;
 };
 let candidate: string;
 try {candidate = verify(child ?? fallback());} catch {candidate = verify(fallback());}
 return candidate;
}
export function editNode(engine: ArgdownEngine, model: ArgdownModel, key: string, text: string): string {
 const node = lookup(model, key); if (String(node.type) === 'group-map-node') throw new Error(tr("argdown.edit_the_section_title_in_the_source"));
 const rule = definition(model, node), content = rule?.children?.find(child => isRule(child) && String(child.name) === 'statementContent'), range = content ? span(content) : undefined;
 if (!text.trim()) throw new Error(tr("argdown.enter_some_text"));
 let candidate: string;
 if (range) {const old = model.source.slice(range.from, range.to), suffix = old.match(/\s*$/u)?.[0] ?? ''; candidate = applyEdits(model.source, [{...range, insert: text.trim() + suffix}]);}
 else candidate = append(model.source, ref(node) + ': ' + text.trim());
 const next = parseForView(engine, model, candidate); assertRelations(model, next);
 const remaining = (m: ArgdownModel): string[] => semanticNodes(m).filter(s => !s.startsWith(JSON.stringify([key[0], node.title]).slice(0, -1) + ','));
 if (JSON.stringify(remaining(model)) !== JSON.stringify(remaining(next)) || !next.nodes.some(n => nodeKey(n) === key)) throw new Error(tr("argdown.this_text_would_alter_other_nodes_check_argdown_special_characters_in"));
 return candidate;
}
function firstToken(rule: IRuleNode): IAstNode | undefined {return rule.children?.find(child => !isRule(child) && 'image' in child && child.image.trim());}
function relationRules(model: ArgdownModel, key: string): IRuleNode[] {
 if (model.response.emergenceDerivation) {const rules = projectedRelationRules(model, key); if (!rules.length) throw new Error(tr("argdown.this_arrow_belongs_to_the_reconstruction_edit_its_premises_or_inferential")); return rules;}
 const edge = model.edges.find(edge => edgeKey(edge) === key); if (!edge) throw new Error(tr("argdown.the_relation_no_longer_exists"));
 const sourceArgument = model.response.arguments?.[edge.from.title ?? ''], targetArgument = model.response.arguments?.[edge.to.title ?? ''];
 const sourceStatement = sourceArgument?.pcs[sourceArgument.pcs.length - 1]?.title;
 const targetStatements = new Set(targetArgument?.pcs.filter(s => String(s.role) !== 'main-conclusion').map(s => s.title) ?? []);
 const sourceMatches = (member: {type: string; title?: string} | undefined): boolean => !!member && (String(edge.from.type) === 'argument-map-node' ? member.type === 'argument' && member.title === edge.from.title || member.type === 'equivalence-class' && member.title === sourceStatement : member.type === 'equivalence-class' && member.title === edge.from.title);
 const targetMatches = (member: {type: string; title?: string; argumentTitle?: string} | undefined): boolean => !!member && (String(edge.to.type) === 'argument-map-node' ? member.type === 'argument' && member.title === edge.to.title || member.type === 'equivalence-class' && targetStatements.has(member.title) || member.type === 'inference' && member.argumentTitle === edge.to.title : member.type === 'equivalence-class' && member.title === edge.to.title);
 const matches = (model.response.relations ?? []).filter(r => sourceMatches(r.from) && targetMatches(r.to) && (r.relationType === edge.relationType || matchesKind(r.relationType, edge.relationType as RelationKind)) && r.occurrences.length);
 if (!matches.length) throw new Error(tr("argdown.this_relation_derives_from_shared_premises_and_conclusions_open_edit_reconstruction"));
 return matches.flatMap(r => r.occurrences);
}
export function changeRelation(engine: ArgdownEngine, model: ArgdownModel, key: string, kind: RelationKind): string {
 const edge = model.edges.find(e => edgeKey(e) === key); if (edge) assertRelation(kindOf(edge.from), kindOf(edge.to), kind);
 const edits = relationRules(model, key).map(rule => {
  const token = firstToken(rule), range = token ? span(token) : undefined; if (!range) throw new Error(tr("argdown.this_relation_can_only_be_changed_in_the_source"));
  const raw = model.source.slice(range.from, range.to), prefix = raw.match(/^\s*/u)?.[0] ?? '', old = raw.trim(), incoming = !old.endsWith('>') || old.startsWith('<');
  const symbol = kind === 'contradictory' ? '><' : incoming ? '<' + symbols[kind][0] : symbols[kind];
  return {...range, insert: prefix + symbol};
 });
 const candidate = applyEdits(model.source, edits), next = parseForView(engine, model, candidate); assertNodes(model, next);
 const before = model.edges.filter(e => edgeKey(e) !== key).map(edgeKey).sort(), matching = next.edges.filter(e => edge && matchesKind(e.relationType, kind) && (nodeKey(e.from) === nodeKey(edge.from) && nodeKey(e.to) === nodeKey(edge.to) || ['contradictory', 'contrary'].includes(String(e.relationType)) && nodeKey(e.to) === nodeKey(edge.from) && nodeKey(e.from) === nodeKey(edge.to))), expected = new Set([...before, ...matching.map(edgeKey)]);
 const actual = next.edges.map(edgeKey); if (!matching.length || actual.some(k => !expected.has(k)) || before.some(k => !actual.includes(k))) throw new Error(tr("argdown.argdown_would_reinterpret_other_relations_after_this_change_edit_the_source"));
 return candidate;
}
/** Reverse only the explicit relation; reject implicit or shared changes atomically. */
export function reverseRelation(engine: ArgdownEngine, model: ArgdownModel, key: string): string {
 const edge = model.edges.find(item => edgeKey(item) === key); if (!edge) throw new Error(tr("argdown.the_connection_no_longer_exists"));
 if (String(edge.relationType) === 'contradictory') return model.source;
 const actual = String(edge.relationType), kind: RelationKind = actual === 'entails' ? 'support' : actual === 'contrary' ? 'attack' : actual as RelationKind;
 assertRelation(kindOf(edge.to), kindOf(edge.from), kind);
 const edits = relationRules(model, key).map(rule => {
  const token = firstToken(rule), range = token ? span(token) : undefined; if (!range) throw new Error(tr("argdown.reverse_this_connection_in_the_source"));
  const raw = model.source.slice(range.from, range.to), incoming = !raw.trim().endsWith('>') || raw.trim().startsWith('<');
  return {...range, insert: (raw.match(/^\s*/u)?.[0] ?? '') + (incoming ? symbols[kind] : '<' + symbols[kind][0])};
 });
 const candidate = applyEdits(model.source, edits), next = parseForView(engine, model, candidate); assertNodes(model, next);
 const reversed = next.edges.filter(item => nodeKey(item.from) === nodeKey(edge.to) && nodeKey(item.to) === nodeKey(edge.from) && matchesKind(item.relationType, kind));
 const before = model.edges.filter(item => edgeKey(item) !== key).map(edgeKey), actualEdges = next.edges.map(edgeKey), expected = new Set([...before, ...reversed.map(edgeKey)]);
 if (!reversed.length || actualEdges.some(value => !expected.has(value)) || before.some(value => !actualEdges.includes(value))) throw new Error(tr("argdown.this_connection_derives_from_the_argument_structure_open_edit_reconstruction"));
 return candidate;
}
/** Cutting a relation promotes its whole child subtree, retaining definitions and inner relations. */
function promote(source: string, rule: IRuleNode): {range: SourceSpan; text: string} {
 const token = firstToken(rule), range = span(rule), tokenSpan = token ? span(token) : undefined; if (!range || !tokenSpan) throw new Error(tr("argdown.the_source_range_is_ambiguous"));
 const indent = source.slice(tokenSpan.from, tokenSpan.to).match(/^\s*/u)?.[0].length ?? 0;
 const text = source.slice(tokenSpan.to, range.to).trimStart().split('\n').map((line, i) => i ? line.replace(new RegExp('^[ \\t]{0,' + indent + '}'), '') : line).join('\n').trimEnd();
 return {range, text};
}
function sectionEnd(model: ArgdownModel, position: number): number {return model.rules.filter(r => String(r.name) === 'heading').map(span).find(r => r && r.from > position)?.from ?? model.source.length;}
function promotionEdits(items: {at: number; text: string}[]): Edit[] {
 const batches = new Map<number, string[]>(); for (const item of items) batches.set(item.at, [...(batches.get(item.at) ?? []), item.text]);
 return [...batches].map(([at, texts]) => ({from: at, to: at, insert: '\n\n' + texts.join('\n\n') + '\n\n'}));
}
function assertMembership(before: ArgdownModel, after: ArgdownModel): void {
 const owners = (model: ArgdownModel): Map<string, string> => new Map(model.nodes.filter(isGroup).flatMap(group => (group.children ?? []).map(node => [nodeKey(node), nodeKey(group)] as const)));
 const old = owners(before), next = owners(after);
 for (const node of after.nodes.filter(n => !isGroup(n))) if (before.nodes.some(n => nodeKey(n) === nodeKey(node)) && old.get(nodeKey(node)) !== next.get(nodeKey(node))) throw new Error(tr("argdown.this_change_would_alter_section_membership_edit_the_source_instead"));
}
export function deleteRelation(engine: ArgdownEngine, model: ArgdownModel, key: string): string {
 const promoted = relationRules(model, key).map(rule => promote(model.source, rule));
 const candidate = applyEdits(model.source, [...promoted.map(p => ({...p.range, insert: ''})), ...promotionEdits(promoted.map(p => ({at: sectionEnd(model, p.range.from), text: p.text})))]), next = parseForView(engine, model, candidate); assertNodes(model, next); assertMembership(model, next);
 const expected = model.edges.filter(e => edgeKey(e) !== key).map(edgeKey).sort();
 if (JSON.stringify(expected) !== JSON.stringify(next.edges.map(edgeKey).sort())) throw new Error(tr("argdown.this_relation_contributes_to_other_inferences_edit_the_source_instead"));
 return candidate;
}
export function deleteNodes(engine: ArgdownEngine, model: ArgdownModel, keys: ReadonlySet<string>): string {
 let candidate = model.source;
 for (const key of keys) {
  const current = engine.parse(candidate), node = lookup(current, key); if (String(node.type) === 'group-map-node') throw new Error(tr("argdown.sections_can_be_dissolved_through_their_title_in_the_source"));
  if (Object.values(current.response.arguments ?? {}).some(a => a.pcs.some(p => p.title === node.title)) || String(node.type) === 'argument-map-node' && current.response.arguments?.[node.title ?? '']?.pcs.length) throw new Error(tr("argdown.this_node_belongs_to_an_argument_reconstruction_edit_its_premises_and"));
  const selected = nodeRules(current, node), removed: Edit[] = [], promoted: {at: number; text: string}[] = [];
  for (const rule of selected) {
   const parent = current.rules.find(r => r.relation && r.children?.includes(rule)), range = span(parent ?? rule); if (!range || removed.some(e => range.from >= e.from && range.to <= e.to)) continue;
   const children = rule.children?.find(r => isRule(r) && String(r.name) === 'relations');
   if (children && isRule(children)) for (const relation of children.children ?? []) if (isRule(relation) && relation.relation) promoted.push({at: sectionEnd(current, range.from), text: promote(candidate, relation).text});
   removed.push({...range, insert: ''});
  }
  candidate = applyEdits(candidate, [...removed, ...promotionEdits(promoted)]);
  const next = parseForView(engine, model, candidate);
  assertMembership(current, next);
  const expectedNodes = current.nodes.filter(n => !isGroup(n) && nodeKey(n) !== key).map(nodeKey).sort(), expectedEdges = current.edges.filter(e => nodeKey(e.from) !== key && nodeKey(e.to) !== key).map(edgeKey).sort();
  if (JSON.stringify(expectedNodes) !== JSON.stringify(next.nodes.filter(n => !isGroup(n)).map(nodeKey).sort()) || JSON.stringify(expectedEdges) !== JSON.stringify(next.edges.map(edgeKey).sort())) throw new Error(tr("argdown.this_node_is_still_needed_elsewhere_remove_it_in_the_source"));
 }
 return candidate;
}
export function graphDirection(source: string, direction: string): string {
 if (!['TB', 'BT', 'LR', 'RL'].includes(direction)) throw new Error(tr("common.invalid_direction"));
 const match = /^\s*={3,}\r?\n([\s\S]*?)\r?\n={3,}/u.exec(source), document = parseDocument(match?.[1] ?? '');
 if (document.errors.length) throw new Error(tr("argdown.correct_the_argdown_configuration_first"));
 document.setIn(['dot', 'graphVizSettings', 'rankdir'], direction);
 const newline=source.includes('\r\n')?'\r\n':'\n';
 return ('===\n' + document.toString().trimEnd() + '\n===').replace(/\n/gu,newline) + (match ? source.slice(match[0].length) : newline+newline+source);
}
function nodeDataEdits(model: ArgdownModel, node: IMapNode, property: 'color' | 'isInGroup', value?: string | boolean, target?: IRuleNode): Edit[] {
 const edits: Edit[] = []; let placed = false;
 for (const rule of nodeRules(model, node)) for (const child of rule.children ?? []) if (!isRule(child) && 'tokenType' in child && child.tokenType.name === 'Data') {
  const range = span(child); if (!range) continue; const data = dataDocument(model.source.slice(range.from, range.to)), had = data.document.has(property);
  if (rule === target && value !== undefined) {data.document.set(property, value); placed = true;} else if (had) data.document.delete(property); else continue;
  const insert = data.write(), empty = insert === '{}'; edits.push({from: empty && model.source[range.from - 1] === ' ' ? range.from - 1 : range.from, to: range.to, insert: empty ? '' : insert});
 }
 if (target && !placed && value !== undefined) {
  const range = span({...target, children: target.children?.filter(child => !isRule(child) || String(child.name) !== 'relations')}); if (!range) throw new Error(tr("argdown.the_metadata_assignment_is_ambiguous"));
  const at = range.from + model.source.slice(range.from, range.to).trimEnd().length; edits.push({from: at, to: at, insert: ' {' + property + ': ' + JSON.stringify(value) + '}'});
 }
 return edits;
}
export function nodeColor(engine: ArgdownEngine, model: ArgdownModel, key: string, color?: string): string {
 const node = lookup(model, key); if (isGroup(node)) return sectionColor(engine, model, key, color);
 const defined = definition(model, node), rules = nodeRules(model, node), target = rules.find(rule => defined && (rule === defined || rule.children?.includes(defined))) ?? rules[0];
 const candidate = applyEdits(model.source, nodeDataEdits(model, node, 'color', color, color ? target : undefined)), next = parseForView(engine, model, candidate); assertRelations(model, next); assertMembership(model, next);
 if (color && next.nodes.find(n => nodeKey(n) === key)?.color?.toLowerCase() !== color.toLowerCase()) throw new Error(tr("argdown.the_argdown_configuration_overrides_this_color_edit_the_source_instead"));
 return candidate;
}
/** Explicit Argdown membership flags keep nested sections intact. */
export function moveToSection(engine: ArgdownEngine, model: ArgdownModel, keys: ReadonlySet<string>, target: string): string {
 assertHeadingGroups(model);
 const group = lookup(model, target); if (!isGroup(group) || !group.section?.heading) throw new Error(tr("argdown.select_a_section_as_the_target"));
 const heading = span(group.section.heading); if (!heading) throw new Error(tr("argdown.the_section_assignment_is_ambiguous"));
 const edits: Edit[] = [], references: string[] = [], end = sectionEnd(model, heading.from);
 for (const key of keys) {
  const node = lookup(model, key); if (isGroup(node)) throw new Error(tr("argdown.change_nested_sections_through_their_headings_in_the_source"));
  const existing = nodeRules(model, node).find(rule => {const range = span(rule); return range && range.from >= heading.to && range.from < end;});
  edits.push(...nodeDataEdits(model, node, 'isInGroup', existing ? true : undefined, existing));
  if (!existing) references.push(ref(node) + ' {isInGroup: true}');
 }
 if (references.length) edits.push({from: heading.to, to: heading.to, insert: '\n\n' + references.join('\n\n') + '\n'});
 const candidate = applyEdits(model.source, edits), next = parseForView(engine, model, candidate); assertRelations(model, next);
 for (const key of keys) {
  const container = next.nodes.find(n => isGroup(n) && n.children?.some(child => nodeKey(child) === key));
  if (!container || nodeKey(container) !== target) throw new Error(tr("argdown.the_argdown_configuration_prevents_this_section_assignment_edit_the_source_instead"));
 }
 return candidate;
}
export function renameNode(engine: ArgdownEngine, model: ArgdownModel, key: string, title: string): string {
 const node = lookup(model, key); title = title.trim();
 if (!title || /[\]<>\r\n[]/u.test(title)) throw new Error(tr("argdown.enter_a_title_without_brackets_or_line_breaks"));
 if (title === node.title) return model.source;
 const index = String(node.type) === 'argument-map-node' ? model.response.arguments : model.response.statements;
 if (index?.[title]) throw new Error(tr("argdown.this_title_is_already_in_use"));
 const edits: Edit[] = [];
 for (const token of model.response.tokens ?? []) if ((token as ITokenNode).title === node.title && /Definition|Reference|Mention/u.test(token.tokenType.name) && /Argument/u.test(token.tokenType.name) === key.startsWith('a:')) {
  const range = span(token); if (!range) continue; const old = model.source.slice(range.from, range.to), start = old.indexOf(key.startsWith('a:') ? '<' : '['), end = old.lastIndexOf(key.startsWith('a:') ? '>' : ']');
  if (start >= 0 && end > start) edits.push({from: range.from + start + 1, to: range.from + end, insert: title});
 }
 const candidate = applyEdits(model.source, edits), next = parseForView(engine, model, candidate), replacement = key.slice(0, 2) + title;
 const expected = model.edges.map(e => 'e:' + JSON.stringify([nodeKey(e.from) === key ? replacement : nodeKey(e.from), nodeKey(e.to) === key ? replacement : nodeKey(e.to), e.relationType])).sort();
 if (!next.nodes.some(n => nodeKey(n) === replacement) || JSON.stringify(expected) !== JSON.stringify(next.edges.map(edgeKey).sort())) throw new Error(tr("argdown.this_title_has_a_different_role_in_a_reconstruction_rename_it"));
 return candidate;
}
export function editSection(engine: ArgdownEngine, model: ArgdownModel, key: string, title?: string): string {
 assertHeadingGroups(model);
 const group = lookup(model, key); if (!isGroup(group) || !group.section?.heading) throw new Error(tr("argdown.the_section_is_ambiguous"));
 const heading = group.section.heading, range = span(heading); if (!range) throw new Error(tr("argdown.the_heading_is_missing"));
 const edits: Edit[] = [];
 if (title !== undefined) {
  const content = heading.children?.find(child => isRule(child) && String(child.name) === 'statementContent'), contentSpan = content ? span(content) : undefined;
  if (!title.trim() || /[\r\n{}]/u.test(title) || !contentSpan) throw new Error(tr("argdown.enter_a_single_line_section_title"));
  const tags = content ? leaves(content).filter(child => 'tokenType' in child && child.tokenType.name === 'Tag').map(child => {const range = span(child)!; return model.source.slice(range.from, range.to);}) : [];
  edits.push({...contentSpan, insert: title.trim() + tags.filter(tag => !title.includes(tag)).map(tag => ' ' + tag).join('') + (model.source.slice(contentSpan.from, contentSpan.to).match(/\s*$/u)?.[0] ?? '')});
 } else {
  edits.push({...range, insert: ''});
  for (const other of model.rules.filter(r => String(r.name) === 'heading')) {
   const r = span(other); if (!r || r.from <= range.from) continue;
   const start = other.children?.find(c => !isRule(c) && 'tokenType' in c && c.tokenType.name === 'HeadingStart'); if (!start || !('image' in start)) continue;
   const level = start.image.trim().length; if (level <= group.section.level) break;
   const s = span(start); if (s) edits.push({from: s.from, to: s.from + 1, insert: ''});
  }
 }
 const candidate = applyEdits(model.source, edits), next = parseForView(engine, model, candidate); assertNodes(model, next); assertRelations(model, next); return candidate;
}
export function createSection(engine: ArgdownEngine, model: ArgdownModel, keys: ReadonlySet<string>, title: string, parent?: string): string {
 assertHeadingGroups(model); model = engine.parse(pinVisibleSections(model));
 if (!keys.size) {const added = addNode(model.source, model, 'statement'); return createSection(engine, engine.parse(added.source), new Set([added.key]), title, parent);}
 if (!title.trim() || /[\r\n{}]/u.test(title)) throw new Error(tr("argdown.enter_a_single_line_section_title"));
 const existing = parent ? lookup(model, parent) : undefined, level = existing && isGroup(existing) ? (existing.section?.level ?? 0) + 1 : 1;
 let at = model.source.length;
 if (existing && isGroup(existing) && existing.section?.heading) {
  const own = span(existing.section.heading);
  const next = model.rules.filter(r => String(r.name) === 'heading').find(r => {const s = span(r); return s && own && s.from > own.from && (r.level ?? r.section?.level ?? 0) < level;});
  if (next) at = span(next)!.from;
 }
 const candidate = applyEdits(model.source, [{from: at, to: at, insert: '\n\n' + '#'.repeat(level) + ' ' + title.trim() + ' {isGroup: true}\n\n' + [...keys].map(key => ref(lookup(model, key)) + ' {isInGroup: true}').join('\n\n') + '\n\n'}]), next = parseForView(engine, model, candidate);
 assertNodes(model, next); assertRelations(model, next); return candidate;
}
