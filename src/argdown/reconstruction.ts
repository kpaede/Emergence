import {t as tr} from '../i18n';
import {readLogicalLinks, logicalLinkEdits, appendLogicalLinks, validateLogicalLinks, type LogicalLink} from './logical-links';
import {parseDocument} from 'yaml';
import type {ArgdownEngine} from './engine';
import {applyEdits, dataDocument, type Edit} from './source-edits';
import {rulesOf, span, type ArgdownModel, type IRuleNode, type SourceSpan} from './model';
export interface LogicalStep {
 id: string; links: LogicalLink[]; title: string; text: string; reference: boolean; conclusion: boolean; rule: string; uses?: string[]; visible: '' | 'true' | 'false';
 original?: {number: number; range: SourceSpan; rule: IRuleNode; statement: IRuleNode; inference?: IRuleNode; gap?: string; inferenceGap?: string; usesLocation?: 'statement' | 'inference'; usesField?: 'uses' | 'from'; values: {title: string; text: string; reference: boolean; conclusion: boolean; rule: string; visible: string}};
}
export interface Reconstruction {argument: string; range?: SourceSpan; steps: LogicalStep[]}
const named = (rule: IRuleNode, name: string): IRuleNode | undefined => rule.children?.find((child): child is IRuleNode => 'children' in child && String(child.name) === name);
const record = (value: unknown): Record<string, unknown> => value && typeof value === 'object' ? value as Record<string, unknown> : {};
export function newLogicalStep(model: ArgdownModel, argument: string, conclusion = false, occupied: string[] = []): LogicalStep {
 const titles = new Set([...Object.keys(model.response.statements ?? {}), ...occupied]); let index = 1; const base = argument + (conclusion ? tr("labels.conclusion") : tr("argdown.premise")); while (titles.has(base + index)) index++;
 return {id: crypto.randomUUID(), links: [], title: base + index, text: conclusion ? tr("argdown.new_conclusion") : tr("argdown.new_premise"), reference: false, conclusion, rule: '', visible: 'false'};
}
export function readReconstruction(model: ArgdownModel, key: string): Reconstruction {
 const argument = key.slice(2), pcs = model.rules.find(rule => String(rule.name) === 'pcs' && rule.argument?.title === argument);
 if (!pcs) {const first = newLogicalStep(model, argument), last = newLogicalStep(model, argument, true, [first.title]); return {argument, steps: [first, last]};}
 const all = rulesOf(pcs), statements = all.filter(rule => String(rule.name) === 'pcsStatement'), steps: LogicalStep[] = [];
 for (const rule of statements) {
  const statement = named(rule, 'statement'), range = span(rule); if (!statement || !range) throw new Error(tr("argdown.this_logical_step_cannot_be_uniquely_matched"));
  const definition = named(statement, 'statementDefinition'), reference = named(statement, 'statementReference'), content = named(definition ?? statement, 'statementContent'), contentRange = content ? span(content) : undefined;
  const head = span({...statement, children: statement.children?.filter(child => !('name' in child) || String(child.name) !== 'relations')}) ?? range;
  const token = model.response.tokens?.find(t => t.startOffset >= head.from && t.startOffset < head.to && /StatementDefinition|StatementReference/u.test(t.tokenType.name));
  const inference = all.filter(r => String(r.name) === 'inference' && span(r)!.to <= range.from).pop();
  const actual = model.response.arguments?.[argument]?.pcs[steps.length], conclusion = String(actual?.role) !== 'premise';
  const data = record(statement.data), values = {title: typeof record(token).title === 'string' ? String(record(token).title) : '', text: contentRange ? model.source.slice(contentRange.from, contentRange.to).trimEnd() : '', reference: !!reference || !!actual?.isReference, conclusion, rule: conclusion ? inference?.inference?.inferenceRules?.join(', ') ?? '' : '', visible: typeof data.isInMap === 'boolean' ? String(data.isInMap) : ''};
  steps.push({id: 'original-' + String(rule.statementNr), links: readLogicalLinks(model, statement), ...values, visible: values.visible as LogicalStep['visible'], original: {number: rule.statementNr ?? steps.length + 1, range, rule, statement, inference: conclusion ? inference : undefined, values}});
 }
 for (const [index, step] of steps.entries()) {
  const inferenceData = record(step.original?.inference?.inference?.data), statementData = record(step.original?.statement.data);
  const location = Array.isArray(inferenceData.uses) ? 'inference' : Array.isArray(statementData.uses) ? 'statement' : Array.isArray(inferenceData.from) ? 'inference' : undefined;
  const field = location === 'inference' && !Array.isArray(inferenceData.uses) ? 'from' : 'uses';
  const uses = location === 'statement' ? statementData[field] : inferenceData[field];
  if (step.original) {step.original.usesLocation = location; step.original.usesField = field;
   const previous = steps[index - 1]?.original?.range.to, start = step.original.inference ? span(step.original.inference)?.from : step.original.range.from;
   if (step.original.inference) step.original.inferenceGap = model.source.slice(span(step.original.inference)!.to, step.original.range.from);
   if (previous !== undefined && start !== undefined) step.original.gap = model.source.slice(previous, start);
  }
  if (Array.isArray(uses)) step.uses = uses.map(number => steps.find(s => s.original?.number === number)?.id ?? 'missing-' + String(number));
 }

 return {argument, range: span(pcs), steps};
}
function body(model: ArgdownModel, step: LogicalStep, steps: LogicalStep[], index: number): string {
 if (!step.original) return appendLogicalLinks((step.title ? '[' + step.title + ']' + (step.reference ? '' : ': ') : '') + (step.reference ? '' : step.text.trim()) + (step.visible ? ' {isInMap: ' + step.visible + '}' : ''), step.links);
 const original = step.original, range = span(original.statement)!;
 const changed = step.title !== original.values.title || step.text !== original.values.text || step.reference !== original.values.reference;
 const edits: Edit[] = logicalLinkEdits(model, readLogicalLinks(model, original.statement), step.links);
 let headEdit: Edit | undefined;
 if (changed) {
  const relations = named(original.statement, 'relations'), dataToken = original.statement.children?.find(child => 'tokenType' in child && child.tokenType.name === 'Data'), dataRange = dataToken ? span(dataToken) : undefined;
  const relationsRange = relations ? span(relations) : undefined, headEnd = dataRange?.from ?? relationsRange?.from ?? range.to;
  const suffix = model.source.slice(range.from, headEnd).match(/\s*$/u)?.[0] ?? '';
  const text = (step.title ? '[' + step.title + ']' + (step.reference ? '' : ': ') : '') + (step.reference ? '' : step.text.trim());
  headEdit = {from: range.from, to: headEnd, insert: text + suffix}; edits.push(headEdit);
 }
 const oldUses = record(original.statement.data)[original.usesField ?? 'uses'];
 const numbers = step.original?.usesLocation === 'statement' ? dependencyNumbers(step, steps, index) : undefined;
 const changedUses = step.original?.usesLocation === 'statement' && JSON.stringify(numbers) !== JSON.stringify(oldUses);
 if (step.visible !== original.values.visible || changedUses) {
  const token = original.statement.children?.find(child => 'tokenType' in child && child.tokenType.name === 'Data'), tokenRange = token ? span(token) : undefined;
  if (tokenRange) {
   const document = dataDocument(model.source.slice(tokenRange.from, tokenRange.to));
   if (step.visible !== original.values.visible) {if (step.visible) document.document.set('isInMap', step.visible === 'true'); else document.document.delete('isInMap');}
   if (changedUses) {if (numbers === undefined) document.document.delete(original.usesField ?? 'uses'); else document.document.set(original.usesField ?? 'uses', numbers);}
   edits.push({...tokenRange, insert: document.write()});
  } else {
   const relations = named(original.statement, 'relations'), relationRange = relations ? span(relations) : undefined, end = relationRange?.from ?? range.to;
   if (headEdit) headEdit.insert = headEdit.insert.trimEnd() + (step.visible ? ' {isInMap: ' + step.visible + '}' : '') + (headEdit.insert.match(/\s*$/u)?.[0] ?? '');
   else {const at = range.from + model.source.slice(range.from, end).trimEnd().length; edits.push({from: at, to: at, insert: step.visible ? ' {isInMap: ' + step.visible + '}' : ''});}
  }
 }

 const text = applyEdits(model.source.slice(range.from, range.to), edits.map(edit => ({...edit, from: edit.from - range.from, to: edit.to - range.from}))).trimEnd(), first = readLogicalLinks(model, original.statement)[0]?.original;
 const indent = first ? model.source.slice(first.operator.from, first.operator.to).match(/^[ \t]*/u)?.[0] ?? '  ' : '  ';
 return appendLogicalLinks(text, step.links, indent);
}
function dependencyNumbers(step: LogicalStep, steps: LogicalStep[], index: number): number[] | undefined {
 return step.uses?.map(id => {const position = steps.findIndex(s => s.id === id); if (position < 0 || position >= index) throw new Error(tr("argdown.a_conclusion_can_only_use_earlier_steps_that_still_exist")); return position + 1;});
}
function inference(model: ArgdownModel, step: LogicalStep, steps: LogicalStep[], index: number): string {
 const original = step.original?.inference, range = original ? span(original) : undefined;
 let numbers = step.original?.usesLocation === 'statement' ? undefined : dependencyNumbers(step, steps, index);
 if (numbers && !step.original?.usesLocation) {
  const implicit: number[] = []; for (let i = index - 1; i >= 0; i--) {implicit.unshift(i + 1); if (steps[i]!.conclusion) break;}
  if (JSON.stringify(numbers) === JSON.stringify(implicit)) numbers = undefined;
 }

 const field = step.original?.usesField ?? 'uses', data = record(original?.inference?.data), uses = data[field];
 const sameUses = JSON.stringify(numbers) === JSON.stringify(uses);
 if (range && step.rule === step.original?.values.rule && sameUses) return model.source.slice(range.from, range.to).trimEnd();
 const dataToken = original?.children?.find(token => 'tokenType' in token && token.tokenType.name === 'Data'), dataRange = dataToken ? span(dataToken) : undefined;
 let dataText = '';
 if (dataRange) {
  const raw = model.source.slice(dataRange.from, dataRange.to);
  if (sameUses) dataText = raw;
  else {const block = /^\{\s*\n/u.test(raw), document = parseDocument(block ? raw.replace(/^\{\s*\n/u, '').replace(/\}\s*$/u, '') : raw); if (document.errors.length) throw new Error(tr("argdown.correct_the_inference_rule_metadata_first")); if (numbers === undefined) document.delete(field); else document.set(field, numbers); const text = document.toString().trimEnd(); dataText = text === '{}' ? '' : block ? '{\n' + text + '\n}' : text;}
 } else if (numbers !== undefined) dataText = JSON.stringify({uses: numbers});
 const ruleNode = original ? named(original, 'inferenceRules') : undefined, ruleRange = ruleNode ? span(ruleNode) : undefined;
 if (range && (step.rule === step.original?.values.rule || ruleRange)) {
  const edits: Edit[] = [];
  if (ruleRange && step.rule !== step.original?.values.rule) edits.push({...ruleRange, insert: step.rule.trim()});
  if (dataRange) edits.push({...dataRange, insert: dataText});
  else {const end = original?.children?.find(child => 'tokenType' in child && child.tokenType.name === 'InferenceEnd'), at = end ? span(end)?.from : undefined; if (at !== undefined && dataText) edits.push({from: at, to: at, insert: '\n' + dataText + '\n'});}
  return applyEdits(model.source.slice(range.from, range.to), edits.map(edit => ({...edit, from: edit.from - range.from, to: edit.to - range.from}))).trimEnd();
 }
 const relation = original ? named(original, 'relations') : undefined, relationRange = relation ? span(relation) : undefined, tail = relationRange ? '\n' + model.source.slice(relationRange.from, relationRange.to).trimEnd() : '';
 if (!step.rule.trim() && !dataText) return '----' + tail;
 const comments = range ? model.source.slice(range.from, range.to).match(/(?:^|\n)[ \t]*(?:\/\/[^\r\n]*|\/\*[\s\S]*?\*\/|<!--[\s\S]*?-->)/gu)?.map(comment => comment.trim()) ?? [] : [];
 return '--\n' + [...comments, step.rule.trim(), dataText].filter(Boolean).join('\n') + '\n--' + tail;
}
export function writeReconstruction(engine: ArgdownEngine, model: ArgdownModel, key: string, steps: LogicalStep[]): string {
 const reconstruction = readReconstruction(model, key), argument = reconstruction.argument;
 if (steps.length < 2 || steps[0]?.conclusion || !steps[steps.length - 1]?.conclusion) throw new Error(tr("argdown.an_argument_needs_at_least_one_premise_and_must_end_with"));
 if (new Set(steps.map(step => step.id)).size !== steps.length) throw new Error(tr("labels.each_step_may_occur_only_once"));
 for (const step of steps) {validateLogicalLinks(step.links, step.conclusion); if ((!step.reference && !step.text.trim()) || step.reference && !step.title.trim() || /[\]<>\r\n[]/u.test(step.title)) throw new Error(tr("argdown.choose_valid_text_or_existing_statements_for_all_steps"));}
 for (const old of reconstruction.steps) if (old.original && !steps.some(s => s.id === old.id) && named(old.original.statement, 'relations')) throw new Error(tr("argdown.this_step_has_its_own_relations_redirect_those_first"));
 for (const old of reconstruction.steps) if (old.original && !old.reference && old.title) {
  const current = steps.find(s => s.id === old.id), removed = !current || current.reference || current.title !== old.title;
  if (removed && (model.response.tokens ?? []).some(token => /StatementReference|StatementMention/u.test(token.tokenType.name) && record(token).title === old.title && reconstruction.range && (token.startOffset < reconstruction.range.from || token.startOffset >= reconstruction.range.to))) throw new Error(tr("argdown.statement_is_used_outside_this_argument_preserve_its_definition_as_a", {value1: old.title}));
 }
 const signatureOfSteps = (items: LogicalStep[]): string => JSON.stringify(items.map(({original, links, ...values}) => ({...values, original: original?.number, links: links.map(({original: _original, ...link}) => link)})));
 if (signatureOfSteps(steps) === signatureOfSteps(reconstruction.steps)) return model.source;
 const orphanComments = reconstruction.steps.filter(old => !steps.some(step => step.id === old.id)).flatMap(old => [old.original?.gap, old.original?.inferenceGap]).filter((gap): gap is string => !!gap && /\S/u.test(gap));
 let chunks = steps.map((step, index) => (index ? step.original?.gap && /\S/u.test(step.original.gap) ? '\n' + step.original.gap.trimStart() : '\n' : '') + (step.conclusion ? inference(model, step, steps, index) + (step.original?.inferenceGap && /\S/u.test(step.original.inferenceGap) ? '\n' + step.original.inferenceGap.trimStart() : '\n') : '') + '(' + (index + 1) + ') ' + body(model, step, steps, index)).join('');
 const newline = model.source.includes('\r\n') ? '\r\n' : '\n';
 if (orphanComments.length) chunks = orphanComments.map(comment => comment.trim()).join('\n') + '\n' + chunks;
 chunks = chunks.replace(/\r?\n/gu, newline);
 let candidate: string;
 if (reconstruction.range) candidate = applyEdits(model.source, [{...reconstruction.range, insert: chunks + (model.source.slice(reconstruction.range.from, reconstruction.range.to).endsWith('\n') ? newline : '')}]);
 else {
  const canonical = model.canonical?.get(key), declarations = model.rules.filter(rule => String(rule.name) === 'argument' && rule.argument?.title === argument);
  const declaration = declarations.find(rule => rule.statement === canonical) ?? declarations[0], location = declaration ? span(declaration)?.to ?? 0 : model.source.length;
  const at = model.rules.filter(rule => String(rule.name) === 'heading').map(span).find(range => range && range.from >= location)?.from ?? model.source.length;
  candidate = applyEdits(model.source, [{from: at, to: at, insert: newline + newline + '<' + argument + '>' + newline + newline + chunks + newline + newline}]);
 }

 const explicit = new Set((model.response.tokens ?? []).filter(token => /StatementDefinition|StatementReference/u.test(token.tokenType.name)).map(token => record(token).title));
 const stableTitle = (title: string | undefined): string => explicit.has(title) ? title ?? '' : '';
 const next = engine.parse(candidate), signature = (value: unknown): string => JSON.stringify(value);
 if (next.response.arguments?.[argument]?.pcs.length !== steps.length) throw new Error(tr("argdown.argdown_interprets_this_structure_differently_correct_the_steps"));
 for (const [title, other] of Object.entries(model.response.arguments ?? {})) if (title !== argument) {const updated = next.response.arguments?.[title]; if (!updated || signature(other.pcs.map(s => [stableTitle(s.title), s.text, s.role])) !== signature(updated.pcs.map(s => [stableTitle(s.title), s.text, s.role]))) throw new Error(tr("argdown.this_change_would_alter_another_argument_name_the_affected_statements_first"));}
 const owned = new Set([...reconstruction.steps.map(s => s.original?.rule.statement?.title), ...steps.filter(s => !s.reference).map(s => s.title)]);
 for (const [title, statement] of Object.entries(model.response.statements ?? {})) if (!owned.has(title) && explicit.has(title)) {const updated = next.response.statements?.[title]; if (!updated || signature(statement.members.filter(s => s.text?.trim()).map(s => s.text?.trimEnd())) !== signature(updated.members.filter(s => s.text?.trim()).map(s => s.text?.trimEnd()))) throw new Error(tr("argdown.this_change_would_alter_another_statement_check_its_references"));}
 return candidate;
}
