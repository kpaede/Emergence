import {t as tr} from '../i18n';
import {parseDocument} from 'yaml';
import type {ArgdownEngine} from './engine';
import {isGroup, type ArgdownModel} from './model';
export interface PresentationChange {path: string[]; value: unknown}
const frontmatter = (source: string) => /^\s*={3,}\r?\n([\s\S]*?)\r?\n={3,}/u.exec(source);
/** Native Argdown configuration only. Preserve comments and unknown settings. */
export function presentationSettings(source: string): ReturnType<typeof parseDocument> {return parseDocument(frontmatter(source)?.[1] ?? '');}
export function changePresentation(engine: ArgdownEngine, source: string, changes: PresentationChange[]): string {
 if (!changes.length) return source;
 const match = frontmatter(source), document = presentationSettings(source); if (document.errors.length) throw new Error(tr("argdown.correct_the_argdown_configuration_first"));
 for (const {path, value} of changes) {if (!path.length) throw new Error(tr("argdown.the_setting_is_missing")); if (value === undefined) {if (document.hasIn(path)) document.deleteIn(path);} else document.setIn(path, value);}
 const newline = source.includes('\r\n') ? '\r\n' : '\n';
 const candidate = ('===\n' + document.toString().trimEnd() + '\n===').replace(/\n/gu, newline) + (match ? source.slice(match[0].length) : newline + newline + source);
 engine.parse(candidate); return candidate;
}
/** Temporary native inference view; this never replaces the note's source or view settings. */
export function inferenceView(engine: ArgdownEngine, source: string, title: string): ArgdownModel {
 const model = engine.parse(source), argument = model.response.arguments?.[title]; if (!argument?.pcs.length) throw new Error(tr("argdown.this_argument_has_no_premises_and_conclusion_yet"));
 const statements = new Set(argument.pcs.map(step => step.title)), count = argument.pcs.filter(step => String(step.role).includes('conclusion')).length;
 const args = new Set(count > 1 ? Array.from({length: count}, (_, index) => title + ' - ' + (index + 1)) : [title]);
 const changes: PresentationChange[] = [
  {path: ['model', 'explodeArguments'], value: true}, {path: ['selection', 'statementSelectionMode'], value: 'all'}, {path: ['selection', 'excludeDisconnected'], value: false}, {path: ['selection', 'ignoreIsInMap'], value: true},
  {path: ['selection', 'selectedSections'], value: undefined}, {path: ['selection', 'selectedTags'], value: undefined}, {path: ['selection', 'excludeStatements'], value: Object.keys(model.response.statements ?? {}).filter(key => !statements.has(key))}, {path: ['selection', 'excludeArguments'], value: []},
  {path: ['group', 'sections'], value: undefined}, {path: ['group', 'regroup'], value: undefined}, {path: ['group', 'groupDepth'], value: 0}, {path: ['group', 'ignoreIsClosed'], value: true}, {path: ['group', 'ignoreIsGroup'], value: true},
  {path: ['map', 'argumentLabelMode'], value: 'none'}, {path: ['map', 'statementLabelMode'], value: 'text'}, {path: ['dot', 'argument', 'shape'], value: 'circle'}, {path: ['dot', 'argument', 'minWidth'], value: 0.2}, {path: ['dot', 'graphVizSettings', 'rankdir'], value: 'TB'},
 ];
 let candidate = changePresentation(engine, source, changes), expanded = engine.parse(candidate, true);
 candidate = changePresentation(engine, candidate, [{path: ['selection', 'excludeArguments'], value: Object.keys(expanded.response.arguments ?? {}).filter(key => !args.has(key))}]);
 expanded = engine.parse(candidate, true);
 if (!expanded.nodes.some(node => !isGroup(node))) throw new Error(tr("argdown.the_current_configuration_hides_this_inference_structure")); return expanded;
}
