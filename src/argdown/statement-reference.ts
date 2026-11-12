import {t as tr} from '../i18n';
import {IEquivalenceClass} from '@argdown/core';
import type {ArgdownEngine} from './engine';
import {readReconstruction} from './reconstruction';
import {span, type ArgdownModel} from './model';
import {applyEdits} from './source-edits';
/** Naming and connecting belong to one source transaction; the user need not edit identifiers. */
export function ensureNodeReference(engine: ArgdownEngine, display: ArgdownModel, key: string, source = display.source): {source: string; key: string} {
 const base = display.response.emergenceDerivation?.base ?? display, model = source === base.source ? base : engine.parse(source), projection = display.response.emergenceDerivation, inference = projection?.inferences.get(key), roles = projection?.statements.get(key);
 const role = inference ? {argument: inference.argument, index: inference.conclusion} : roles?.find(role => base.response.arguments?.[role.argument]?.pcs[role.index] === base.canonical?.get(key)) ?? roles?.[0];
 if (!role && key.startsWith('a:') && model.response.arguments?.[key.slice(2)]) return {source, key};
 const member = role ? model.response.arguments?.[role.argument]?.pcs[role.index] : undefined, title = member?.title ?? (key.startsWith('s:') ? key.slice(2) : undefined);
 if (!title || !model.response.statements?.[title]) throw new Error(tr("argdown.the_statement_no_longer_exists_connect_it_again"));
 const named = model.response.tokens?.some(token => 'title' in token && token.title === title && /StatementDefinition|StatementReference/u.test(token.tokenType.name));
 if (named) return {source, key: 's:' + title};
 const canonical = IEquivalenceClass.getCanonicalMember(model.response.statements[title]);
 const rule = role ? readReconstruction(model, 'a:' + role.argument).steps[role.index]?.original?.statement : model.rules.find(rule => String(rule.name) === 'statement' && rule.statement === canonical);
 const range = rule ? span(rule) : undefined; if (!range) throw new Error(tr("argdown.the_statement_cannot_be_uniquely_matched_anymore_connect_it_again"));
 const occupied = new Set([...Object.keys(model.response.statements ?? {}), ...Object.keys(model.response.arguments ?? {})]);
 let index = 1; while (occupied.has(tr("argdown.statement_4", {value1: index}))) index++;
 const name = tr("argdown.statement_4", {value1: index}), candidate = applyEdits(source, [{from: range.from, to: range.from, insert: '[' + name + ']: '}]), next = engine.parse(candidate);
 const renamed = next.response.statements?.[name], text = renamed ? IEquivalenceClass.getCanonicalMember(renamed)?.text : undefined;
 if (!renamed || text?.trimEnd() !== canonical?.text?.trimEnd()) throw new Error(tr("argdown.this_connection_could_not_be_uniquely_matched_try_again"));
 return {source: candidate, key: 's:' + name};
}
