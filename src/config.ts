import {t as tr} from './i18n';
import {synopsisRelations} from './graph/synopsis-types';
import {synopsisPositions} from './graph/synopsis-layout';
import {features} from './features';
import type {OutputModule, Profile, RelationRule, Settings} from './types';
import {assert, clone, safeProperty} from './util';
export const templateVariables = ['language', 'instructions', 'note.title', 'note.path', 'note.content', 'selection',
 'graph.edge_fields', 'graph.relevant_nodes', 'graph.existing_edges', 'outputs.enabled', 'evidence.sections'];
const stringArray = (v: unknown): v is string[] => Array.isArray(v) && v.every(x => typeof x === 'string');
const validTemplate = (v: unknown): v is string => typeof v === 'string' && [...v.matchAll(/\{\{\s*([^{}]+?)\s*\}\}/gu)].every(m => templateVariables.includes(m[1]!));

export const unknownRule = (label: string): RelationRule => ({
 label, description: '', class: 'unknown', hierarchical: false, acyclic: false,
 transitive: false, symmetric: false, inverse: '', direction: 'forward', allowSelf: false,
 writable: false, targetProperty: '', eligibleNodeTypes: [], provenance: 'unknown',
});
const output = (id: string, kind: OutputModule['kind']): OutputModule => ({
 id, kind, enabled: true, maxSuggestions: 8, eligibleNodeTypes: [], allowedEdgeTypes: [],
 targetProperty: '', dataType: 'wikilink-list', writeMode: kind === 'relations' ? 'review' : 'display',
 language: 'de', minEvidence: 'medium', promptTemplate: '', visibility: true, requiresManualReview: true,
});
export const defaultProfile = (): Profile => ({
 id: 'strict', name: 'Strenge Klassifikation', version: 1, language: 'de', temperature: 0.2,
 maxTokens: 768, instructions: 'Ordne die Notiz ihren ausgewählten Breadcrumbs-Feldern zu. Nur fachlich passende Zielnotizen; bei Unsicherheit keine Zuordnung.',
 templates: {
  system: 'Ausgabesprache: {{language}}.',
  extract: 'Extrahiere belegte Begriffe.',
  assign: 'Verwende vorhandene Kandidaten-IDs.',
  relations: 'Prüfe für jedes ausgewählte Feld, ob die Zielnotiz genau dessen Rolle gegenüber der Ausgangsnotiz erfüllt. Ein gemeinsames Wort oder Thema genügt nicht. Verwende je Ziel höchstens die passendste Zuordnung.',
  discover: 'Neue Konzepte nur mit Beleg und Dublettenprüfung.',
  validate: 'Nur gültiges JSON für die aktivierten Output-IDs.',
 }, outputs: [output('relations', 'relations')],
});
export const defaults = (): Settings => ({
 uiLanguage: 'auto', citekeyFormat: 'brackets',
 schemaVersion: 1, endpoint: 'http://127.0.0.1:11434', model: 'qwen3.5:9b', numCtx: 8192,
 timeoutMs: 180000, think: false, releaseModel: false, maxConcurrent: 1, rules: {},
 profiles: [defaultProfile()], activeProfile: 'strict', maxGraphNodes: 1500, maxGraphEdges: 6000, conceptFolders: [], graphHeight: 560, layout: 'elk',
 assignment: {allFolders: true, allowNewTargets: true, excludeExistingTargets: false, propertyFilter: 'none', properties: [], fieldsByNote: {}}, fieldDescriptions: {},
});
export function validateSettings(s: Settings): void {
 assert(s !== null && typeof s === 'object', tr("common.settings_must_be_a_json_object"));
 assert(s.uiLanguage === undefined || ['auto','de','en'].includes(s.uiLanguage), tr("common.invalid_interface_language"));
 if(s.features!==undefined)assert(s.features!==null&&typeof s.features==='object'&&!Array.isArray(s.features)&&Object.entries(s.features).every(([key,value])=>features.includes(key as typeof features[number])&&typeof value==='boolean'),tr('settings.invalidFeatures'));
 assert(s.citekeyFormat === undefined || ['brackets','at','plain'].includes(s.citekeyFormat), tr("common.invalid_citekey_format"));
 assert(s.schemaVersion === 1, tr("common.unsupported_settings_version"));
 const url = new URL(s.endpoint);
 assert(url.protocol === 'http:' && ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname)
  && !url.username && !url.password && url.pathname === '/' && !url.search && !url.hash,
 tr("common.only_a_local_http_loopback_address_is_allowed_in_v1"));
 assert(typeof s.model === 'string' && s.model.length > 0 && !s.model.includes(':cloud'), tr("common.a_local_model_is_required"));
 assert(typeof s.think === 'boolean' && typeof s.releaseModel === 'boolean' && stringArray(s.conceptFolders), tr("common.invalid_model_or_registry_options"));
 assert(s.assignment && [s.assignment.allFolders, s.assignment.allowNewTargets, s.assignment.excludeExistingTargets].every(v => typeof v === 'boolean')
  && ['none', 'breadcrumbs', 'custom'].includes(s.assignment.propertyFilter) && stringArray(s.assignment.properties), tr("common.invalid_assignment_settings"));
 assert(s.assignment.propertyFilter !== 'custom' || s.assignment.properties.length > 0, tr("common.enter_at_least_one_frontmatter_key_for_the_target_filter"));
 assert(s.assignment.fieldsByNote && typeof s.assignment.fieldsByNote === 'object' && !Array.isArray(s.assignment.fieldsByNote)
  && Object.entries(s.assignment.fieldsByNote).every(([path, fields]) => path.endsWith('.md') && stringArray(fields)), tr("common.invalid_saved_field_selection"));
 assert(s.fieldDescriptions && typeof s.fieldDescriptions === 'object' && !Array.isArray(s.fieldDescriptions)
  && Object.values(s.fieldDescriptions).every(value => typeof value === 'string' && value.length <= 3000), tr("common.invalid_field_descriptions"));
 assert(s.conceptFolders.every(folder => folder === '/' || (!folder.startsWith('/') && !folder.includes('\\') && !folder.split('/').some(part => part === '..' || part === '.'))), tr("common.target_folders_must_be_relative_vault_paths"));
 assert(s.rules && typeof s.rules === 'object' && !Array.isArray(s.rules), tr("common.invalid_semantics_table"));
 for (const [value, min, max] of [[s.numCtx, 2048, 131072], [s.timeoutMs, 1000, 1800000],
  [s.maxConcurrent, 1, 2], [s.maxGraphNodes, 50, 10000], [s.maxGraphEdges, 100, 50000], [s.graphHeight, 250, 2000]]) {
  assert(Number.isInteger(value) && value! >= min! && value! <= max!, tr("common.invalid_numeric_limit"));
 }
 if (s.synopsis!==undefined) {
  assert(s.synopsis!==null&&typeof s.synopsis==='object'&&!Array.isArray(s.synopsis),tr("common.invalid_context_configuration"));
  if(s.synopsis.depths!==undefined)assert(s.synopsis.depths!==null&&typeof s.synopsis.depths==='object'&&!Array.isArray(s.synopsis.depths)&&Object.entries(s.synopsis.depths).every(([key,value])=>synopsisRelations.includes(key as typeof synopsisRelations[number])&&[1,2,3,'all'].includes(value)),tr("common.invalid_context_depth"));
  if(s.synopsis.fields!==undefined)assert(s.synopsis.fields!==null&&typeof s.synopsis.fields==='object'&&!Array.isArray(s.synopsis.fields)&&Object.entries(s.synopsis.fields).every(([key,value])=>synopsisRelations.includes(key as typeof synopsisRelations[number])&&stringArray(value)),tr("common.invalid_context_field_assignment"));
  if(s.synopsis.labels!==undefined)assert(s.synopsis.labels!==null&&typeof s.synopsis.labels==='object'&&!Array.isArray(s.synopsis.labels)&&Object.entries(s.synopsis.labels).every(([key,value])=>synopsisRelations.includes(key as typeof synopsisRelations[number])&&typeof value==='string'&&value.length<=200&&!/[\r\n\0]/u.test(value)),tr('settings.invalidGraphPresentation'));
  if(s.synopsis.placements!==undefined)assert(s.synopsis.placements!==null&&typeof s.synopsis.placements==='object'&&!Array.isArray(s.synopsis.placements)&&Object.entries(s.synopsis.placements).every(([key,value])=>synopsisRelations.includes(key as typeof synopsisRelations[number])&&value&&synopsisPositions.includes(value.position)&&Number.isSafeInteger(value.order)&&value.order>=0),tr('settings.invalidGraphPresentation'));
 }
 if(s.templateFolders!==undefined)assert(s.templateFolders!==null&&typeof s.templateFolders==='object'&&!Array.isArray(s.templateFolders)&&Object.entries(s.templateFolders).every(([key,value])=>['mermaid','argdown'].includes(key)&&typeof value==='string'&&!value.startsWith('/')&&!/[\\\0\r\n]/u.test(value)&&!value.split('/').some(part=>part.startsWith('.'))),tr('settings.invalidTemplateFolder'));
 if (s.graphStructure) assert(['up', 'down', 'left', 'right'].every(key => typeof s.graphStructure![key as 'up'] === 'string') && (s.graphStructure.examples === undefined || typeof s.graphStructure.examples === 'string') && Number.isInteger(s.graphStructure.depth) && s.graphStructure.depth >= 1 && s.graphStructure.depth <= 3, tr("common.invalid_graph_axes"));
 assert(['elk', 'fcose', 'concentric'].includes(s.layout), tr("labels.unknown_layout"));
 assert(Array.isArray(s.profiles) && s.profiles.length > 0 && s.profiles.length <= 30, tr("common.between_1_and_30_profiles_are_required"));
 assert(new Set(s.profiles.map(p => p.id)).size === s.profiles.length, tr("common.profile_ids_must_be_unique"));
 assert(s.profiles.some(p => p.id === s.activeProfile), tr("common.the_active_profile_is_missing"));
 for (const p of s.profiles) {
  assert(typeof p.id === 'string' && p.id.length > 0 && typeof p.name === 'string' && Number.isInteger(p.version) && p.version >= 1, tr("common.invalid_profile"));
  assert(p.templates && ['system', 'extract', 'assign', 'relations', 'discover', 'validate'].every(key => validTemplate(p.templates[key as keyof Profile['templates']])), tr("common.prompts_contain_unknown_placeholders_or_missing_templates"));
  assert(Array.isArray(p.outputs) && p.outputs.length <= 25, tr("common.invalid_output_list"));
  assert(p.temperature >= 0 && p.temperature <= 2 && Number.isInteger(p.maxTokens) && p.maxTokens >= 128 && p.maxTokens < s.numCtx - 1024, tr("common.invalid_model_budget_in_profile"));
  assert(['de', 'en', 'note'].includes(p.language) && typeof p.instructions === 'string', tr("common.invalid_profile_language"));
  assert(new Set(p.outputs.map(o => o.id)).size === p.outputs.length, tr("common.output_ids_must_be_unique"));
  for (const o of p.outputs) {
   assert(typeof o.id === 'string' && o.id.length > 0 && typeof o.enabled === 'boolean' && typeof o.visibility === 'boolean', tr("common.invalid_output_metadata"));
   assert(stringArray(o.eligibleNodeTypes) && stringArray(o.allowedEdgeTypes) && typeof o.targetProperty === 'string', tr("common.invalid_output_assignment"));
   assert(['de', 'en', 'note'].includes(o.language) && ['wikilink-list', 'text', 'json'].includes(o.dataType) && validTemplate(o.promptTemplate), tr("common.invalid_output_format_or_template"));
   assert(o.requiresManualReview === true, tr("common.manual_review_cannot_be_disabled"));
   assert(Number.isInteger(o.maxSuggestions) && o.maxSuggestions >= 0 && o.maxSuggestions <= 100, tr("common.invalid_suggestion_limit"));
   assert(['relations', 'concepts', 'text', 'table', 'json'].includes(o.kind), tr("labels.unknown_output_type"));
   assert(o.writeMode === 'display' || (o.writeMode === 'review' && o.kind === 'relations'), tr("common.custom_outputs_that_write_data_are_blocked_in_v1"));
   assert(['low', 'medium', 'high'].includes(o.minEvidence), tr("common.invalid_evidence_level"));
  }
 }
 for (const [label, r] of Object.entries(s.rules)) {
  assert(r && [r.hierarchical, r.acyclic, r.transitive, r.symmetric, r.allowSelf, r.writable].every(v => typeof v === 'boolean')
   && typeof r.description === 'string' && typeof r.targetProperty === 'string' && typeof r.inverse === 'string' && stringArray(r.eligibleNodeTypes), tr("common.invalid_semantics_rule"));
  assert(r.label === label && r.provenance === 'user', tr("common.rules_require_explicit_user_provenance"));
  assert(['unknown', 'taxonomic', 'mereological', 'causal', 'associative', 'sequential'].includes(r.class), tr("common.invalid_relation_class"));
  assert(['forward', 'reverse'].includes(r.direction), tr("common.invalid_direction"));
  assert(!r.writable || (safeProperty(r.targetProperty) && r.targetProperty === label && r.description.trim().length > 0),
   tr("common.writable_fields_must_match_the_breadcrumbs_label_and_have_confirmed_semantics"));
 }
}
export function migrateSettings(input: unknown): Settings {
 const d = defaults();
 if (input === null || typeof input !== 'object') return d;
 const raw = {...input} as Partial<Settings> & {inquiryTemplates?:unknown};
 delete raw.inquiryTemplates;
 assert(raw.schemaVersion === undefined || raw.schemaVersion === 1, tr("common.newer_settings_cannot_be_loaded_without_losing_data"));
 const s = {...d, ...raw, uiLanguage: raw.uiLanguage ?? 'de', rules: raw.rules ?? {}, profiles: raw.profiles ?? d.profiles,
  assignment: {...d.assignment, allFolders: !(raw.conceptFolders?.length), ...raw.assignment}, fieldDescriptions: raw.fieldDescriptions ?? {}};
 validateSettings(s);
 return clone(s);
}
