import {t as tr} from '../i18n';
import {DotExportPlugin, ExplodeArgumentsPlugin, IArgument, isConclusion, type IArgdownPlugin, type IArgdownRequest, type IArgdownResponse, type IMapNode, type IDotSettings} from '@argdown/core';
import {parseDocument} from 'yaml';
import {applyEdits} from './source-edits';
import {nodeKey, span, type ArgdownModel} from './model';
import type {ArgdownEngine} from './engine';
import {changePresentation, presentationSettings} from './presentation';

export interface InferenceRole {argument: string; conclusion: number}
export interface StatementRole {argument: string; index: number}
export interface DerivationProjection {base: ArgdownModel; focus?: string; expanded: Set<string>; inferences: Map<string, InferenceRole>; argumentStyle: Record<string, unknown>; statements: Map<string, StatementRole[]>}
declare module '@argdown/core' {interface IArgdownResponse {emergenceDerivation?: DerivationProjection}}
const record = (value: unknown): Record<string, unknown> => value && typeof value === 'object' ? value as Record<string, unknown> : {};
export function derivationOverride(model: ArgdownModel, title: string): boolean | undefined {
 const value = record(record(model.response.arguments?.[title]?.data).emergence).derivation;
 return value === 'expanded' ? true : value === 'compact' ? false : undefined;
}
export const globalDerivation = (model: ArgdownModel): boolean => !!model.request.model?.explodeArguments;
export function setGlobalDerivation(engine: ArgdownEngine, source: string, expanded: boolean): string {
 return changePresentation(engine, source, [{path: ['model', 'explodeArguments'], value: expanded}]);
}
/** Per-argument overrides are explicit namespaced source metadata, never hidden plugin state. */
export function setArgumentDerivation(engine: ArgdownEngine, model: ArgdownModel, title: string, expanded: boolean | undefined): string {
 const argument = model.response.arguments?.[title]; if (!argument) throw new Error(tr("argdown.the_argument_no_longer_exists"));
 const canonical = IArgument.getCanonicalMember(argument), candidates = model.rules.filter(rule => String(rule.name) === 'argument' && rule.argument?.title === title);
 const rule = candidates.find(rule => rule.statement === canonical) ?? candidates[0]; if (!rule) throw new Error(tr("argdown.the_argument_cannot_be_uniquely_matched_to_the_source"));
 const token = rule.children?.find(child => 'tokenType' in child && child.tokenType.name === 'Data'), range = token ? span(token) : undefined;
 const raw = range ? model.source.slice(range.from, range.to) : '{}', block = /^\{\s*\n/u.test(raw);
 const data = parseDocument(block ? raw.replace(/^\{\s*\n/u, '').replace(/\}\s*$/u, '') : raw);
 if (data.errors.length) throw new Error(tr("argdown.correct_the_argument_metadata"));
 if (expanded === undefined) {if (data.hasIn(['emergence', 'derivation'])) {data.deleteIn(['emergence', 'derivation']); const values = record(data.toJS()); if (values.emergence && Object.keys(record(values.emergence)).length === 0) data.delete('emergence');}} else data.setIn(['emergence', 'derivation'], expanded ? 'expanded' : 'compact');
 const value = data.toString().trimEnd(), insert = value === '{}' ? '' : block ? '{\n' + value + '\n}' : value;
 const head = span({...rule, children: rule.children?.filter(child => !('name' in child) || String(child.name) !== 'relations')}); if (!head) throw new Error(tr("argdown.the_argument_has_no_source_position"));
 const at = head.from + model.source.slice(head.from, head.to).trimEnd().length;
 const candidate = applyEdits(model.source, [range ? {...range, insert} : {from: at, to: at, insert: ' ' + insert}]); engine.parse(candidate); return candidate;
}
/** 'All' is an explicit command: old individual overrides cannot neutralize it. */
export function setAllDerivations(engine: ArgdownEngine, source: string, expanded: boolean): string {
 let candidate = setGlobalDerivation(engine, source, expanded);
 for (const title of Object.keys(engine.parse(candidate).response.arguments ?? {})) {const model = engine.parse(candidate); if (derivationOverride(model, title) !== undefined) candidate = setArgumentDerivation(engine, model, title, undefined);}
 return candidate;
}
export function derivationMode(model: ArgdownModel): 'all' | 'none' | 'mixed' {
 const states = Object.values(model.response.arguments ?? {}).filter(argument => argument.pcs.length).map(argument => derivationOverride(model, argument.title ?? '') ?? globalDerivation(model));
 return states.length && states.every(Boolean) ? 'all' : states.some(Boolean) ? 'mixed' : 'none';
}
/** Native Argdown model expansion; the separate source model remains untouched and editable. */
export function derivationPlugin(base: ArgdownModel, focus?: string): IArgdownPlugin {
 return {name: 'EmergenceDerivation', run: (request, response) => {
  const projection: DerivationProjection = {base, focus, expanded: new Set(), inferences: new Map(), argumentStyle: record(record(record(presentationSettings(base.source).toJS()).dot).argument), statements: new Map()}; response.emergenceDerivation = projection;
  const allowed = new Set(response.selection?.arguments.map(argument => argument.title));
  const native = new ExplodeArgumentsPlugin();
  for (const [title, argument] of Object.entries(response.arguments ?? {})) {
   if (!argument.pcs.length || (focus ? title !== focus : !allowed.has(title) || !(derivationOverride(base, title) ?? globalDerivation(base)))) continue;
   projection.expanded.add(title);
   const conclusions = argument.pcs.flatMap((step, index) => String(step.role).includes('conclusion') ? [index] : []);
   conclusions.forEach((index, i) => projection.inferences.set('a:' + (conclusions.length > 1 ? title + ' - ' + (i + 1) : title), {argument: title, conclusion: index}));
   argument.pcs.forEach((step, index) => {const key = 's:' + step.title, roles = projection.statements.get(key) ?? []; roles.push({argument: title, index}); projection.statements.set(key, roles);});
   if (conclusions.length === 1) {
    // Upstream returns early for one inference, leaving its explicit `uses`
    // unapplied. Use its own step builder and detach unused map memberships.
    const index = conclusions[0]!, conclusion = argument.pcs[index]!;
    if (isConclusion(conclusion)) {const old = argument.pcs, selected = native.getInferentialStep(response, argument, conclusion, index); const used = new Set(selected.map(step => JSON.stringify([step.title, step.startLine, step.startColumn, step.startOffset]))); for (const step of old) if (!used.has(JSON.stringify([step.title, step.startLine, step.startColumn, step.startOffset]))) step.argumentTitle = ''; argument.pcs = selected;}
   } else native.explodeArgument(response, argument);

   // Upstream keeps inference.argumentTitle on the unsplit argument. Point native
   // relation mapping at its actual generated step so undercuts stay visible.
   for (const [key, role] of projection.inferences) if (role.argument === title) {const generated = response.arguments?.[key.slice(2)], conclusion = generated?.pcs[generated.pcs.length - 1]; if (conclusion && isConclusion(conclusion) && conclusion.inference) conclusion.inference.argumentTitle = key.slice(2);}

  }
  // Force only the expanded arguments' statements into the ordinary native selection.
  const statements = [...projection.statements.keys()].map(key => key.slice(2));
  request.selection ??= {}; request.selection.includeStatements = [...new Set([...(request.selection.includeStatements ?? []), ...statements])];

  if (focus) {request.selection = {...request.selection, selectedTags: undefined, selectedSections: undefined, excludeStatements: [], excludeArguments: [], ignoreIsInMap: true}; request.dot ??= {}; request.dot.graphVizSettings = {...request.dot.graphVizSettings, rankdir: 'TB'};}
  return response;
 }};
}
export const derivationSelectionPlugin: IArgdownPlugin = {name: 'EmergenceDerivationSelection', run: (request, response) => {
 const projection = response.emergenceDerivation; if (!projection || !response.selection) return response;
 if (projection.focus) {
  response.selection.arguments = Object.entries(response.arguments ?? {}).filter(([title]) => projection.inferences.has('a:' + title)).map(([,argument]) => argument);
  response.selection.statements = Object.entries(response.statements ?? {}).filter(([title]) => projection.statements.has('s:' + title)).map(([,statement]) => statement);
 } else {
  // A collapsed reconstruction must disappear even when the authored selection mode is 'all'.
  const internal = new Set(Object.values(projection.base.response.arguments ?? {}).filter(argument => !projection.expanded.has(argument.title ?? '')).flatMap(argument => argument.pcs.map(step => step.title)));
  response.selection.statements = response.selection.statements.filter(statement => !internal.has(statement.title) || projection.statements.has('s:' + statement.title) || statement.isUsedAsTopLevelStatement || statement.isUsedAsIntermediaryConclusion && (statement.relations?.length ?? 0) > 0);
 }
 const selected = new Set(response.selection.statements.map(statement => statement.title));
 for (const key of projection.statements.keys()) {
  const title = key.slice(2), statement = response.statements?.[title];
  if (!statement || selected.has(title) || request.selection?.excludeStatements?.includes(title)) continue;
  const explicitOpen = projection.statements.get(key)?.some(role => derivationOverride(projection.base, role.argument) === true);
  if (record(statement.data).isInMap === false && !explicitOpen && !request.selection?.ignoreIsInMap) continue;
  response.selection.statements.push(statement); selected.add(title);
 }
 return response;
}};
/** Small inferential-step circles use the official DOT exporter and Graphviz geometry. */
export class DerivationDotPlugin extends DotExportPlugin {
 override exportNodesRecursive(node: IMapNode, request: IArgdownRequest, response: IArgdownResponse, settings: IDotSettings): string {
  const projection = response.emergenceDerivation, key = nodeKey(node);
  const style = projection?.argumentStyle ?? {};
  if (projection?.inferences.has(key)) return super.exportNodesRecursive({...node, labelTitle: undefined, labelText: undefined}, request, response, {...settings, argument: {...settings.argument, shape: typeof style.shape === 'string' ? style.shape : 'circle', minWidth: typeof style.minWidth === 'number' ? style.minWidth : 0.2, margin: typeof style.margin === 'string' ? style.margin : '0', style: typeof style.style === 'string' ? style.style : 'filled'}});
  // A compact per-node exception remains legible even with a global inference-tree preset.
  if (projection && key.startsWith('a:') && !projection.inferences.has(key) && projection.base.response.arguments?.[key.slice(2)]?.pcs.length) {
   const original = projection.base.response.arguments?.[node.title ?? ''], member = original ? IArgument.getCanonicalMember(original) : undefined;
   return super.exportNodesRecursive({...node, labelTitle: node.title, labelText: member?.text}, request, response, {...settings, argument: {...settings.argument, shape: typeof style.shape === 'string' && style.shape !== 'circle' ? style.shape : 'box', minWidth: typeof style.minWidth === 'number' && style.minWidth >= 20 ? style.minWidth : 180, margin: typeof style.margin === 'string' ? style.margin : '0.11', style: typeof style.style === 'string' ? style.style : 'filled,rounded'}});
  }
  // Anonymous numbered statements in expanded arguments are readable regardless of map label mode.
  if (projection?.statements.has(key) && !node.labelText) {
   const ec = response.statements?.[node.title ?? ''], text = ec?.members.find(member => member.text)?.text;
   return super.exportNodesRecursive({...node, labelTitle: undefined, labelText: text}, request, response, settings);
  }
  return super.exportNodesRecursive(node, request, response, settings);
 }
}
