import {t as tr} from '../i18n';
import {ensureNodeReference} from './statement-reference';
import type {ArgdownEngine} from './engine';
import {applyEdits, dataDocument} from './source-edits';
import {edgeKey, nodeKey, span, type ArgdownModel} from './model';
import {readReconstruction, writeReconstruction, type LogicalStep} from './reconstruction';
import type {InferenceRole, StatementRole} from './derivation';
export interface LogicalTarget extends StatementRole {inference: boolean}
export function logicalTarget(model: ArgdownModel, key: string): LogicalTarget | undefined {
 const p = model.response.emergenceDerivation, inference = p?.inferences.get(key);
 if (inference) return {argument: inference.argument, index: inference.conclusion, inference: true};
 const roles = p?.statements.get(key), canonical = p?.base.canonical?.get(key);
 const statement = roles?.find(role => p?.base.response.arguments?.[role.argument]?.pcs[role.index] === canonical) ?? roles?.[0]; if (statement) return {...statement, inference: false};
 return undefined;
}
export function logicalEdge(model: ArgdownModel, key: string): (InferenceRole & {premise?: number}) | undefined {
 const p = model.response.emergenceDerivation, edge = model.edges.find(edge => edgeKey(edge) === key); if (!p || !edge || !['support', 'entails'].includes(String(edge.relationType))) return;
 const target = p.inferences.get(nodeKey(edge.to)), source = p.inferences.get(nodeKey(edge.from));
 if (target) {const role = p.statements.get(nodeKey(edge.from))?.find(role => role.argument === target.argument); if (role) return {...target, premise: role.index};}
 if (source && p.statements.get(nodeKey(edge.to))?.some(role => role.argument === source.argument && role.index === source.conclusion)) return source;
 return undefined;
}
/** Pin implicit native dependencies before inserting/reordering steps. */
export function explicitDependencies(steps: LogicalStep[]): void {
 steps.forEach((step, index) => {if (!step.conclusion || step.uses) return; const uses: string[] = []; for (let i = index - 1; i >= 0; i--) {uses.unshift(steps[i]!.id); if (steps[i]!.conclusion) break;} step.uses = uses;});
}
function sortSteps(steps: LogicalStep[]): LogicalStep[] {
 const ordered: LogicalStep[] = [], remaining = [...steps], main = steps[steps.length - 1];
 while (remaining.length) {
  const index = remaining.findIndex(step => (step !== main || remaining.length === 1) && (!step.conclusion || (step.uses ?? []).every(id => ordered.some(other => other.id === id))));
  if (index < 0) throw new Error(tr("argdown.this_connection_would_create_circular_reasoning")); ordered.push(remaining.splice(index, 1)[0]!);
 }
 return ordered;
}
const fresh = (): LogicalStep => ({id: crypto.randomUUID(), links: [], title: '', text: tr("argdown.new_premise"), reference: false, conclusion: false, rule: '', visible: ''});
export function editLogicalText(engine: ArgdownEngine, model: ArgdownModel, target: LogicalTarget, text: string): string {
 const reconstruction = readReconstruction(model, 'a:' + target.argument), step = reconstruction.steps[target.index]; if (!step) throw new Error(tr("argdown.the_step_no_longer_exists"));
 if (target.inference) step.rule = text; else {if (step.reference) throw new Error(tr("argdown.this_statement_is_a_reference_edit_its_definition_in_the_source")); step.text = text;}
 return writeReconstruction(engine, model, 'a:' + target.argument, reconstruction.steps);
}
export function addLogicalPremise(engine: ArgdownEngine, display: ArgdownModel, target: LogicalTarget, existing?: string): {source: string; focus: StatementRole} {
 let model = display.response.emergenceDerivation?.base ?? display;
 const role = existing ? display.response.emergenceDerivation?.statements.get(existing)?.find(role => role.argument === target.argument) : undefined;
 if (existing && !role) {if (!existing.startsWith('s:')) throw new Error(tr("argdown.an_inferential_step_uses_statements_as_premises_use_and_for_objections")); const reference = ensureNodeReference(engine, display, existing); model = engine.parse(reference.source); existing = reference.key;}
 const steps = readReconstruction(model, 'a:' + target.argument).steps;
 explicitDependencies(steps); const step = steps[target.index]; if (!step) throw new Error(tr("argdown.the_step_no_longer_exists"));
 let premise: LogicalStep;
 if (role) premise = steps[role.index]!;
 else if (existing) {
  if (!existing.startsWith('s:')) throw new Error(tr("argdown.an_inferential_step_uses_statements_as_premises_use_and_for_objections"));
  const title = existing.slice(2);
  premise = {...fresh(), title, text: '', reference: true}; steps.splice(target.index, 0, premise);
 } else {premise = fresh(); steps.splice(target.index, 0, premise);}
 if (premise === step) throw new Error(tr("argdown.a_statement_cannot_justify_itself"));
 if (!step.conclusion) {step.conclusion = true; step.rule = ''; step.uses = [];}
 step.uses = [...new Set([...(step.uses ?? []), premise.id])];
 const sorted = sortSteps(steps), source = writeReconstruction(engine, model, 'a:' + target.argument, sorted);
 return {source, focus: {argument: target.argument, index: sorted.findIndex(item => item.id === premise.id)}};
}
export function addLogicalConclusion(engine: ArgdownEngine, display: ArgdownModel, targets: LogicalTarget[]): {source: string; focus: StatementRole} {
 const target = targets[0]; if (!target || targets.some(item => item.argument !== target.argument)) throw new Error(tr("argdown.select_statements_from_the_same_argument"));
 const model = display.response.emergenceDerivation?.base ?? display, steps = readReconstruction(model, 'a:' + target.argument).steps;
 explicitDependencies(steps); const result = {...fresh(), text: tr("argdown.new_conclusion"), conclusion: true, uses: [...new Set(targets.map(item => steps[item.index]!.id))]}; steps.push(result);
 return {source: writeReconstruction(engine, model, 'a:' + target.argument, steps), focus: {argument: target.argument, index: steps.length - 1}};
}
export function removeLogical(engine: ArgdownEngine, display: ArgdownModel, keys: ReadonlySet<string>): string {
 const model = display.response.emergenceDerivation?.base ?? display, byArgument = new Map<string, {steps: LogicalStep[]; remove: Set<string>}>();
 const get = (argument: string) => {let value = byArgument.get(argument); if (!value) {value = {steps: readReconstruction(model, 'a:' + argument).steps, remove: new Set()}; explicitDependencies(value.steps); byArgument.set(argument, value);} return value;};
 for (const key of keys) {
  const edge = logicalEdge(display, key);
  if (edge) {if (edge.premise === undefined) throw new Error(tr("argdown.this_arrow_connects_an_inferential_step_to_its_conclusion_select_the")); const data = get(edge.argument), step = data.steps[edge.conclusion]!; step.uses = step.uses?.filter(id => id !== data.steps[edge.premise!]!.id); continue;}
  const target = logicalTarget(display, key); if (!target) throw new Error(tr("argdown.remove_inferential_steps_separately_from_other_elements"));
  const data = get(target.argument), step = data.steps[target.index]!;
  if (target.index === data.steps.length - 1) throw new Error(tr("argdown.the_main_conclusion_is_retained_hide_its_reconstruction_on_the_argument"));
  if (target.inference) {step.conclusion = false; step.uses = undefined; step.rule = '';}
  else data.remove.add(step.id);
 }
 let source = model.source;
 for (const [title, data] of [...byArgument].sort(([a], [b]) => (readReconstruction(model, 'a:' + b).range?.from ?? 0) - (readReconstruction(model, 'a:' + a).range?.from ?? 0))) {const steps = data.steps.filter(step => !data.remove.has(step.id)); for (const step of steps) if (step.uses) step.uses = step.uses.filter(id => !data.remove.has(id)); source = writeReconstruction(engine, engine.parse(source), 'a:' + title, steps);}
 return source;
}

