import {t as tr} from '../i18n';
import type {ArgdownEngine} from './engine';
import type {RelationMember, IConclusion} from '@argdown/core';
import {applyEdits} from './source-edits';
import {span, type ArgdownModel, type IRuleNode} from './model';
export interface ArgdownNodeDraft {title: string; text: string}
function definition(model: ArgdownModel, key: string): IRuleNode | undefined {
 const title = key.slice(2), canonical = model.canonical?.get(key), rules = model.rules.filter(rule => key.startsWith('a:') ? String(rule.name) === 'argument' && rule.argument?.title === title : String(rule.name) === 'statement' && rule.statement?.title === title);
 return rules.find(rule => rule.statement === canonical) ?? rules.find(rule => rule.children?.some(child => 'children' in child && ['statementDefinition','statementContent'].includes(String(child.name)))) ?? rules[0];
}
export function readNodeDraft(model: ArgdownModel, key: string): ArgdownNodeDraft {
 const rule = definition(model, key); if (!rule) throw new Error(tr("argdown.the_statement_or_argument_no_longer_exists"));
 const inner = rule.children?.find((child): child is IRuleNode => 'children' in child && String(child.name) === 'statementDefinition') ?? rule, content = inner.children?.find(child => 'children' in child && String(child.name) === 'statementContent'), range = content ? span(content) : undefined;
 const titled = key.startsWith('a:') || model.response.tokens?.some(token => 'title' in token && token.title === key.slice(2) && /StatementDefinition|StatementReference/u.test(token.tokenType.name));
 return {title: titled ? key.slice(2) : '', text: range ? model.source.slice(range.from, range.to).trimEnd() : ''};
}
/** Source order provides stable identity even when naming shifts generated anonymous titles. */
function structure(model: ArgdownModel): string {
 const statements = Object.keys(model.response.statements ?? {}), arguments_ = Object.keys(model.response.arguments ?? {});
 const identity = (member?: RelationMember): unknown => !member ? undefined : String(member.type) === 'inference' ? ['inference', arguments_.indexOf('argumentTitle' in member ? member.argumentTitle ?? '' : ''), 'conclusionIndex' in member ? member.conclusionIndex : undefined] : [member.type, (String(member.type) === 'argument' ? arguments_ : statements).indexOf(member.title ?? '')];
 return JSON.stringify({relations: (model.response.relations ?? []).map(relation => JSON.stringify([identity(relation.from), identity(relation.to), relation.relationType])).sort(),
  pcs: Object.values(model.response.arguments ?? {}).map(argument => argument.pcs.map(step => [statements.indexOf(step.title ?? ''), step.role, (step as IConclusion).inference?.inferenceRules, (step as IConclusion).inference?.data as unknown, step.data as unknown])),
  sections: model.rules.filter(rule => String(rule.name) === 'heading').map(rule => [rule.section?.title, rule.section?.level]),
 });
}
/** Update a canonical description and every title reference in a single undoable source transaction. */
export function editNodeDraft(engine: ArgdownEngine, model: ArgdownModel, key: string, draft: ArgdownNodeDraft): {source: string; key: string} {
 const old = readNodeDraft(model,key), title = draft.title.trim(), text = draft.text.trim(), argument = key.startsWith('a:');
 if (title === old.title && text === old.text) return {source: model.source, key};
 if (/[\]<>\r\n[]/u.test(title)) throw new Error(tr("argdown.enter_a_title_without_brackets_or_line_breaks"));
 if (!title && (old.title || !text)) throw new Error(tr("argdown.enter_a_title"));
 const dictionary = argument ? model.response.arguments : model.response.statements;
 if (title && title !== key.slice(2) && dictionary?.[title]) throw new Error(tr("argdown.this_title_is_already_in_use"));
 const rule = definition(model,key)!; const range = span(rule); if (!range) throw new Error(tr("argdown.the_source_range_is_missing"));
 const data = rule.children?.find(child => 'tokenType' in child && child.tokenType.name === 'Data'), relations = rule.children?.find(child => 'children' in child && String(child.name) === 'relations'), end = (data ? span(data)?.from : undefined) ?? (relations ? span(relations)?.from : undefined) ?? range.to;
 const suffix = model.source.slice(range.from,end).match(/\s*$/u)?.[0] ?? '', initialTitle = old.title || title, header = initialTitle ? (argument ? '<' + initialTitle + '>' : '[' + initialTitle + ']') + (text ? ': ' : '') : '';
 let source = applyEdits(model.source,[{from:range.from,to:end,insert:header+text+suffix}]);
 if (old.title && title !== old.title) {
  const current = engine.parse(source), edits = (current.response.tokens ?? []).flatMap(token => {
   if (!('title' in token) || token.title !== old.title || !/Definition|Reference|Mention/u.test(token.tokenType.name) || /Argument/u.test(token.tokenType.name) !== argument) return [];
   const at = token.endOffset === undefined ? undefined : {from: token.startOffset, to: token.endOffset + 1}; if (!at) return []; const raw = source.slice(at.from,at.to), from = raw.indexOf(argument ? '<' : '['), to = raw.lastIndexOf(argument ? '>' : ']');
   return from < 0 || to <= from ? [] : [{from:at.from+from+1,to:at.from+to,insert:title}];
  }); source = applyEdits(source,edits);
 }
 const next = engine.parse(source), replacement = title ? key.slice(0,2)+title : key;
 if (Object.keys(next.response.arguments ?? {}).length !== Object.keys(model.response.arguments ?? {}).length || Object.keys(next.response.statements ?? {}).length !== Object.keys(model.response.statements ?? {}).length) throw new Error(tr("argdown.this_text_would_create_additional_statements_or_arguments_do_not_insert"));
 if (structure(model) !== structure(next)) throw new Error(tr("argdown.this_text_would_alter_relations_sections_or_the_reconstruction_edit_the"));
 if (!(argument ? next.response.arguments : next.response.statements)?.[replacement.slice(2)]) throw new Error(tr("argdown.the_new_title_could_not_be_uniquely_matched"));
 return {source,key:replacement};
}
