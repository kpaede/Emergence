import {t as tr} from '../i18n';
import type {ISection, IRuleNode} from '@argdown/core';
import type {ArgdownEngine} from './engine';
import {isGroup, nodeKey, span, type ArgdownModel} from './model';
import {applyEdits, dataDocument, type Edit} from './source-edits';

export function assertHeadingGroups(model: ArgdownModel): void {
 if (model.request.group?.regroup?.length) throw new Error(tr("argdown.these_sections_are_defined_by_group_regroup_edit_that_configuration_in"));
}
function sections(items: ISection[] = []): ISection[] {return items.flatMap(item => [item, ...sections(item.children)]);}
function headingFlag(model: ArgdownModel, heading: IRuleNode, property: 'isGroup' | 'isClosed' | 'color', value: boolean | string | undefined): Edit {
 const token = heading.children?.find(child => 'tokenType' in child && child.tokenType.name === 'Data'), range = token ? span(token) : undefined;
 if (range) {const data = dataDocument(model.source.slice(range.from, range.to)); if (value === undefined) data.document.delete(property); else data.document.set(property, value); return {...range, insert: data.write()};}
 const own = span(heading); if (!own) throw new Error(tr("argdown.the_heading_cannot_be_uniquely_matched"));
 return {from: own.to, to: own.to, insert: value === undefined ? '' : ' {' + property + ': ' + JSON.stringify(value) + '}'};
}
/** Adding a deeper level must not silently remove previously visible ancestors. */
export function pinVisibleSections(model: ArgdownModel): string {
 const edits = sections(model.response.sections).filter(section => section.isGroup && section.heading).map(section => headingFlag(model, section.heading!, 'isGroup', true));
 return applyEdits(model.source, edits);
}
function meaning(model: ArgdownModel): string {
 return JSON.stringify([
  Object.entries(model.response.statements ?? {}).map(([title, value]) => [title, value.members.map(member => member.text)]).sort(),
  Object.entries(model.response.arguments ?? {}).map(([title, value]) => [title, value.members.map(member => member.text), value.pcs.map(step => [step.title, step.text, step.role])]).sort(),
  (model.response.relations ?? []).map(edge => [edge.from?.type, edge.from?.title, edge.to?.type, edge.to?.title, edge.relationType]).sort(),
 ]);
}
export function sectionColor(engine: ArgdownEngine, model: ArgdownModel, key: string, color?: string): string {
 assertHeadingGroups(model); const group = model.nodes.find(node => nodeKey(node) === key);
 if (!group || !isGroup(group) || !group.section?.heading) throw new Error(tr("argdown.select_a_section"));
 const candidate = applyEdits(model.source, [headingFlag(model, group.section.heading, 'color', color)]), next = engine.parse(candidate);
 if (meaning(model) !== meaning(next) || color && next.nodes.find(node => nodeKey(node) === key)?.color?.toLowerCase() !== color.toLowerCase()) throw new Error(tr("argdown.the_argdown_configuration_overrides_this_section_color"));
 return candidate;
}
export function closeSection(engine: ArgdownEngine, model: ArgdownModel, key: string, closed: boolean): string {
 assertHeadingGroups(model); const group = model.nodes.find(node => nodeKey(node) === key);
 if (!group || !isGroup(group) || !group.section?.heading) throw new Error(tr("argdown.select_a_section"));
 const candidate = applyEdits(model.source, [headingFlag(model, group.section.heading, 'isClosed', closed)]), next = engine.parse(candidate);
 const section = sections(next.response.sections).find(item => item.id === group.section!.id);
 if (section?.isClosed !== closed || meaning(model) !== meaning(next)) throw new Error(tr("argdown.the_argdown_configuration_prevents_collapsing_or_expanding_this_section"));
 return candidate;
}
function subtree(model: ArgdownModel, section: ISection): {from: number; to: number} {
 const own = section.heading ? span(section.heading) : undefined; if (!own) throw new Error(tr("argdown.the_section_has_no_heading"));
 const next = sections(model.response.sections).find(item => item.heading && span(item.heading)!.from > own.from && item.level <= section.level);
 return {from: own.from, to: next?.heading ? span(next.heading)!.from : model.source.length};
}
/** Move a whole heading subtree, never just its visible box or a subset of its children. */
export function moveSection(engine: ArgdownEngine, original: ArgdownModel, key: string, target?: string): string {
 assertHeadingGroups(original); const model = engine.parse(pinVisibleSections(original));
 const group = model.nodes.find(node => nodeKey(node) === key), parent = target ? model.nodes.find(node => nodeKey(node) === target) : undefined;
 if (!group || !isGroup(group) || !group.section || target && (!parent || !isGroup(parent) || !parent.section)) throw new Error(tr("argdown.select_valid_sections"));
 const own = subtree(model, group.section), parentSection = parent && isGroup(parent) ? parent.section : undefined;
 if (parentSection) {const start = span(parentSection.heading!)!.from; if (start >= own.from && start < own.to) throw new Error(tr("argdown.a_section_cannot_be_moved_into_itself_or_one_of_its"));}
 const delta = (parentSection ? parentSection.level + 1 : 1) - group.section.level;
 const children = sections([group.section]);
 const edits: Edit[] = children.map(item => {const token = item.heading?.children?.find(child => 'tokenType' in child && child.tokenType.name === 'HeadingStart'), range = token ? span(token) : undefined; if (!range || !('image' in token!)) throw new Error(tr("argdown.the_heading_is_ambiguous")); return {from: range.from - own.from, to: range.from - own.from + token.image.trim().length, insert: '#'.repeat(item.level + delta)};});
 const text = applyEdits(model.source.slice(own.from, own.to), edits), at = parentSection ? subtree(model, parentSection).to : model.source.length;
 const candidate = applyEdits(model.source, [{...own, insert: ''}, {from: at, to: at, insert: '\n\n' + text.trimEnd() + '\n\n'}]), next = engine.parse(candidate);
 if (meaning(original) !== meaning(next)) throw new Error(tr("argdown.moving_would_change_existing_statements_or_relations_check_section_references_in"));
 // Flags can make membership order-sensitive. Refuse a move that changes an element's owner.
 const order = sections(model.response.sections), moving = new Set(children.map(item => item.id)), remaining = order.filter(item => !moving.has(item.id));
 const insertion = remaining.findIndex(item => span(item.heading!)!.from >= at), expectedOrder = [...remaining]; expectedOrder.splice(insertion < 0 ? remaining.length : insertion, 0, ...children);
 const newOrder = sections(next.response.sections); if (expectedOrder.length !== newOrder.length) throw new Error(tr("argdown.the_section_structure_changed_unexpectedly"));
 const mappedIds = new Map(expectedOrder.map((item, index) => [item.id, newOrder[index]!.id]));
 const owners = (m: ArgdownModel): Map<string, string | undefined> => new Map([...Object.entries(m.response.statements ?? {}).map(([name, value]) => ['s:' + name, value.section?.id] as const), ...Object.entries(m.response.arguments ?? {}).map(([name, value]) => ['a:' + name, value.section?.id] as const)]);
 const after = owners(next); for (const [node, owner] of owners(model)) if (after.get(node) !== (owner ? mappedIds.get(owner) : undefined)) throw new Error(tr("argdown.reused_section_references_would_regroup_nodes_resolve_this_assignment_in_the"));
 return candidate;
}