/** Target the original step metadata, including anonymous statements hidden in compact mode. */
export function logicalStatementColor(engine: ArgdownEngine, model: ArgdownModel, target: LogicalTarget, color: string | undefined): string {
 const step = readReconstruction(model, 'a:' + target.argument).steps[target.index], rule = step?.original?.statement;
 if (!rule) throw new Error(tr("argdown.the_statement_assignment_is_no_longer_unique"));
 const token = rule.children?.find(child => 'tokenType' in child && child.tokenType.name === 'Data'), range = token ? span(token) : undefined, document = dataDocument(range ? model.source.slice(range.from, range.to) : '{}');
 if (color === undefined) document.document.delete('color'); else document.document.set('color', color);
 const content = span({...rule, children: rule.children?.filter(child => !('name' in child) || String(child.name) !== 'relations')}); if (!content) throw new Error(tr("argdown.the_source_position_is_missing"));
 const at = content.from + model.source.slice(content.from, content.to).trimEnd().length;
 const candidate = applyEdits(model.source, [range ? {...range, insert: document.write()} : {from: at, to: at, insert: ' ' + document.write()}]); engine.parse(candidate); return candidate;
}

/** An existing premise, result or inference can supply an objection without manual source work. */
export function addLogicalObjection(engine: ArgdownEngine, display: ArgdownModel, target: LogicalTarget, existing: string, kind: 'attack' | 'undercut', source = display.source): string {
 const reference = ensureNodeReference(engine, display, existing, source), model = engine.parse(reference.source), steps = readReconstruction(model, 'a:' + target.argument).steps, step = steps[target.index];
 if (!step) throw new Error(tr("argdown.the_step_no_longer_exists"));
 if (!step.links.some(link => link.target === reference.key && link.kind === kind && link.reverse)) step.links.push({id: crypto.randomUUID(), target: reference.key, kind, reverse: true});
 return writeReconstruction(engine, model, 'a:' + target.argument, steps);
}
